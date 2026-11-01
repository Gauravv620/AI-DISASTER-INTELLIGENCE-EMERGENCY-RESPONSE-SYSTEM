"""
AIDERS Live SACHET Ingestion Service (No-Database Mode)
=======================================================
Fetches real NDMA SACHET RSS alerts directly from the government server
and populates the in-memory fallback_store so the /api/v1/alerts endpoint
serves live data even when PostgreSQL is not available.

Auto-refreshes every REFRESH_INTERVAL_SECONDS (300s = 5 minutes).
"""

import asyncio
import logging
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# ── SACHET live RSS endpoint (NDMA official) ────────────────────────────────
SACHET_RSS_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"

# Refresh interval in seconds (5 minutes)
REFRESH_INTERVAL_SECONDS = 300

# Maximum number of live alerts to keep in memory
MAX_LIVE_ALERTS = 100


# ── Severity classifier ──────────────────────────────────────────────────────

def _classify_severity(text: str) -> str:
    t = text.upper()
    if any(k in t for k in [
        "RED ALERT", "CYCLONE", "GALE", "VERY HEAVY RAIN",
        "EXTREMELY HEAVY", "LANDSLIDE", "DANGER LEVEL",
        "EXTREME", "HIGH RISK", "EMERGENCY"
    ]):
        return "Extreme"
    if any(k in t for k in [
        "ORANGE", "SEVERE", "FLASH FLOOD", "THUNDERSTORM",
        "LIGHTNING", "HEAVY RAIN", "GUSTY WIND", "SQUALLY",
        "FLOOD WARNING", "INUNDATION", "HIGH DISCHARGE"
    ]):
        return "Severe"
    return "Moderate"


# ── Alert type classifier ────────────────────────────────────────────────────

def _classify_type(text: str) -> str:
    t = text.upper()
    if "CYCLONE" in t or "GALE" in t:
        return "Cyclone Warning"
    if "LANDSLIDE" in t or "ROCKFALL" in t or "SLOPE" in t:
        return "Landslide Warning"
    if "FLOOD" in t or "INUNDATION" in t or "RIVER" in t:
        return "Flood Advisory"
    if "EARTHQUAKE" in t or "SEISMIC" in t or "TREMOR" in t:
        return "Seismic Alert"
    if "THUNDERSTORM" in t or "LIGHTNING" in t:
        return "Thunderstorm & Lightning"
    if "RAIN" in t or "CLOUDBURST" in t:
        return "Heavy Rainfall Warning"
    if "WIND" in t or "SQUALLY" in t:
        return "Wind & Coastal Alert"
    return "Weather Advisory"


# ── State / area extractor ───────────────────────────────────────────────────

INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
    "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
    "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
    "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Jammu & Kashmir", "Jammu and Kashmir", "Ladakh",
    "Andaman", "Lakshadweep",
]

DISTRICT_PATTERNS = [
    "Srikakulam", "Vizianagaram", "Visakhapatnam", "Warangal", "Khammam",
    "Guwahati", "Kamrup", "Morigaon", "Dibrugarh", "Brahmaputra",
    "Godavari", "Polavaram", "Bhadrachalam", "Balasore", "Ganjam",
    "Supaul", "Saharsa", "Wayanad", "Meppadi", "Kullu", "Manali",
    "Chennai", "Cuddalore", "Nagapattinam", "Raigad", "Ratnagiri",
    "Srinagar", "Baramulla", "Kupwara", "Chamoli", "Joshimath",
    "Konkan", "Koyna", "Nashik",
]


def _extract_area(text: str) -> str:
    for state in INDIAN_STATES:
        if state.lower() in text.lower():
            return state
    for dist in DISTRICT_PATTERNS:
        if dist.lower() in text.lower():
            return dist
    return "National Sector"


# ── Main fetch + parse ───────────────────────────────────────────────────────

async def fetch_live_sachet_alerts() -> List[Dict[str, Any]]:
    """
    Fetch the NDMA SACHET RSS feed and return a list of parsed alert dicts
    compatible with the AIDERS government_alerts schema.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                SACHET_RSS_URL,
                headers={"User-Agent": "AIDERS-EOC/1.0 (academic project)"},
                follow_redirects=True,
            )
            response.raise_for_status()
            raw_xml = response.text
    except Exception as exc:
        logger.warning("SACHET live fetch failed (network): %s", exc)
        return []

    try:
        root = ET.fromstring(raw_xml)
    except ET.ParseError as exc:
        logger.warning("SACHET RSS XML parse error: %s", exc)
        return []

    items = root.findall(".//item")
    logger.info("SACHET RSS: fetched %d items", len(items))

    alerts: List[Dict[str, Any]] = []
    seen_ids: set = set()

    for item in items:
        def _get(tag: str) -> str:
            node = item.find(tag)
            return (node.text or "").strip() if node is not None else ""

        title = _get("title")
        description = _get("description")
        guid = _get("guid")
        pub_date = _get("pubDate")

        # Skip duplicates by guid
        if guid in seen_ids:
            continue
        seen_ids.add(guid)

        # Skip items with no meaningful English text
        full_text = description if description else title
        has_english = any("a" <= c.lower() <= "z" for c in full_text)
        if not has_english or len(full_text) < 20:
            continue

        # Parse pub date
        try:
            issued_dt = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %Z")
            issued_dt = issued_dt.replace(tzinfo=timezone.utc)
            issued_iso = issued_dt.isoformat()
        except Exception:
            issued_iso = datetime.now(timezone.utc).isoformat()

        severity = _classify_severity(full_text)
        alert_type = _classify_type(full_text)
        area = _extract_area(full_text)

        # Trim headline to reasonable length
        headline = title if len(title) <= 140 else title[:137] + "..."
        if not headline:
            headline = f"SACHET Government Alert [{guid}]"

        alerts.append({
            "id": str(uuid.uuid4()),
            "source": "SACHET",
            "external_id": f"SACHET-{guid}",
            "alert_type": alert_type,
            "headline": headline,
            "description": full_text,
            "severity": severity,
            "urgency": "Immediate" if severity == "Extreme" else "Expected",
            "certainty": "Observed" if severity in ("Extreme", "Severe") else "Likely",
            "area_name": area,
            "issued_at": issued_iso,
            "effective_at": issued_iso,
            "expires_at": None,
            "geometry": None,
            "raw_payload": {"source_guid": guid, "pub_date": pub_date},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        if len(alerts) >= MAX_LIVE_ALERTS:
            break

    logger.info("SACHET live: %d English alerts parsed", len(alerts))
    return alerts


# ── Background scheduler ─────────────────────────────────────────────────────

async def live_sachet_scheduler():
    """
    Background asyncio task: fetches real SACHET alerts every
    REFRESH_INTERVAL_SECONDS and writes them directly into the
    in-memory fallback_store so /api/v1/alerts always serves
    current government data even without PostgreSQL.
    """
    from app.database.fallback_store import fallback_store  # local import

    logger.info(
        "Live SACHET scheduler started. Interval: %ds | Source: %s",
        REFRESH_INTERVAL_SECONDS,
        SACHET_RSS_URL,
    )

    while True:
        try:
            live_alerts = await fetch_live_sachet_alerts()

            if live_alerts:
                # Merge with existing store: keep non-SACHET fallback alerts
                # (CWC, GSI, USGS) and replace all SACHET entries with live data
                non_sachet = [
                    a for a in fallback_store.alerts
                    if str(a.get("source", "")).upper() != "SACHET"
                ]
                fallback_store.alerts = live_alerts + non_sachet

                logger.info(
                    "Live SACHET update: %d alerts now in fallback_store (%d SACHET + %d other)",
                    len(fallback_store.alerts),
                    len(live_alerts),
                    len(non_sachet),
                )
            else:
                logger.warning(
                    "SACHET live fetch returned 0 alerts — retaining previous data."
                )

        except Exception as exc:
            logger.warning("live_sachet_scheduler error: %s", exc)

        await asyncio.sleep(REFRESH_INTERVAL_SECONDS)

