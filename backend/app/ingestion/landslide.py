import math
from pathlib import Path

import pandas as pd
from sqlalchemy import text

from app.database.session import AsyncSessionLocal


# Existing AIDERS project root:
# aiders/
# ├── backend/
# └── data/
#     └── landslides/
#         └── gsi_landslide_inventory.csv

PROJECT_ROOT = Path(__file__).resolve().parents[3]

CSV_PATH = (
    PROJECT_ROOT
    / "data"
    / "landslides"
    / "gsi_landslide_inventory.csv"
)


def clean_value(value):
    """Convert pandas NaN/empty values to None."""
    if pd.isna(value):
        return None

    value = str(value).strip()

    if not value or value.lower() == "nan":
        return None

    return value


def clean_int(value):
    """Safely convert a value to integer."""
    if pd.isna(value):
        return None

    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def clean_coordinate(value):
    """Safely convert latitude/longitude to float."""
    if pd.isna(value):
        return None

    try:
        number = float(value)

        if not math.isfinite(number):
            return None

        return number

    except (ValueError, TypeError):
        return None


def valid_coordinates(latitude, longitude):
    """Validate geographic coordinates."""

    if latitude is None or longitude is None:
        return False

    return (
        -90 <= latitude <= 90
        and -180 <= longitude <= 180
    )


async def import_gsi_landslides():
    """Import the GSI field-validated landslide inventory."""

    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"GSI landslide CSV not found: {CSV_PATH}"
        )

    print(f"Reading: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)

    print(f"CSV records found: {len(df)}")

    required_columns = [
        "sl_no",
        "slide_no",
        "state",
        "district",
        "slide_name",
        "nh_sh_location",
        "latitude",
        "longitude",
        "material_involved",
        "movement_type",
        "history",
        "source_page",
        "source_document",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing CSV columns: {missing_columns}"
        )

    inserted = 0
    skipped = 0
    invalid_coordinates = 0

    async with AsyncSessionLocal() as db:

        for _, row in df.iterrows():

            sl_no = clean_int(row["sl_no"])
            slide_no = clean_value(row["slide_no"])

            state = clean_value(row["state"])
            district = clean_value(row["district"])
            slide_name = clean_value(row["slide_name"])
            nh_sh_location = clean_value(row["nh_sh_location"])

            latitude = clean_coordinate(row["latitude"])
            longitude = clean_coordinate(row["longitude"])

            material_involved = clean_value(
                row["material_involved"]
            )

            movement_type = clean_value(
                row["movement_type"]
            )

            history = clean_value(row["history"])

            source_page = clean_int(
                row["source_page"]
            )

            source_document = clean_value(
                row["source_document"]
            )

            # Skip records without a usable unique identifier.
            if not slide_no:
                skipped += 1
                continue

            # Coordinates are required for PostGIS location.
            if not valid_coordinates(latitude, longitude):
                invalid_coordinates += 1
                skipped += 1
                continue

            query = text(
                """
                INSERT INTO landslide_inventory (
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
                    location
                )
                VALUES (
                    :sl_no,
                    :slide_no,
                    :state,
                    :district,
                    :slide_name,
                    :nh_sh_location,
                    :latitude,
                    :longitude,
                    :material_involved,
                    :movement_type,
                    :history,
                    :source_page,
                    :source_document,
                    ST_SetSRID(
                        ST_MakePoint(
                            :longitude,
                            :latitude
                        ),
                        4326
                    )::geography
                )
                ON CONFLICT (slide_no)
                DO NOTHING
                RETURNING id
                """
            )

            result = await db.execute(
                query,
                {
                    "sl_no": sl_no,
                    "slide_no": slide_no,
                    "state": state,
                    "district": district,
                    "slide_name": slide_name,
                    "nh_sh_location": nh_sh_location,
                    "latitude": latitude,
                    "longitude": longitude,
                    "material_involved": material_involved,
                    "movement_type": movement_type,
                    "history": history,
                    "source_page": source_page,
                    "source_document": source_document,
                },
            )

            inserted_id = result.scalar_one_or_none()

            if inserted_id is not None:
                inserted += 1
            else:
                skipped += 1

        await db.commit()

    print()
    print("========================================")
    print("GSI LANDSLIDE IMPORT COMPLETE")
    print("========================================")
    print(f"CSV records       : {len(df)}")
    print(f"Inserted           : {inserted}")
    print(f"Skipped            : {skipped}")
    print(f"Invalid coordinates: {invalid_coordinates}")
    print("========================================")

    return {
        "total": len(df),
        "inserted": inserted,
        "skipped": skipped,
        "invalid_coordinates": invalid_coordinates,
    }


if __name__ == "__main__":
    import asyncio

    asyncio.run(import_gsi_landslides())