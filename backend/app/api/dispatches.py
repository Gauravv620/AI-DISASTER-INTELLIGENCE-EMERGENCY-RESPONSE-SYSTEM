from typing import Optional, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.database.fallback_store import fallback_store
from app.services.alert_broadcast import alert_manager


router = APIRouter(prefix="/dispatches", tags=["Dispatches"])


DispatchPriority = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]

DispatchStatus = Literal[
    "ASSIGNED",
    "ACKNOWLEDGED",
    "EN_ROUTE",
    "ON_SCENE",
    "COMPLETED",
    "CANCELLED",
]


class DispatchCreate(BaseModel):
    incident_id: UUID
    team_id: UUID
    dispatcher_id: UUID
    latitude: float
    longitude: float
    priority: DispatchPriority = "MEDIUM"
    instructions: Optional[str] = Field(default=None, max_length=2000)


class DispatchStatusUpdate(BaseModel):
    status: DispatchStatus


@router.get("/count")
async def get_dispatch_counts(
    db: AsyncSession = Depends(get_db),
):
    try:
        query = text("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE UPPER(status) = 'ASSIGNED') AS assigned,
                COUNT(*) FILTER (WHERE UPPER(status) = 'ACKNOWLEDGED') AS acknowledged,
                COUNT(*) FILTER (WHERE UPPER(status) = 'EN_ROUTE') AS en_route,
                COUNT(*) FILTER (WHERE UPPER(status) = 'ON_SCENE') AS on_scene,
                COUNT(*) FILTER (WHERE UPPER(status) = 'COMPLETED') AS completed,
                COUNT(*) FILTER (WHERE UPPER(status) = 'CANCELLED') AS cancelled
            FROM dispatches
        """)
        result = await db.execute(query)
        row = result.mappings().one()
        return {k: int(v or 0) for k, v in dict(row).items()}
    except Exception:
        return fallback_store.get_dispatch_counts()


@router.get("")
async def get_dispatches(
    status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    try:
        if status:
            query = text("""
                SELECT
                    d.id,
                    d.incident_id,
                    d.team_id,
                    d.dispatcher_id,
                    d.priority,
                    d.instructions,
                    d.status,
                    d.assigned_at,
                    d.acknowledged_at,
                    d.completed_at,
                    ST_Y(d.assigned_location::geometry) AS latitude,
                    ST_X(d.assigned_location::geometry) AS longitude,
                    i.incident_type,
                    i.severity AS incident_severity,
                    i.status AS incident_status,
                    rt.team_name,
                    rt.organization,
                    rt.team_type,
                    o.full_name AS dispatcher_name
                FROM dispatches d
                JOIN incidents i ON i.id = d.incident_id
                JOIN rescue_teams rt ON rt.id = d.team_id
                JOIN officials o ON o.id = d.dispatcher_id
                WHERE UPPER(d.status) = UPPER(:status)
                ORDER BY d.assigned_at DESC
                LIMIT :limit OFFSET :offset
            """)
            result = await db.execute(query, {"status": status, "limit": limit, "offset": offset})
        else:
            query = text("""
                SELECT
                    d.id,
                    d.incident_id,
                    d.team_id,
                    d.dispatcher_id,
                    d.priority,
                    d.instructions,
                    d.status,
                    d.assigned_at,
                    d.acknowledged_at,
                    d.completed_at,
                    ST_Y(d.assigned_location::geometry) AS latitude,
                    ST_X(d.assigned_location::geometry) AS longitude,
                    i.incident_type,
                    i.severity AS incident_severity,
                    i.status AS incident_status,
                    rt.team_name,
                    rt.organization,
                    rt.team_type,
                    o.full_name AS dispatcher_name
                FROM dispatches d
                JOIN incidents i ON i.id = d.incident_id
                JOIN rescue_teams rt ON rt.id = d.team_id
                JOIN officials o ON o.id = d.dispatcher_id
                ORDER BY d.assigned_at DESC
                LIMIT :limit OFFSET :offset
            """)
            result = await db.execute(query, {"limit": limit, "offset": offset})

        items = [dict(row) for row in result.mappings().all()]
        return {"items": items, "count": len(items), "limit": limit, "offset": offset}
    except Exception:
        return fallback_store.get_dispatches(status=status, limit=limit, offset=offset)


@router.post("")
async def create_dispatch(
    dispatch: DispatchCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        query = text("""
            INSERT INTO dispatches (
                incident_id,
                team_id,
                dispatcher_id,
                assigned_location,
                priority,
                instructions,
                status,
                assigned_at
            )
            VALUES (
                :incident_id,
                :team_id,
                :dispatcher_id,
                ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                :priority,
                :instructions,
                'ASSIGNED',
                NOW()
            )
            RETURNING
                id,
                incident_id,
                team_id,
                dispatcher_id,
                priority,
                instructions,
                status,
                assigned_at,
                ST_Y(assigned_location::geometry) AS latitude,
                ST_X(assigned_location::geometry) AS longitude
        """)

        result = await db.execute(
            query,
            {
                "incident_id": dispatch.incident_id,
                "team_id": dispatch.team_id,
                "dispatcher_id": dispatch.dispatcher_id,
                "latitude": dispatch.latitude,
                "longitude": dispatch.longitude,
                "priority": dispatch.priority,
                "instructions": dispatch.instructions,
            },
        )
        await db.commit()
        row = dict(result.mappings().one())
    except Exception:
        row = fallback_store.create_dispatch({
            "incident_id": dispatch.incident_id,
            "team_id": dispatch.team_id,
            "dispatcher_id": dispatch.dispatcher_id,
            "latitude": dispatch.latitude,
            "longitude": dispatch.longitude,
            "priority": dispatch.priority,
            "instructions": dispatch.instructions,
        })

    try:
        await alert_manager.broadcast({
            "type": "new_dispatch",
            "dispatch": row,
        })
    except Exception:
        pass

    return row


@router.patch("/{dispatch_id}/status")
async def update_dispatch_status(
    dispatch_id: UUID,
    payload: DispatchStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    try:
        query = text("""
            UPDATE dispatches
            SET
                status = :status,
                acknowledged_at = CASE
                    WHEN UPPER(:status) = 'ACKNOWLEDGED' AND acknowledged_at IS NULL THEN NOW()
                    ELSE acknowledged_at
                END,
                completed_at = CASE
                    WHEN UPPER(:status) = 'COMPLETED' THEN NOW()
                    ELSE completed_at
                END
            WHERE id = :dispatch_id
            RETURNING id, incident_id, team_id, status, assigned_at, acknowledged_at, completed_at
        """)
        result = await db.execute(query, {"dispatch_id": dispatch_id, "status": payload.status})
        await db.commit()
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Dispatch operation not found")
        updated = dict(row)
    except HTTPException:
        raise
    except Exception:
        updated = fallback_store.update_dispatch_status(str(dispatch_id), payload.status)
        if not updated:
            raise HTTPException(status_code=404, detail="Dispatch operation not found")

    try:
        await alert_manager.broadcast({
            "type": "dispatch_status_update",
            "dispatch_id": str(dispatch_id),
            "status": payload.status,
        })
    except Exception:
        pass

    return updated
