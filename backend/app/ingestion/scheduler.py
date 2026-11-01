import logging
import asyncio

from app.database.session import AsyncSessionLocal
from app.ingestion.sachet import ingest_sachet_alerts
from app.services.alert_broadcast import alert_manager


logger = logging.getLogger(__name__)

SACHET_INTERVAL_SECONDS = 300


async def run_sachet_ingestion():
    try:
        async with AsyncSessionLocal() as db:
            result = await ingest_sachet_alerts(db)
            logger.info(
                "SACHET ingestion completed: %s",
                result,
            )

            new_alerts = result.get("new_alerts", [])
            for alert in new_alerts:
                await alert_manager.broadcast({
                    "type": "government_alert",
                    "source": "SACHET",
                    "alert": alert,
                })
    except Exception as exc:
        logger.warning(
            "SACHET periodic ingestion skipped (DB/Network offline): %s",
            exc,
        )


async def sachet_scheduler():
    logger.info(
        "SACHET scheduler started. Interval: %s seconds",
        SACHET_INTERVAL_SECONDS,
    )
    while True:
        try:
            await run_sachet_ingestion()
        except Exception:
            pass
        await asyncio.sleep(SACHET_INTERVAL_SECONDS)
