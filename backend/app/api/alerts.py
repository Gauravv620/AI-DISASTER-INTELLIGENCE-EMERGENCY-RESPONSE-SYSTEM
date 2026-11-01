from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.database.fallback_store import fallback_store


router = APIRouter(
    prefix="/alerts",
    tags=["alerts"],
)


@router.get("")
async def get_alerts(
    source: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Return government disaster alerts from PostgreSQL or resilient fallback store.

    Sources supported: SACHET, IMD, CWC, USGS.
    """
    try:
        query = text("""
            SELECT
                id,
                source,
                external_id,
                alert_type,
                headline,
                description,
                severity,
                urgency,
                certainty,
                issued_at,
                effective_at,
                expires_at,
                area_name,
                ST_AsGeoJSON(geometry) AS geometry,
                raw_payload,
                created_at
            FROM government_alerts
            WHERE
                (CAST(:source AS TEXT) IS NULL OR source = :source)
                AND
                (CAST(:severity AS TEXT) IS NULL OR severity = :severity)
            ORDER BY issued_at DESC NULLS LAST, created_at DESC
            LIMIT :limit
            OFFSET :offset
        """)

        result = await db.execute(
            query,
            {
                "source": source,
                "severity": severity,
                "limit": limit,
                "offset": offset,
            },
        )

        rows = result.mappings().all()

        count_query = text("""
            SELECT COUNT(*)
            FROM government_alerts
            WHERE
                (CAST(:source AS TEXT) IS NULL OR source = :source)
                AND
                (CAST(:severity AS TEXT) IS NULL OR severity = :severity)
        """)

        count_result = await db.execute(
            count_query,
            {
                "source": source,
                "severity": severity,
            },
        )

        total = count_result.scalar_one()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "alerts": [dict(row) for row in rows],
        }
    except Exception:
        return fallback_store.get_alerts(
            source=source,
            severity=severity,
            limit=limit,
            offset=offset,
        )
