from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.database.fallback_store import fallback_store


router = APIRouter(tags=["officials"])


class OfficialCreate(BaseModel):
    official_id: str = Field(min_length=2, max_length=100)
    full_name: str = Field(min_length=2, max_length=200)
    password_hash: str = Field(min_length=1)
    role: str = Field(min_length=2, max_length=40)
    department: Optional[str] = Field(default=None, max_length=150)
    mobile: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=255)
    mfa_enabled: bool = True


class OfficialStatusUpdate(BaseModel):
    is_active: bool


@router.get("/officials")
async def list_officials(
    active_only: bool = True,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    try:
        where_clause = "WHERE is_active = TRUE" if active_only else ""

        count_query = text(
            f"""
            SELECT COUNT(*) AS total
            FROM officials
            {where_clause}
            """
        )

        result = await db.execute(count_query)
        total = int(result.scalar() or 0)

        query = text(
            f"""
            SELECT
                id,
                official_id,
                full_name,
                role,
                department,
                mobile,
                email,
                is_active,
                mfa_enabled,
                failed_login_attempts,
                created_at
            FROM officials
            {where_clause}
            ORDER BY full_name ASC
            LIMIT :limit OFFSET :offset
            """
        )

        result = await db.execute(query, {"limit": limit, "offset": offset})
        officials = [dict(row) for row in result.mappings().all()]

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "officials": officials,
        }
    except Exception:
        return fallback_store.get_officials(active_only=active_only, limit=limit, offset=offset)
