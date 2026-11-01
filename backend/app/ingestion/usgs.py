from datetime import datetime, timezone

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"


def calculate_severity(magnitude: float | None) -> str:
    """
    Convert earthquake magnitude into an AIDERS
    preliminary severity.

    This is an internal risk-prioritization rule.
    It does NOT override official government warnings.
    """
    if magnitude is None:
        return "LOW"

    if magnitude >= 6.0:
        return "CRITICAL"
    elif magnitude >= 5.0:
        return "HIGH"
    elif magnitude >= 4.0:
        return "MEDIUM"

    return "LOW"


async def fetch_earthquakes(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    min_magnitude: float = 2.5,
):
    params = {
        "format": "geojson",
        "minlatitude": min_lat,
        "maxlatitude": max_lat,
        "minlongitude": min_lon,
        "maxlongitude": max_lon,
        "minmagnitude": min_magnitude,
        "orderby": "time",
        "limit": 200,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            USGS_URL,
            params=params,
        )

        response.raise_for_status()

        return response.json()


async def ingest_earthquakes(
    db: AsyncSession,
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    min_magnitude: float = 2.5,
):
    data = await fetch_earthquakes(
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        min_magnitude=min_magnitude,
    )

    features = data.get("features", [])

    inserted = 0
    skipped = 0

    for feature in features:
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}

        coordinates = geometry.get("coordinates") or []

        if len(coordinates) < 2:
            skipped += 1
            continue

        longitude = coordinates[0]
        latitude = coordinates[1]

        event_id = feature.get("id")

        if not event_id:
            skipped += 1
            continue

        magnitude = properties.get("mag")
        place = properties.get("place") or "Unknown location"
        title = properties.get("title") or f"Earthquake near {place}"

        event_time_ms = properties.get("time")

        occurred_at = None

        if event_time_ms is not None:
            occurred_at = datetime.fromtimestamp(
                event_time_ms / 1000,
                tz=timezone.utc,
            )

        severity = calculate_severity(magnitude)

        query = text("""
            INSERT INTO incidents (
    incident_type,
    severity,
    status,
    title,
    description,
    source,
    external_event_id,
    location,
    occurred_at,
    magnitude
)
            VALUES (
                'EARTHQUAKE',
                :severity,
                'OPEN',
                :title,
                :description,
                'USGS',
                :external_event_id,
                ST_SetSRID(
                    ST_MakePoint(
                        :longitude,
                        :latitude
                    ),
                    4326
                )::geography,
                :occurred_at,
                :magnitude
            )
            ON CONFLICT (source, external_event_id)
            DO NOTHING
            RETURNING id
        """)

        result = await db.execute(
            query,
            {
                "severity": severity,
                "title": title,
                "description": (
                    f"USGS earthquake event. "
                    f"Magnitude: {magnitude}. "
                    f"Location: {place}."
                ),
                "external_event_id": event_id,
                "longitude": longitude,
                "latitude": latitude,
                "occurred_at": occurred_at,
                "magnitude": magnitude,
            },
        )

        inserted_id = result.scalar_one_or_none()

        if inserted_id:
            inserted += 1
        else:
            skipped += 1

    await db.commit()

    return {
        "source": "USGS",
        "fetched": len(features),
        "inserted": inserted,
        "skipped_duplicates_or_invalid": skipped,
    }