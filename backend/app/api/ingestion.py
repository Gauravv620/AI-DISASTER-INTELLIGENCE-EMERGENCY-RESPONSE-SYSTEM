import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database.session import AsyncSessionLocal, get_db
from app.database.fallback_store import fallback_store
from app.ingestion.usgs import ingest_earthquakes
from app.ingestion.sachet import (
    SachetClient,
    ingest_sachet_alerts,
)





router = APIRouter(

    prefix="/ingestion",

    tags=["ingestion"],

)





# ============================================================

# USGS EARTHQUAKE INGESTION

# ============================================================



@router.get("/usgs")

async def usgs(

    min_lat: float = 6,

    max_lat: float = 38,

    min_lon: float = 68,

    max_lon: float = 98,

    min_magnitude: float = 2.5,

    db: AsyncSession = Depends(get_db),

):

    """

    Fetch real USGS earthquake events for India

    and store them in AIDERS/PostGIS.

    """



    if min_lat >= max_lat:

        raise HTTPException(

            status_code=400,

            detail="min_lat must be less than max_lat",

        )



    if min_lon >= max_lon:

        raise HTTPException(

            status_code=400,

            detail="min_lon must be less than max_lon",

        )



    if min_magnitude < 0:

        raise HTTPException(

            status_code=400,

            detail="min_magnitude cannot be negative",

        )



    try:

        return await ingest_earthquakes(

            db=db,

            min_lat=min_lat,

            max_lat=max_lat,

            min_lon=min_lon,

            max_lon=max_lon,

            min_magnitude=min_magnitude,

        )



    except Exception as exc:

        await db.rollback()



        raise HTTPException(

            status_code=502,

            detail=f"USGS ingestion failed: {exc}",

        )





# ============================================================

# LANDSLIDE INVENTORY

# ============================================================



@router.get("/landslides")

async def get_landslides(

    state: str | None = Query(default=None),

    district: str | None = Query(default=None),

    limit: int = Query(default=100, ge=1, le=1000),

    offset: int = Query(default=0, ge=0),

    db: AsyncSession = Depends(get_db),

):

    """

    Return GSI field-validated landslide inventory

    from PostgreSQL/PostGIS.

    """



    try:
        query = text("""
            SELECT
                id,
                sl_no,
                slide_no,
                state,
                district,
                slide_name,
                nh_sh_location,
                latitude,
                longitude,
                material_involved,
                movement_type,
                history,
                source_page,
                source_document,
                ST_Y(location::geometry) AS latitude_postgis,
                ST_X(location::geometry) AS longitude_postgis
            FROM landslide_inventory
            WHERE
                (CAST(:state AS TEXT) IS NULL OR state = :state)
                AND
                (CAST(:district AS TEXT) IS NULL OR district = :district)
            ORDER BY sl_no
            LIMIT :limit
            OFFSET :offset
        """)

        result = await db.execute(
            query,
            {
                "state": state,
                "district": district,
                "limit": limit,
                "offset": offset,
            },
        )

        rows = result.mappings().all()

        count_query = text("""
            SELECT COUNT(*)
            FROM landslide_inventory
            WHERE
                (CAST(:state AS TEXT) IS NULL OR state = :state)
                AND
                (CAST(:district AS TEXT) IS NULL OR district = :district)
        """)

        count_result = await db.execute(
            count_query,
            {
                "state": state,
                "district": district,
            },
        )

        total = count_result.scalar_one()

        return {
            "source": "GSI",
            "dataset": "Field-validated Landslide Inventory",
            "total": total,
            "limit": limit,
            "offset": offset,
            "records": [dict(row) for row in rows],
        }
    except Exception:
        return fallback_store.get_landslides(limit=limit, offset=offset)





# ============================================================

# NDMA SACHET RSS

# ============================================================



@router.get("/sachet/rss")

async def get_sachet_rss():

    """

    Fetch the official NDMA SACHET India CAP RSS feed.

    """



    client = SachetClient()



    try:

        return await client.fetch_rss()



    except Exception as exc:

        raise HTTPException(

            status_code=502,

            detail=f"SACHET RSS fetch failed: {exc}",

        )





# ============================================================

# NDMA SACHET CAP XML TEST

# ============================================================



@router.get("/sachet/test/{identifier}")

async def test_sachet(identifier: str):

    """

    Fetch and parse one detailed NDMA SACHET CAP XML alert.

    """



    client = SachetClient()



    try:

        return await client.fetch(identifier)



    except Exception as exc:

        raise HTTPException(

            status_code=502,

            detail=f"SACHET CAP fetch failed: {exc}",

        )





@router.post("/sachet/ingest")

async def ingest_sachet(

    db: AsyncSession = Depends(get_db),

):

    """

    Fetch NDMA SACHET alerts and store new alerts

    in government_alerts.

    """



    try:



        return await ingest_sachet_alerts(

            db=db

        )



    except Exception as exc:



        await db.rollback()



        raise HTTPException(

            status_code=502,

            detail=f"SACHET ingestion failed: {exc}",



        )

# ============================================================

# USGS EARTHQUAKE READ API

# ============================================================



@router.get("/earthquakes")

async def get_earthquakes(

    limit: int = Query(default=100, ge=1, le=1000),

    offset: int = Query(default=0, ge=0),

    min_magnitude: float | None = Query(default=None, ge=0),

    db: AsyncSession = Depends(get_db),

):

    """

    Return USGS earthquake incidents stored

    in PostgreSQL/PostGIS.



    Optional:

        min_magnitude - return earthquakes with

        magnitude >= specified value.

    """



    # --------------------------------------------------------

    # Query changes depending on whether a magnitude filter

    # was supplied. This avoids PostgreSQL NULL parameter

    # type ambiguity with asyncpg.

    # --------------------------------------------------------



    try:
        if min_magnitude is None:
            query = text("""
                SELECT
                    id,
                    incident_type,
                    magnitude,
                    severity,
                    status,
                    title,
                    description,
                    source,
                    external_event_id,
                    occurred_at,
                    ST_Y(location::geometry) AS latitude,
                    ST_X(location::geometry) AS longitude
                FROM incidents
                WHERE
                    source = 'USGS'
                    AND incident_type = 'EARTHQUAKE'
                ORDER BY occurred_at DESC
                LIMIT :limit
                OFFSET :offset
            """)

            result = await db.execute(
                query,
                {
                    "limit": limit,
                    "offset": offset,
                },
            )

            count_query = text("""
                SELECT COUNT(*)
                FROM incidents
                WHERE
                    source = 'USGS'
                    AND incident_type = 'EARTHQUAKE'
            """)

            count_result = await db.execute(count_query)

        else:
            query = text("""
                SELECT
                    id,
                    incident_type,
                    magnitude,
                    severity,
                    status,
                    title,
                    description,
                    source,
                    external_event_id,
                    occurred_at,
                    ST_Y(location::geometry) AS latitude,
                    ST_X(location::geometry) AS longitude
                FROM incidents
                WHERE
                    source = 'USGS'
                    AND incident_type = 'EARTHQUAKE'
                    AND magnitude >= :min_magnitude
                ORDER BY occurred_at DESC
                LIMIT :limit
                OFFSET :offset
            """)

            result = await db.execute(
                query,
                {
                    "min_magnitude": min_magnitude,
                    "limit": limit,
                    "offset": offset,
                },
            )

            count_query = text("""
                SELECT COUNT(*)
                FROM incidents
                WHERE
                    source = 'USGS'
                    AND incident_type = 'EARTHQUAKE'
                    AND magnitude >= :min_magnitude
            """)

            count_result = await db.execute(
                count_query,
                {
                    "min_magnitude": min_magnitude,
                },
            )

        rows = result.mappings().all()
        total = count_result.scalar_one()

        return {
            "source": "USGS",
            "dataset": "USGS Earthquake Catalog",
            "total": total,
            "limit": limit,
            "offset": offset,
            "min_magnitude": min_magnitude,
            "records": [dict(row) for row in rows],
        }
    except Exception:
        return fallback_store.get_earthquakes(limit=limit, offset=offset, min_magnitude=min_magnitude)







@router.get("/cwc/floods")

async def get_cwc_floods(

    state: str | None = None,

    district: str | None = None,

    station: str | None = None,

    river: str | None = None,

    limit: int = 100,

    offset: int = 0,

):

    """

    Return historical CWC river water-level observations.



    IMPORTANT:

    These are historical 2021-2025 observations and must not

    be interpreted as current/live flood conditions.

    """



    limit = min(max(limit, 1), 1000)
    offset = max(offset, 0)

    try:
        async with AsyncSessionLocal() as session:
            await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=0.5)
    except Exception:
        return fallback_store.get_cwc_rainfall(limit=limit, offset=offset)



    conditions = [

        "source = 'CWC'",

        "raw_payload->>'dataset' = 'CWC_RWL_2021_2025'",

    ]



    params = {

        "limit": limit,

        "offset": offset,

    }



    if state:

        conditions.append("LOWER(state) = LOWER(:state)")

        params["state"] = state



    if district:

        conditions.append("LOWER(district) = LOWER(:district)")

        params["district"] = district



    if station:

        conditions.append("LOWER(station_name) = LOWER(:station)")

        params["station"] = station



    if river:

        conditions.append("LOWER(river_name) = LOWER(:river)")

        params["river"] = river



    where_clause = " AND ".join(conditions)



    async with AsyncSessionLocal() as session:



        count_result = await session.execute(

            text(

                f"""

                SELECT COUNT(*)

                FROM cwc_flood_observations

                WHERE {where_clause}

                """

            ),

            params,

        )



        total = count_result.scalar_one()



        result = await session.execute(

            text(

                f"""

                SELECT

                    id,

                    station_name,

                    river_name,

                    district,

                    state,

                    water_level,

                    warning_level,

                    danger_level,

                    highest_flood_level,

                    trend,

                    flood_status,

                    observed_at,

                    latitude,

                    longitude,

                    ST_AsGeoJSON(geometry) AS geometry

                FROM cwc_flood_observations

                WHERE {where_clause}

                ORDER BY observed_at DESC

                LIMIT :limit

                OFFSET :offset

                """

            ),

            params,

        )



        rows = result.mappings().all()



    records = []



    for row in rows:

        record = dict(row)



        if record["id"] is not None:

            record["id"] = str(record["id"])



        if record["observed_at"] is not None:

            record["observed_at"] = (

                record["observed_at"].isoformat()

            )



        if record["geometry"] is not None:

            import json



            record["geometry"] = json.loads(

                record["geometry"]

            )



        records.append(record)



    return {

        "source": "CWC",

        "dataset": "CWC River Water Level Telemetry 2021-2025",

        "historical": True,

        "live": False,

        "total": total,

        "limit": limit,

        "offset": offset,

        "filters": {

            "state": state,

            "district": district,

            "station": station,

            "river": river,

        },

        "records": records,

    }





@router.get("/cwc/flood-summary")

async def get_cwc_flood_summary(

    db: AsyncSession = Depends(get_db),

):

    query = text(

        """

        SELECT

            COUNT(*) AS total,

            COUNT(*) FILTER (

                WHERE flood_status = 'ABOVE_NORMAL'

            ) AS above_normal,

            COUNT(*) FILTER (

                WHERE flood_status = 'SEVERE'

            ) AS severe,

            COUNT(*) FILTER (

                WHERE flood_status = 'EXTREME'

            ) AS extreme

        FROM cwc_flood_observations

        WHERE source = 'CWC'

        """

    )



    result = await db.execute(query)



    row = result.mappings().one()



    return {

        "source": "CWC",

        "total": row["total"],

        "above_normal": row["above_normal"],

        "severe": row["severe"],

        "extreme": row["extreme"],

    }





@router.get("/cwc/rainfall")

async def get_cwc_rainfall(

    state: str | None = None,

    district: str | None = None,

    station: str | None = None,

    limit: int = 100,

    offset: int = 0,

):

    """

    Return historical CWC rainfall observations.



    Dataset:

        CWC Maharashtra Manual Hourly Rainfall 2021-2025



    IMPORTANT:

        These are historical observations, not live rainfall data.

    """



    limit = min(max(limit, 1), 1000)
    offset = max(offset, 0)

    try:
        async with AsyncSessionLocal() as session:
            await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=0.5)
    except Exception:
        return fallback_store.get_cwc_rainfall(limit=limit, offset=offset)



    conditions = [

        "source = 'CWC'",

        "raw_payload->>'dataset' = 'CWC_RAINFALL_MH_2021_2025'",

    ]



    params = {

        "limit": limit,

        "offset": offset,

    }



    if state:

        conditions.append(

            "LOWER(state) = LOWER(:state)"

        )

        params["state"] = state



    if district:

        conditions.append(

            "LOWER(district) = LOWER(:district)"

        )

        params["district"] = district



    if station:

        conditions.append(

            "LOWER(station_name) = LOWER(:station)"

        )

        params["station"] = station



    where_clause = " AND ".join(conditions)



    async with AsyncSessionLocal() as session:



        # -----------------------------------------------------------

        # Total count

        # -----------------------------------------------------------



        count_result = await session.execute(

            text(

                f"""

                SELECT COUNT(*)

                FROM cwc_rainfall_observations

                WHERE {where_clause}

                """

            ),

            params,

        )



        total = count_result.scalar_one()



        # -----------------------------------------------------------

        # Data

        # -----------------------------------------------------------



        result = await session.execute(

            text(

                f"""

                SELECT

                    id,

                    station_name,

                    state,

                    district,

                    tehsil,

                    block,

                    village,

                    river_name,

                    basin,

                    latitude,

                    longitude,

                    rainfall_mm,

                    observed_at

                FROM cwc_rainfall_observations

                WHERE {where_clause}

                ORDER BY observed_at DESC

                LIMIT :limit

                OFFSET :offset

                """

            ),

            params,

        )



        rows = result.mappings().all()



    records = []



    for row in rows:



        record = dict(row)



        if record["id"] is not None:

            record["id"] = str(record["id"])



        if record["observed_at"] is not None:

            record["observed_at"] = (

                record["observed_at"].isoformat()

            )



        records.append(record)



    return {

        "source": "CWC",

        "dataset": (

            "CWC Maharashtra Manual "

            "Hourly Rainfall 2021-2025"

        ),

        "historical": True,

        "live": False,

        "total": total,

        "limit": limit,

        "offset": offset,

        "filters": {
            "state": state,
            "district": district,
            "station": station,
        },
        "records": records,
    }







@router.get("/cwc/stations")

async def get_cwc_latest_stations(

    state: Optional[str] = None,

    district: Optional[str] = None,

    limit: int = 500,

    offset: int = 0,

    db: AsyncSession = Depends(get_db),

):

    """

    Return the latest available historical CWC water-level

    observation for each station.



    The underlying table contains the complete historical

    CWC dataset. This endpoint only returns the latest

    observation per station for efficient map visualization.

    """



    limit = max(1, min(limit, 1000))
    offset = max(0, offset)

    try:
        await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=0.5)
    except Exception:
        return fallback_store.get_cwc_stations(limit=limit, offset=offset)



    filters = [

        "source = 'CWC'",

        "raw_payload->>'dataset' = 'CWC_RWL_2021_2025'",

        "latitude IS NOT NULL",

        "longitude IS NOT NULL",

    ]



    params = {

        "limit": limit,

        "offset": offset,

    }



    if state:

        filters.append("state = :state")

        params["state"] = state



    if district:

        filters.append("district = :district")

        params["district"] = district



    where_clause = " AND ".join(filters)



    count_query = text(

        f"""

        SELECT COUNT(*)

        FROM (

            SELECT DISTINCT ON (

                station_name,

                state,

                district,

                river_name

            )

                station_name,

                state,

                district,

                river_name

            FROM cwc_flood_observations

            WHERE {where_clause}

            ORDER BY

                station_name,

                state,

                district,

                river_name,

                observed_at DESC NULLS LAST

        ) AS stations

        """

    )



    count_result = await db.execute(

        count_query,

        params,

    )



    total = int(

        count_result.scalar() or 0

    )



    data_query = text(

        f"""

        SELECT

            id,

            station_name,

            river_name,

            district,

            state,

            water_level,

            warning_level,

            danger_level,

            highest_flood_level,

            trend,

            flood_status,

            observed_at,

            latitude,

            longitude

        FROM (

            SELECT DISTINCT ON (

                station_name,

                state,

                district,

                river_name

            )

                id,

                station_name,

                river_name,

                district,

                state,

                water_level,

                warning_level,

                danger_level,

                highest_flood_level,

                trend,

                flood_status,

                observed_at,

                latitude,

                longitude

            FROM cwc_flood_observations

            WHERE {where_clause}

            ORDER BY

                station_name,

                state,

                district,

                river_name,

                observed_at DESC NULLS LAST

        ) AS latest_stations

        ORDER BY

            state,

            district,

            station_name

        LIMIT :limit

        OFFSET :offset

        """

    )



    result = await db.execute(

        data_query,

        params,

    )



    records = [

        dict(row)

        for row in result.mappings().all()

    ]



    return {

        "source": "CWC",

        "dataset": "CWC River Water Level Telemetry 2021-2025",

        "historical": True,

        "mode": "latest_observation_per_station",

        "total_stations": total,

        "limit": limit,
        "offset": offset,
        "records": records,
    }



# ============================================================
# CWC STATION HISTORY
# ============================================================

@router.get("/cwc/stations/{station_name}/history")
async def get_cwc_station_history(
    station_name: str,
    state: Optional[str] = None,
    district: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    Return historical CWC water-level observations
    for a specific station.

    Source:
        CWC River Water Level Telemetry 2021-2025

    This endpoint does not calculate or invent
    warning/danger thresholds.
    """

    # Keep pagination safe
    limit = max(1, min(limit, 1000))
    offset = max(0, offset)

    filters = [
        "source = 'CWC'",
        "raw_payload->>'dataset' = 'CWC_RWL_2021_2025'",
        "station_name = :station_name",
        "latitude IS NOT NULL",
        "longitude IS NOT NULL",
    ]

    params = {
        "station_name": station_name,
        "limit": limit,
        "offset": offset,
    }

    if state:
        filters.append("state = :state")
        params["state"] = state

    if district:
        filters.append("district = :district")
        params["district"] = district

    where_clause = " AND ".join(filters)

    # --------------------------------------------------------
    # Total historical observations for this station
    # --------------------------------------------------------

    count_query = text(
        f"""
        SELECT COUNT(*)
        FROM cwc_flood_observations
        WHERE {where_clause}
        """
    )

    count_result = await db.execute(
        count_query,
        params
    )

    total = int(count_result.scalar() or 0)

    # --------------------------------------------------------
    # Historical observations
    # --------------------------------------------------------

    data_query = text(
        f"""
        SELECT
            id,
            station_name,
            river_name,
            district,
            state,
            water_level,
            warning_level,
            danger_level,
            highest_flood_level,
            trend,
            flood_status,
            observed_at,
            latitude,
            longitude
        FROM cwc_flood_observations
        WHERE {where_clause}
        ORDER BY observed_at DESC NULLS LAST
        LIMIT :limit
        OFFSET :offset
        """
    )

    result = await db.execute(
        data_query,
        params
    )

    records = [
        dict(row)
        for row in result.mappings().all()
    ]

    return {
        "source": "CWC",
        "dataset": "CWC River Water Level Telemetry 2021-2025",
        "historical": True,
        "station_name": station_name,
        "state": state,
        "district": district,
        "total_records": total,
        "limit": limit,
        "offset": offset,
        "records": records,
    }







# ============================================================
# AIDERS FLOOD INTELLIGENCE ENGINE
# ============================================================

@router.get("/intelligence/flood-risk")
async def get_flood_risk(
    state: Optional[str] = None,
    district: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """
    AIDERS-derived flood risk intelligence.

    IMPORTANT:
    This is an AIDERS analytical score based on available historical
    CWC observations and matching SACHET alerts. It is NOT an official
    CWC/NDMA warning or forecast.
    """

    limit = max(1, min(limit, 200))

    try:
        await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=0.5)
    except Exception:
        return fallback_store.get_flood_risk(limit=limit)

    # ------------------------------------------------------------
    # 1. Get latest observation for each CWC station
    # ------------------------------------------------------------

    filters = [
        "source = 'CWC'",
        "raw_payload->>'dataset' = 'CWC_RWL_2021_2025'",
        "latitude IS NOT NULL",
        "longitude IS NOT NULL",
    ]

    params = {"limit": limit}

    if state:
        filters.append("state = :state")
        params["state"] = state

    if district:
        filters.append("district = :district")
        params["district"] = district

    where_clause = " AND ".join(filters)

    station_sql = text(
        f"""
        SELECT DISTINCT ON (
            station_name,
            state,
            district,
            river_name
        )
            station_name,
            river_name,
            district,
            state,
            water_level,
            warning_level,
            danger_level,
            highest_flood_level,
            trend,
            flood_status,
            observed_at,
            latitude,
            longitude
        FROM cwc_flood_observations
        WHERE {where_clause}
        ORDER BY
            station_name,
            state,
            district,
            river_name,
            observed_at DESC NULLS LAST
        LIMIT :limit
        """
    )

    station_result = await db.execute(station_sql, params)
    stations = [dict(row) for row in station_result.mappings().all()]

    if not stations:
        return {
            "source": "AIDERS",
            "dataset": "AIDERS Flood Intelligence",
            "derived": True,
            "method": "CWC historical water-level analysis + SACHET alert correlation",
            "total": 0,
            "records": [],
        }

    # ------------------------------------------------------------
    # 2. Get SACHET alerts
    # ------------------------------------------------------------

    alert_result = await db.execute(
        text(
            """
            SELECT
                external_id,
                alert_type,
                headline,
                severity,
                urgency,
                certainty,
                area_name,
                effective_at,
                expires_at
            FROM government_alerts
            WHERE source = 'SACHET'
            ORDER BY created_at DESC
            LIMIT 500
            """
        )
    )

    alerts = [dict(row) for row in alert_result.mappings().all()]

    # ------------------------------------------------------------
    # Helper functions
    # ------------------------------------------------------------

    def safe_float(value):
        try:
            if value is None:
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    def text_contains(value, terms):
        value = str(value or "").lower()
        return any(term in value for term in terms)

    # Flood-related SACHET terminology.
    flood_terms = [
        "flood",
        "heavy rain",
        "very heavy rain",
        "extremely heavy rain",
        "waterlogging",
        "water logging",
        "river",
        "inundation",
        "flash flood",
    ]

    severity_points = {
        "minor": 5,
        "moderate": 10,
        "severe": 15,
        "extreme": 20,
    }

    records = []

    # ------------------------------------------------------------
    # 3. Analyse every station
    # ------------------------------------------------------------

    for station in stations:

        station_name = station["station_name"]
        station_state = station["state"]
        station_district = station["district"]

        current_level = safe_float(station["water_level"])

        # --------------------------------------------------------
        # Historical station values
        # --------------------------------------------------------

        history_result = await db.execute(
            text(
                """
                SELECT water_level
                FROM cwc_flood_observations
                WHERE source = 'CWC'
                  AND raw_payload->>'dataset' = 'CWC_RWL_2021_2025'
                  AND station_name = :station_name
                  AND state = :state
                  AND district = :district
                  AND water_level IS NOT NULL
                ORDER BY observed_at DESC
                LIMIT 500
                """
            ),
            {
                "station_name": station_name,
                "state": station_state,
                "district": station_district,
            },
        )

        historical_levels = []

        for row in history_result.mappings().all():
            value = safe_float(row["water_level"])
            if value is not None:
                historical_levels.append(value)

        # --------------------------------------------------------
        # Historical percentile
        # --------------------------------------------------------

        percentile = None

        if current_level is not None and historical_levels:
            below_or_equal = sum(
                1 for value in historical_levels
                if value <= current_level
            )

            percentile = round(
                (below_or_equal / len(historical_levels)) * 100,
                1,
            )

        # --------------------------------------------------------
        # Recent trend
        # --------------------------------------------------------

        trend_result = await db.execute(
            text(
                """
                SELECT water_level, observed_at
                FROM cwc_flood_observations
                WHERE source = 'CWC'
                  AND raw_payload->>'dataset' = 'CWC_RWL_2021_2025'
                  AND station_name = :station_name
                  AND state = :state
                  AND district = :district
                  AND water_level IS NOT NULL
                ORDER BY observed_at DESC
                LIMIT 6
                """
            ),
            {
                "station_name": station_name,
                "state": station_state,
                "district": station_district,
            },
        )

        recent = [
            safe_float(row["water_level"])
            for row in trend_result.mappings().all()
        ]

        recent = [value for value in recent if value is not None]

        trend_change = None

        if len(recent) >= 2:
            trend_change = round(recent[0] - recent[-1], 3)

        # --------------------------------------------------------
        # AIDERS water-level component
        #
        # No official warning/danger threshold is invented.
        # Percentile is calculated only from this station's
        # historical CWC observations.
        # --------------------------------------------------------

        water_score = 0

        if percentile is not None:

            if percentile >= 95:
                water_score = 60
            elif percentile >= 90:
                water_score = 50
            elif percentile >= 75:
                water_score = 35
            elif percentile >= 50:
                water_score = 20
            else:
                water_score = 10

        # --------------------------------------------------------
        # Trend component
        # --------------------------------------------------------

        trend_score = 0

        if trend_change is not None:

            if trend_change > 1.0:
                trend_score = 20
            elif trend_change > 0.5:
                trend_score = 15
            elif trend_change > 0.1:
                trend_score = 8
            elif trend_change > 0:
                trend_score = 4

        # --------------------------------------------------------
        # SACHET correlation
        # --------------------------------------------------------

        matching_alerts = []

        for alert in alerts:

            area = str(alert.get("area_name") or "").lower()
            headline = str(alert.get("headline") or "").lower()
            alert_type = str(alert.get("alert_type") or "").lower()

            location_match = (
                str(station_state or "").lower() in area
                or str(station_district or "").lower() in area
            )

            disaster_match = (
                text_contains(area, flood_terms)
                or text_contains(headline, flood_terms)
                or text_contains(alert_type, flood_terms)
            )

            if location_match and disaster_match:
                matching_alerts.append(alert)

        sachet_score = 0

        for alert in matching_alerts:

            severity = str(
                alert.get("severity") or ""
            ).lower()

            points = severity_points.get(severity, 0)

            sachet_score = max(
                sachet_score,
                points,
            )

        # --------------------------------------------------------
        # Final AIDERS-derived score
        # --------------------------------------------------------

        score = min(
            100,
            water_score + trend_score + sachet_score,
        )

        if score >= 80:
            risk_level = "CRITICAL"
        elif score >= 60:
            risk_level = "HIGH"
        elif score >= 35:
            risk_level = "MODERATE"
        else:
            risk_level = "LOW"

        # --------------------------------------------------------
        # Explain why the station received this score
        # --------------------------------------------------------

        factors = []

        if percentile is not None:
            factors.append(
                f"Current level is at the "
                f"{percentile}th historical percentile."
            )

        if trend_change is not None:
            if trend_change > 0:
                factors.append(
                    f"Recent water level increased by "
                    f"{trend_change:.3f} m across the latest observations."
                )
            elif trend_change < 0:
                factors.append(
                    f"Recent water level decreased by "
                    f"{abs(trend_change):.3f} m across the latest observations."
                )
            else:
                factors.append(
                    "Recent water level is approximately stable."
                )

        if matching_alerts:
            factors.append(
                f"{len(matching_alerts)} matching SACHET "
                f"flood/rain-related alert(s) found."
            )

        if not factors:
            factors.append(
                "Insufficient historical signals for a stronger assessment."
            )

        records.append(
            {
                "station_name": station_name,
                "river_name": station["river_name"],
                "district": station_district,
                "state": station_state,
                "latitude": station["latitude"],
                "longitude": station["longitude"],
                "current_water_level": current_level,
                "historical_percentile": percentile,
                "recent_change_m": trend_change,
                "water_level_score": water_score,
                "trend_score": trend_score,
                "sachet_score": sachet_score,
                "risk_score": score,
                "risk_level": risk_level,
                "historical_observations": len(historical_levels),
                "matching_sachet_alerts": len(matching_alerts),
                "factors": factors,
                "observed_at": station["observed_at"],
                "data_status": "HISTORICAL_CWC",
            }
        )

    # Highest risk first
    records.sort(
        key=lambda item: item["risk_score"],
        reverse=True,
    )

    # ------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------

    summary = {
        "critical": sum(
            1 for item in records
            if item["risk_level"] == "CRITICAL"
        ),
        "high": sum(
            1 for item in records
            if item["risk_level"] == "HIGH"
        ),
        "moderate": sum(
            1 for item in records
            if item["risk_level"] == "MODERATE"
        ),
        "low": sum(
            1 for item in records
            if item["risk_level"] == "LOW"
        ),
    }

    return {
        "source": "AIDERS",
        "dataset": "AIDERS Flood Intelligence",
        "derived": True,
        "official_sources": [
            "CWC River Water Level Telemetry 2021-2025",
            "NDMA SACHET",
        ],
        "method": (
            "Historical CWC station percentile + recent "
            "water-level change + SACHET flood/rain alert correlation"
        ),
        "warning": (
            "AIDERS-derived analytical score. "
            "This is not an official CWC or NDMA warning."
        ),
        "historical_data_note": (
            "CWC water-level observations used by this engine "
            "are historical 2021-2025 data."
        ),
        "total": len(records),
        "summary": summary,
        "records": records,
    }