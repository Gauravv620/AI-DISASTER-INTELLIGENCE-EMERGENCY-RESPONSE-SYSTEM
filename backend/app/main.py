import asyncio
import logging
import os

from fastapi import FastAPI, WebSocket, Depends
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.alerts import router as alerts_router
from app.api.incidents import router as incidents_router
from app.api.ingestion import router as ingestion_router

from app.database.session import get_db

from app.ingestion.scheduler import sachet_scheduler
from app.ingestion.live_sachet import live_sachet_scheduler
from app.services.alert_broadcast import alert_manager
from app.api.rescue_teams import router as rescue_teams_router
from app.api.officials import router as officials_router
from app.api.dispatches import router as dispatches_router
from app.api.citizen_reports import router as citizen_reports_router
from app.api.auth import router as auth_router
from app.api import image_analyzer

# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
)

logger = logging.getLogger(__name__)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AIDERS API",
    description=(
        "AI Disaster Intelligence & Emergency Response System"
    ),
    version="0.1.0",
)


# ============================================================
# CORS
# ============================================================

cors_origins_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]
if cors_origins_env:
    allowed_origins.extend([o.strip() for o in cors_origins_env.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com|http://localhost:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# API ROUTES
# ============================================================

# Government alerts
app.include_router(
    alerts_router,
    prefix="/api/v1",
)

# Operational incidents
app.include_router(
    incidents_router,
    prefix="/api/v1",
)

# Data ingestion and intelligence
app.include_router(
    ingestion_router,
    prefix="/api/v1",
)

app.include_router(rescue_teams_router, prefix="/api/v1")
app.include_router(officials_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(dispatches_router, prefix="/api/v1")
app.include_router(citizen_reports_router, prefix="/api/v1")
app.include_router(
    image_analyzer.router,
    prefix="/api/v1",
)

# ============================================================
# SACHET BACKGROUND TASK
# ============================================================

sachet_task = None
live_sachet_task = None


@app.on_event("startup")
async def startup_event():
    """
    Start AIDERS background services.
    """

    global sachet_task, live_sachet_task

    logger.info("Starting AIDERS background services...")

    # ── Live SACHET no-DB scheduler (runs without PostgreSQL) ────────────────
    # Fetches real NDMA SACHET RSS every 5 minutes and populates fallback_store
    # so /api/v1/alerts always serves current government data.
    live_sachet_task = asyncio.create_task(live_sachet_scheduler())
    logger.info("Live SACHET real-time scheduler started (no-DB mode).")

    # ── DB-backed SACHET scheduler (runs only when PostgreSQL is available) ──
    sachet_task = asyncio.create_task(sachet_scheduler())
    logger.info("NDMA SACHET DB scheduler started.")


@app.on_event("shutdown")
async def shutdown_event():
    """
    Stop AIDERS background services cleanly.
    """

    global sachet_task, live_sachet_task

    for task_name, task in [("Live SACHET", live_sachet_task), ("SACHET DB", sachet_task)]:
        if task is not None:
            logger.info("Stopping %s scheduler...", task_name)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                logger.info("%s scheduler stopped.", task_name)

    sachet_task = None
    live_sachet_task = None

    logger.info("AIDERS background services stopped.")


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get(
    "/health",
    tags=["system"],
)
async def health(
    db: AsyncSession = Depends(get_db),
):
    """
    Check AIDERS API and data persistence connectivity.
    """
    database_ok = False
    try:
        coro = db.execute(text("SELECT 1"))
        result = await asyncio.wait_for(coro, timeout=1.5)
        database_ok = result.scalar() == 1
    except Exception:
        database_ok = False

    return {
        "status": "ok",
        "service": "aiders-api",
        "database": "connected" if database_ok else "resilient_fallback",
        "mode": "production" if database_ok else "resilient_tactical_mode",
    }


# ============================================================
# WEBSOCKET — LIVE ALERT STREAM
# ============================================================

@app.websocket("/ws/alerts")
async def alert_socket(
    websocket: WebSocket,
):
    """
    WebSocket endpoint used by the command dashboard
    for real-time government alert updates.
    """

    await alert_manager.connect(
        websocket
    )

    await websocket.send_json(
        {
            "type": "connection",
            "message": (
                "AIDERS alert stream connected"
            ),
        }
    )

    try:

        while True:

            # Keep the connection alive and wait
            # for client messages.
            await websocket.receive_text()

    except Exception as exc:

        logger.info(
            "Alert WebSocket disconnected: %s",
            exc,
        )

    finally:

        alert_manager.disconnect(
            websocket
        )