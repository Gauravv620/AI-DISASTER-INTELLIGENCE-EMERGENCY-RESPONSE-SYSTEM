from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.database.fallback_store import fallback_store
from app.services.alert_broadcast import alert_manager


router = APIRouter(tags=["incidents"])


IncidentType = Literal[
    "FLOOD",
    "HEAVY_RAINFALL",
    "LANDSLIDE",
    "EARTHQUAKE",
]

Severity = Literal[
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
]


class IncidentCreate(BaseModel):
    incident_type: IncidentType
    severity: Severity
    title: str = Field(min_length=3, max_length=255)
    description: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


@router.get("/incidents/count")
async def get_incident_counts(
    db: AsyncSession = Depends(get_db),
):
    """
    Return incident counts by operational status.
    """
    try:
        query = text(
            """
            SELECT
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(status, '')) = 'OPEN'
                ) AS open_incidents,

                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(status, '')) = 'INVESTIGATING'
                ) AS investigating,

                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(status, '')) = 'DISPATCHED'
                ) AS dispatched,

                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(status, '')) = 'RESOLVED'
                ) AS resolved,

                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(status, '')) = 'CLOSED'
                ) AS closed,

                COUNT(*) AS total_incidents

            FROM incidents
            """
        )

        result = await db.execute(query)
        row = result.mappings().one()

        return {
            "open_incidents": int(row["open_incidents"] or 0),
            "investigating": int(row["investigating"] or 0),
            "dispatched": int(row["dispatched"] or 0),
            "resolved": int(row["resolved"] or 0),
            "closed": int(row["closed"] or 0),
            "total_incidents": int(row["total_incidents"] or 0),
        }
    except Exception:
        return fallback_store.get_incident_counts()


@router.get("/incidents")
async def list_incidents(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    Return incidents stored in PostgreSQL/PostGIS or resilient fallback store.
    """
    limit = max(1, min(limit, 1000))
    offset = max(0, offset)

    try:
        query = text(
            """
            SELECT
                id,
                incident_type,
                severity,
                status,
                title,
                description,
                source,
                external_event_id,
                ST_Y(location::geometry) AS latitude,
                ST_X(location::geometry) AS longitude,
                reported_at,
                occurred_at,
                expires_at,
                created_at
            FROM incidents
            ORDER BY created_at DESC NULLS LAST
            LIMIT :limit
            OFFSET :offset
            """
        )

        result = await db.execute(
            query,
            {
                "limit": limit,
                "offset": offset,
            },
        )

        incidents = [dict(row) for row in result.mappings().all()]

        return {
            "items": incidents,
            "count": len(incidents),
            "limit": limit,
            "offset": offset,
        }
    except Exception:
        return fallback_store.get_incidents(limit=limit, offset=offset)


@router.post("/incidents")
async def create_incident(
    incident: IncidentCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a manually reported AIDERS incident.
    """
    try:
        query = text(
            """
            INSERT INTO incidents (
                incident_type,
                severity,
                status,
                title,
                description,
                source,
                location,
                reported_at
            )
            VALUES (
                :incident_type,
                :severity,
                'OPEN',
                :title,
                :description,
                'AIDERS_MANUAL',
                ST_SetSRID(
                    ST_MakePoint(
                        :longitude,
                        :latitude
                    ),
                    4326
                )::geography,
                NOW()
            )
            RETURNING
                id,
                incident_type,
                severity,
                status,
                title,
                description,
                source,
                reported_at,
                created_at,
                ST_Y(location::geometry) AS latitude,
                ST_X(location::geometry) AS longitude
            """
        )

        result = await db.execute(
            query,
            {
                "incident_type": incident.incident_type,
                "severity": incident.severity,
                "title": incident.title,
                "description": incident.description,
                "latitude": incident.latitude,
                "longitude": incident.longitude,
            },
        )

        await db.commit()
        row = dict(result.mappings().one())
    except Exception:
        row = fallback_store.create_incident({
            "incident_type": incident.incident_type,
            "severity": incident.severity,
            "title": incident.title,
            "description": incident.description,
            "latitude": incident.latitude,
            "longitude": incident.longitude,
            "source": "AIDERS_MANUAL",
        })

    try:
        await alert_manager.broadcast({
            "type": "new_incident",
            "incident": row,
        })
    except Exception:
        pass

    return row
