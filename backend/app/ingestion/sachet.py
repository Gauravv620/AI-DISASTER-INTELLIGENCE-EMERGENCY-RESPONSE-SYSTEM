import xml.etree.ElementTree as ET
from typing import Optional

import httpx
import json
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ============================================================
# NDMA SACHET ENDPOINTS
# ============================================================

SACHET_XML_URL = (
    "https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile"
)

SACHET_RSS_URL = (
    "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
)


# ============================================================
# SACHET CLIENT
# ============================================================

class SachetClient:

    def __init__(self):
        self.etag: Optional[str] = None
        self.cached_xml: Optional[str] = None

    # ========================================================
    # FETCH CAP XML
    # ========================================================

    async def fetch(self, identifier: str):
        """
        Fetch a detailed CAP XML alert from NDMA SACHET.

        Uses ETag caching:
        - HTTP 200 -> new/updated alert
        - HTTP 304 -> alert has not changed
        """

        params = {
            "identifier": identifier
        }

        headers = {}

        if self.etag:
            headers["If-None-Match"] = self.etag

        async with httpx.AsyncClient(timeout=30.0) as client:

            response = await client.get(
                SACHET_XML_URL,
                params=params,
                headers=headers
            )

        # ----------------------------------------------------
        # Alert has not changed
        # ----------------------------------------------------

        if response.status_code == 304:

            return {
                "status": "not_modified",
                "identifier": identifier,
                "etag": self.etag,
                "alert": (
                    self.parse_cap(self.cached_xml)
                    if self.cached_xml
                    else None
                )
            }

        # ----------------------------------------------------
        # New / updated alert
        # ----------------------------------------------------

        response.raise_for_status()

        self.etag = response.headers.get("ETag")

        self.cached_xml = response.text

        alert = self.parse_cap(response.text)

        return {
            "status": "updated",
            "identifier": identifier,
            "etag": self.etag,
            "alert": alert
        }

    # ========================================================
    # FETCH INDIA RSS FEED
    # ========================================================

    async def fetch_rss(self):
        """
        Fetch the official NDMA SACHET India CAP RSS feed.
        """

        async with httpx.AsyncClient(timeout=30.0) as client:

            response = await client.get(
                SACHET_RSS_URL
            )

        response.raise_for_status()

        root = ET.fromstring(response.text)

        items = []

        for item in root.findall(".//item"):

            def get(tag):

                node = item.find(tag)

                if node is not None:
                    return node.text

                return None

            items.append({
                "title": get("title"),
                "description": get("description"),
                "category": get("category"),
                "link": get("link"),
                "author": get("author"),
                "identifier": get("guid"),
                "pub_date": get("pubDate")
            })

        return {
            "source": "NDMA SACHET",
            "feed": SACHET_RSS_URL,
            "count": len(items),
            "alerts": items
        }

    # ========================================================
    # PARSE CAP XML
    # ========================================================

    @staticmethod
    def parse_cap(xml_text: str):

        root = ET.fromstring(xml_text)

        ns = {
            "cap": "urn:oasis:names:tc:emergency:cap:1.2"
        }

        # ----------------------------------------------------
        # CAP <info>
        # ----------------------------------------------------

        info = root.find(
            "cap:info",
            ns
        )

        if info is None:
            return {}

        def get(tag):

            node = info.find(
                f"cap:{tag}",
                ns
            )

            if node is not None:
                return node.text

            return None

        # ----------------------------------------------------
        # Main alert information
        # ----------------------------------------------------

        alert = {
            "identifier": get("identifier"),
            "sender": get("sender"),
            "sent": get("sent"),
            "status": get("status"),
            "msg_type": get("msgType"),
            "event": get("event"),
            "headline": get("headline"),
            "description": get("description"),
            "instruction": get("instruction"),
            "urgency": get("urgency"),
            "severity": get("severity"),
            "certainty": get("certainty"),
            "effective": get("effective"),
            "onset": get("onset"),
            "expires": get("expires"),
            "category": get("category"),
            "response_type": get("responseType"),
            "sender_name": get("senderName"),
            "web": get("web")
        }

        # ----------------------------------------------------
        # CAP <area>
        # ----------------------------------------------------

        area = info.find(
            "cap:area",
            ns
        )

        if area is not None:

            def get_area(tag):

                node = area.find(
                    f"cap:{tag}",
                    ns
                )

                if node is not None:
                    return node.text

                return None

            alert["area_desc"] = get_area("areaDesc")
            alert["polygon"] = get_area("polygon")
            alert["circle"] = get_area("circle")
            alert["geocode"] = get_area("geocode")

        return alert


# ============================================================
# SACHET DATABASE INGESTION
# ============================================================

async def ingest_sachet_alerts(
    db: AsyncSession,
):
    """
    Fetch current NDMA SACHET RSS alerts, retrieve their
    CAP XML documents, and store new alerts in PostgreSQL.

    Returns both ingestion statistics and the actual newly
    inserted alerts for WebSocket broadcasting.
    """

    client = SachetClient()

    # --------------------------------------------------------
    # Fetch RSS
    # --------------------------------------------------------

    rss_result = await client.fetch_rss()

    rss_alerts = rss_result.get(
        "alerts",
        []
    )

    fetched = len(rss_alerts)

    inserted = 0
    skipped = 0
    failed = 0

    errors = []

    # Actual newly inserted alerts
    inserted_alerts = []

    # --------------------------------------------------------
    # Process each RSS alert
    # --------------------------------------------------------

    for rss_alert in rss_alerts:

        identifier = rss_alert.get(
            "identifier"
        )

        if not identifier:

            skipped += 1
            continue

        try:

            # ------------------------------------------------
            # Duplicate check
            # ------------------------------------------------

            existing_query = text("""
                SELECT 1
                FROM government_alerts
                WHERE source = :source
                  AND external_id = :external_id
                LIMIT 1
            """)

            existing_result = await db.execute(
                existing_query,
                {
                    "source": "SACHET",
                    "external_id": identifier,
                },
            )

            if existing_result.first():

                skipped += 1
                continue

            # ------------------------------------------------
            # Fetch detailed CAP XML
            # ------------------------------------------------

            cap_result = await client.fetch(
                identifier
            )

            alert = cap_result.get(
                "alert"
            )

            if not alert:

                failed += 1

                errors.append({
                    "identifier": identifier,
                    "error": (
                        "CAP XML returned "
                        "no alert data"
                    )
                })

                continue

            # ------------------------------------------------
            # Parse timestamps
            # ------------------------------------------------

            issued_at = parse_sachet_datetime(
                alert.get("sent")
            )

            effective_at = parse_sachet_datetime(
                alert.get("effective")
            )

            expires_at = parse_sachet_datetime(
                alert.get("expires")
            )

            # ------------------------------------------------
            # Alert type
            # ------------------------------------------------

            alert_type = (
                alert.get("event")
                or alert.get("category")
                or rss_alert.get("category")
            )

            # ------------------------------------------------
            # Area
            # ------------------------------------------------

            area_name = alert.get(
                "area_desc"
            )

            # ------------------------------------------------
            # Prepare raw payload
            # ------------------------------------------------

            raw_payload = json.dumps(
                alert,
                ensure_ascii=False
            )

            # ------------------------------------------------
            # Insert using SAVEPOINT
            # ------------------------------------------------

            async with db.begin_nested():

                insert_query = text("""
                    INSERT INTO government_alerts (
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
                        raw_payload
                    )
                    VALUES (
                        :source,
                        :external_id,
                        :alert_type,
                        :headline,
                        :description,
                        :severity,
                        :urgency,
                        :certainty,
                        :issued_at,
                        :effective_at,
                        :expires_at,
                        :area_name,
                        CAST(:raw_payload AS JSONB)
                    )
                    ON CONFLICT DO NOTHING
                """)

                await db.execute(
                    insert_query,
                    {
                        "source": "SACHET",
                        "external_id": identifier,
                        "alert_type": alert_type,

                        "headline": (
                            alert.get("headline")
                            or rss_alert.get("title")
                        ),

                        "description": (
                            alert.get("description")
                            or rss_alert.get("description")
                        ),

                        "severity": alert.get(
                            "severity"
                        ),

                        "urgency": alert.get(
                            "urgency"
                        ),

                        "certainty": alert.get(
                            "certainty"
                        ),

                        "issued_at": issued_at,

                        "effective_at": effective_at,

                        "expires_at": expires_at,

                        "area_name": area_name,

                        "raw_payload": raw_payload,
                    },
                )

            # ------------------------------------------------
            # Track inserted alert
            # ------------------------------------------------

            inserted += 1

            inserted_alerts.append({
                "external_id": identifier,
                "source": "SACHET",

                "alert_type": alert_type,

                "headline": (
                    alert.get("headline")
                    or rss_alert.get("title")
                ),

                "description": (
                    alert.get("description")
                    or rss_alert.get("description")
                ),

                "severity": alert.get(
                    "severity"
                ),

                "urgency": alert.get(
                    "urgency"
                ),

                "certainty": alert.get(
                    "certainty"
                ),

                "issued_at": (
                    issued_at.isoformat()
                    if issued_at
                    else None
                ),

                "effective_at": (
                    effective_at.isoformat()
                    if effective_at
                    else None
                ),

                "expires_at": (
                    expires_at.isoformat()
                    if expires_at
                    else None
                ),

                "area_name": area_name,
            })

        except Exception as exc:

            failed += 1

            errors.append({
                "identifier": identifier,
                "error": str(exc)
            })

    # --------------------------------------------------------
    # Commit successful records
    # --------------------------------------------------------

    await db.commit()

    return {
        "source": "NDMA SACHET",

        "fetched": fetched,

        "inserted": inserted,

        "skipped_duplicates": skipped,

        "failed": failed,

        "errors": errors[:10],

        # New records for WebSocket
        "new_alerts": inserted_alerts,
    }


# ============================================================
# DATETIME PARSER
# ============================================================

def parse_sachet_datetime(
    value: Optional[str],
):
    """
    Convert SACHET/CAP ISO-8601 timestamps into
    Python datetime.
    """

    if not value:
        return None

    try:

        return datetime.fromisoformat(
            value.replace(
                "Z",
                "+00:00"
            )
        )

    except ValueError:

        return None