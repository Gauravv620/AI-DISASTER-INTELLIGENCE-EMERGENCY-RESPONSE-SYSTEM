from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.database.fallback_store import fallback_store


router = APIRouter(tags=["rescue-teams"])


TeamStatus = Literal[
    "AVAILABLE",
    "EN_ROUTE",
    "DEPLOYED",
    "BUSY",
    "OFFLINE",
]


class RescueTeamCreate(BaseModel):
    team_name: str = Field(min_length=2, max_length=150)
    organization: str | None = Field(default=None, max_length=150)
    team_type: str | None = Field(default="GENERAL", max_length=80)
    status: TeamStatus = "AVAILABLE"
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    contact_phone: str | None = Field(default=None, max_length=20)


class RescueTeamStatusUpdate(BaseModel):
    status: TeamStatus


@router.get("/rescue-teams/count")
async def get_rescue_team_counts(
    db: AsyncSession = Depends(get_db),
):
    try:
        query = text(
            """
            SELECT
                COUNT(*) FILTER (
                    WHERE UPPER(status) = 'AVAILABLE'
                ) AS available,

                COUNT(*) FILTER (
                    WHERE UPPER(status) = 'EN_ROUTE'
                ) AS en_route,

                COUNT(*) FILTER (
                    WHERE UPPER(status) = 'DEPLOYED'
                ) AS deployed,

                COUNT(*) FILTER (
                    WHERE UPPER(status) = 'BUSY'
                ) AS busy,

                COUNT(*) FILTER (
                    WHERE UPPER(status) = 'OFFLINE'
                ) AS offline,

                COUNT(*) AS total

            FROM rescue_teams
            """
        )

        result = await db.execute(query)
        row = result.mappings().one()

        return {
            "available": int(row["available"] or 0),
            "en_route": int(row["en_route"] or 0),
            "deployed": int(row["deployed"] or 0),
            "busy": int(row["busy"] or 0),
            "offline": int(row["offline"] or 0),
            "total": int(row["total"] or 0),
        }
    except Exception:
        return fallback_store.get_rescue_team_counts()


@router.get("/rescue-teams")
async def list_rescue_teams(
    status: TeamStatus | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    try:
        filters = ["1 = 1"]
        params = {"limit": limit, "offset": offset}

        if status:
            filters.append("UPPER(status) = UPPER(:status)")
            params["status"] = status

        where_clause = " AND ".join(filters)

        count_query = text(f"SELECT COUNT(*) FROM rescue_teams WHERE {where_clause}")
        count_result = await db.execute(count_query, params)
        total = count_result.scalar() or 0

        query = text(
            f"""
            SELECT
                id,
                team_name,
                organization,
                team_type,
                status,
                ST_Y(current_location::geometry) AS latitude,
                ST_X(current_location::geometry) AS longitude,
                contact_phone,
                created_at
            FROM rescue_teams
            WHERE {where_clause}
            ORDER BY team_name ASC
            LIMIT :limit OFFSET :offset
            """
        )

        result = await db.execute(query, params)
        items = [dict(row) for row in result.mappings().all()]

        return {
            "total": total,
            "items": items,
            "count": len(items),
            "limit": limit,
            "offset": offset,
        }
    except Exception:
        return fallback_store.get_rescue_teams(status=status, limit=limit, offset=offset)


@router.post("/rescue-teams")
async def create_rescue_team(
    team: RescueTeamCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        query = text(
            """
            INSERT INTO rescue_teams (
                team_name,
                organization,
                team_type,
                status,
                current_location,
                contact_phone
            )
            VALUES (
                :team_name,
                :organization,
                :team_type,
                :status,
                CASE
                    WHEN :latitude IS NOT NULL AND :longitude IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
                    ELSE NULL
                END,
                :contact_phone
            )
            RETURNING
                id,
                team_name,
                organization,
                team_type,
                status,
                contact_phone,
                created_at
            """
        )

        result = await db.execute(
            query,
            {
                "team_name": team.team_name,
                "organization": team.organization,
                "team_type": team.team_type,
                "status": team.status,
                "latitude": team.latitude,
                "longitude": team.longitude,
                "contact_phone": team.contact_phone,
            },
        )
        await db.commit()
        return dict(result.mappings().one())
    except Exception:
        return fallback_store.create_rescue_team(team.model_dump())


@router.patch("/rescue-teams/{team_id}/status")
async def update_rescue_team_status(
    team_id: UUID,
    payload: RescueTeamStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    try:
        query = text(
            """
            UPDATE rescue_teams
            SET status = :status
            WHERE id = :team_id
            RETURNING id, team_name, status
            """
        )
        result = await db.execute(query, {"team_id": team_id, "status": payload.status})
        await db.commit()
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Rescue team not found")
        return dict(row)
    except HTTPException:
        raise
    except Exception:
        # Fallback update
        team = next((t for t in fallback_store.rescue_teams if str(t["id"]) == str(team_id)), None)
        if not team:
            raise HTTPException(status_code=404, detail="Rescue team not found")
        team["status"] = payload.status
        return {"id": team["id"], "team_name": team["team_name"], "status": payload.status}
