"""
CWC historical dataset ingestion for AIDERS.

Sources:
- CWC River Water Level Telemetry Hourly 2021-2025 CSV
- CWC Maharashtra Manual Hourly Rainfall 2021-2025 CSV

Important:
These files are historical datasets ending in 2025.
They must NOT be presented as live/current observations.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy import text

from app.database.session import AsyncSessionLocal


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[3]
CWC_DIR = BASE_DIR / "data" / "cwc"

WATER_LEVEL_FILE = (
    CWC_DIR / "rwl_tel_hr_cwc_007_2021_2025.csv"
)

RAINFALL_FILE = (
    CWC_DIR / "rainfall_manual_hr_cwc_mh_2021_2025.csv"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean(value):
    """
    Convert pandas NaN/NaT values to Python None.
    """
    if pd.isna(value):
        return None

    return value


def _jsonable(row: pd.Series) -> dict:
    """
    Convert a pandas Series into a JSON-safe dictionary.
    """
    result = {}

    for key, value in row.items():
        value = _clean(value)

        if hasattr(value, "item"):
            value = value.item()

        result[str(key)] = value

    return result


# ---------------------------------------------------------------------------
# CWC WATER LEVEL INGESTION
# ---------------------------------------------------------------------------

async def ingest_cwc_water_levels(
    csv_path: Optional[Path] = None,
    chunk_size: int = 10000,
) -> dict:
    """
    Batch-import CWC historical river water-level observations.

    Dataset:
        CWC River Water Level Telemetry Hourly 2021-2025

    The CSV contains:
        Station
        State
        District
        Tehsil
        Block
        Village
        River
        Basin
        Latitude
        Longitude
        Data Acquisition Time
        River Water Level Telemetry Hourly (meter)

    Warning/danger levels are NOT present in the supplied dataset,
    so they remain NULL rather than being fabricated.
    """

    path = Path(csv_path or WATER_LEVEL_FILE)

    if not path.exists():
        raise FileNotFoundError(
            f"CWC water-level CSV not found: {path}"
        )

    inserted = 0
    skipped = 0

    async with AsyncSessionLocal() as session:

        # ---------------------------------------------------------------
        # Remove only records imported from this exact historical dataset.
        # This makes re-running the importer safe.
        # ---------------------------------------------------------------

        await session.execute(
            text(
                """
                DELETE FROM cwc_flood_observations
                WHERE source = 'CWC'
                  AND raw_payload->>'dataset' =
                      'CWC_RWL_2021_2025'
                """
            )
        )

        await session.commit()

        # ---------------------------------------------------------------
        # Read the CSV in chunks.
        # ---------------------------------------------------------------

        for chunk in pd.read_csv(
            path,
            chunksize=chunk_size,
        ):

            # -----------------------------------------------------------
            # Parse timestamps for the entire chunk.
            # -----------------------------------------------------------

            chunk["_observed_at"] = pd.to_datetime(
                chunk["Data Acquisition Time"],
                dayfirst=True,
                errors="coerce",
            )

            records = []

            # -----------------------------------------------------------
            # Build batch records.
            # -----------------------------------------------------------

            for _, row in chunk.iterrows():

                station = _clean(
                    row.get("Station")
                )

                level = _clean(
                    row.get(
                        "River Water Level Telemetry Hourly (meter)"
                    )
                )

                # Station and water level are required.
                if station is None or level is None:
                    skipped += 1
                    continue

                latitude = _clean(
                    row.get("Latitude")
                )

                longitude = _clean(
                    row.get("Longitude")
                )

                payload = _jsonable(row)

                # Internal pandas timestamp should not be stored.
                payload.pop(
                    "_observed_at",
                    None,
                )

                payload["dataset"] = (
                    "CWC_RWL_2021_2025"
                )

                observed_at = row["_observed_at"]

                if pd.notna(observed_at):
                    observed_at = (
                        observed_at.to_pydatetime()
                    )
                else:
                    observed_at = None

                records.append(
                    {
                        "station_name": str(station),

                        "river_name": _clean(
                            row.get("River")
                        ),

                        "district": _clean(
                            row.get("District")
                        ),

                        "state": _clean(
                            row.get("State")
                        ),

                        "water_level": float(level),

                        # These fields are not provided
                        # by the supplied dataset.
                        "warning_level": None,
                        "danger_level": None,
                        "highest_flood_level": None,
                        "trend": None,

                        "flood_status": "HISTORICAL",

                        "observed_at": observed_at,

                        "latitude": (
                            float(latitude)
                            if latitude is not None
                            else None
                        ),

                        "longitude": (
                            float(longitude)
                            if longitude is not None
                            else None
                        ),

                        "raw_payload": json.dumps(
                            payload,
                            default=str,
                        ),
                    }
                )

            # -----------------------------------------------------------
            # Batch INSERT.
            #
            # IMPORTANT:
            # Geometry is intentionally inserted as NULL here.
            # This avoids asyncpg's ambiguous NULL parameter problem.
            # Geometry is populated by the UPDATE immediately afterward.
            # -----------------------------------------------------------

            if records:

                await session.execute(
                    text(
                        """
                        INSERT INTO cwc_flood_observations
                        (
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
                            geometry,
                            raw_payload
                        )
                        VALUES
                        (
                            :station_name,
                            :river_name,
                            :district,
                            :state,
                            :water_level,
                            :warning_level,
                            :danger_level,
                            :highest_flood_level,
                            :trend,
                            :flood_status,
                            :observed_at,
                            :latitude,
                            :longitude,
                            NULL,
                            CAST(:raw_payload AS jsonb)
                        )
                        """
                    ),
                    records,
                )

                # -------------------------------------------------------
                # Create PostGIS POINT geometry using actual columns.
                #
                # longitude = X
                # latitude  = Y
                # SRID      = 4326
                # -------------------------------------------------------

                await session.execute(
                    text(
                        """
                        UPDATE cwc_flood_observations
                        SET geometry =
                            ST_SetSRID(
                                ST_MakePoint(
                                    longitude,
                                    latitude
                                ),
                                4326
                            )::geography
                        WHERE geometry IS NULL
                          AND latitude IS NOT NULL
                          AND longitude IS NOT NULL
                          AND source = 'CWC'
                          AND raw_payload->>'dataset' =
                              'CWC_RWL_2021_2025'
                        """
                    )
                )

                await session.commit()

                inserted += len(records)

                print(
                    "CWC water-level progress: "
                    f"{inserted:,} records inserted"
                )

    return {
        "source": "CWC",
        "dataset": (
            "CWC River Water Level "
            "Telemetry 2021-2025"
        ),
        "inserted": inserted,
        "skipped": skipped,
        "historical": True,
    }


# ---------------------------------------------------------------------------
# CWC RAINFALL INGESTION
# ---------------------------------------------------------------------------

async def ingest_cwc_rainfall(
    csv_path: Optional[Path] = None,
    chunk_size: int = 10000,
) -> dict:
    """
    Batch-import CWC Maharashtra historical rainfall observations.

    Dataset:
        CWC Maharashtra Manual Hourly Rainfall 2021-2025

    Rainfall is stored separately from water-level observations.
    """

    path = Path(csv_path or RAINFALL_FILE)

    if not path.exists():
        raise FileNotFoundError(
            f"CWC rainfall CSV not found: {path}"
        )

    inserted = 0
    skipped = 0

    async with AsyncSessionLocal() as session:

        # ---------------------------------------------------------------
        # Remove only this historical dataset.
        # ---------------------------------------------------------------

        await session.execute(
            text(
                """
                DELETE FROM cwc_rainfall_observations
                WHERE source = 'CWC'
                  AND raw_payload->>'dataset' =
                      'CWC_RAINFALL_MH_2021_2025'
                """
            )
        )

        await session.commit()

        # ---------------------------------------------------------------
        # Read rainfall CSV in chunks.
        # ---------------------------------------------------------------

        for chunk in pd.read_csv(
            path,
            chunksize=chunk_size,
        ):

            chunk["_observed_at"] = pd.to_datetime(
                chunk["Data Acquisition Time"],
                dayfirst=True,
                errors="coerce",
            )

            records = []

            for _, row in chunk.iterrows():

                station = _clean(
                    row.get("Station")
                )

                rainfall = _clean(
                    row.get(
                        "Manual Hourly Rainfall (mm)"
                    )
                )

                if station is None or rainfall is None:
                    skipped += 1
                    continue

                latitude = _clean(
                    row.get("Latitude")
                )

                longitude = _clean(
                    row.get("Longitude")
                )

                observed_at = row["_observed_at"]

                if pd.notna(observed_at):
                    observed_at = (
                        observed_at.to_pydatetime()
                    )
                else:
                    observed_at = None

                payload = _jsonable(row)

                payload.pop(
                    "_observed_at",
                    None,
                )

                payload["dataset"] = (
                    "CWC_RAINFALL_MH_2021_2025"
                )

                records.append(
                    {
                        "station_name": str(station),

                        "state": _clean(
                            row.get("State")
                        ),

                        "district": _clean(
                            row.get("District")
                        ),

                        "tehsil": _clean(
                            row.get("Tehsil")
                        ),

                        "block": _clean(
                            row.get("Block")
                        ),

                        "village": _clean(
                            row.get("Village")
                        ),

                        "river_name": _clean(
                            row.get("River")
                        ),

                        "basin": _clean(
                            row.get("Basin")
                        ),

                        "latitude": (
                            float(latitude)
                            if latitude is not None
                            else None
                        ),

                        "longitude": (
                            float(longitude)
                            if longitude is not None
                            else None
                        ),

                        "rainfall_mm": float(
                            rainfall
                        ),

                        "observed_at": observed_at,

                        "raw_payload": json.dumps(
                            payload,
                            default=str,
                        ),
                    }
                )

            # -----------------------------------------------------------
            # Batch INSERT rainfall records.
            # -----------------------------------------------------------

            if records:

                await session.execute(
                    text(
                        """
                        INSERT INTO cwc_rainfall_observations
                        (
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
                            observed_at,
                            raw_payload
                        )
                        VALUES
                        (
                            :station_name,
                            :state,
                            :district,
                            :tehsil,
                            :block,
                            :village,
                            :river_name,
                            :basin,
                            :latitude,
                            :longitude,
                            :rainfall_mm,
                            :observed_at,
                            CAST(:raw_payload AS jsonb)
                        )
                        """
                    ),
                    records,
                )

                await session.commit()

                inserted += len(records)

                print(
                    "CWC rainfall progress: "
                    f"{inserted:,} records inserted"
                )

    return {
        "source": "CWC",
        "dataset": (
            "CWC Maharashtra Manual "
            "Hourly Rainfall 2021-2025"
        ),
        "inserted": inserted,
        "skipped": skipped,
        "historical": True,
    }