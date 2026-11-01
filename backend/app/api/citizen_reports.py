"""
Citizen Disaster Reports API
============================
Handles incoming public distress calls, crowdsourced citizen incident reports,
AI-powered photographic telemetry verification via CLIP ViT-B/32, and automated
nearest rescue battalion dispatch.
"""

from io import BytesIO
import logging
import math
from typing import Any, Dict, Optional, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.database.fallback_store import fallback_store
from app.services.alert_broadcast import alert_manager
from app.api.image_analyzer import classify_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/citizen-reports", tags=["citizen-reports"])

# Map AI categories to official incident types
AI_CATEGORY_TO_INCIDENT_TYPE = {
    "POSSIBLE_LANDSLIDE": "LANDSLIDE",
    "POSSIBLE_FLOOD": "FLOOD",
    "POSSIBLE_EARTHQUAKE_DAMAGE": "EARTHQUAKE",
    "POSSIBLE_WILDFIRE": "WILDFIRE",
    "POSSIBLE_CYCLONE": "CYCLONE",
    "POSSIBLE_THUNDERSTORM": "HEAVY_RAINFALL",
    "POSSIBLE_DROUGHT": "HEAVY_RAINFALL",
}

DISASTER_CONFIRM_THRESHOLD = 0.20  # Minimum CLIP similarity score to confirm disaster signature


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate Great Circle distance in kilometers between two geo-coordinates."""
    R = 6371.0  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def select_nearest_rescue_team(lat: float, lon: float, incident_type: str = "FLOOD") -> Tuple[Dict[str, Any], float, int]:
    """
    Find the geographically closest rescue team to the incident location.
    Applies cost-weighted distance scoring (available units prioritized, but local proximity
    overrules cross-country transits).
    Returns (team_dict, distance_km, estimated_eta_minutes).
    """
    all_teams = fallback_store.rescue_teams
    scored = []
    for team in all_teams:
        t_lat = float(team.get("latitude") or 20.5937)
        t_lon = float(team.get("longitude") or 78.9629)
        dist = calculate_haversine_distance(lat, lon, t_lat, t_lon)
        status = str(team.get("status", "AVAILABLE")).upper()
        # Available units get priority, but massive distance overrules
        cost = dist * (1.0 if status == "AVAILABLE" else 1.8)
        scored.append((cost, dist, team))

    scored.sort(key=lambda item: item[0])
    _, best_dist, best_team = scored[0]

    # Calculate realistic response ETA assuming 45 km/h emergency speed with 1.25 road routing factor
    transit_km = best_dist * 1.25
    eta_mins = max(8, int(round((transit_km / 45.0) * 60)))

    return best_team, best_dist, eta_mins


@router.get("")
async def list_citizen_reports(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    List submitted citizen reports with status and geo-coordinates.
    """
    try:
        query = text("""
            SELECT
                id,
                category,
                description,
                status,
                media_url,
                created_at,
                ST_Y(location::geometry) AS latitude,
                ST_X(location::geometry) AS longitude
            FROM citizen_reports
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        result = await db.execute(query, {"limit": limit, "offset": offset})
        rows = [dict(r) for r in result.mappings().all()]
        return {"total": len(rows), "reports": rows}
    except Exception:
        return fallback_store.get_citizen_reports(limit=limit, offset=offset)


@router.post("")
async def submit_citizen_report(
    request: Request,
    name: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    incident_type: Optional[str] = Form("FLOOD"),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a citizen disaster report.
    Automatically analyzes uploaded imagery with CLIP ViT-B/32 Computer Vision,
    verifies genuine disaster signatures, establishes an official Incident,
    and automatically dispatches the nearest rescue battalion.
    """
    is_sos = False
    # If JSON was sent instead of form data
    if name is None and latitude is None:
        try:
            body = await request.json()
            name = body.get("name")
            phone = body.get("phone")
            incident_type = body.get("incident_type") or body.get("category") or "FLOOD"
            title = body.get("title")
            description = body.get("description")
            latitude = float(body.get("latitude") or 20.5937)
            longitude = float(body.get("longitude") or 78.9629)
            is_sos = bool(body.get("is_sos"))
        except Exception:
            pass

    if latitude is None or longitude is None:
        latitude = 20.5937
        longitude = 78.9629

    if not is_sos and (
        "SOS" in (title or "").upper() or "SOS" in (description or "").upper()
    ):
        is_sos = True

    title = title or f"Citizen Alert: {incident_type} Emergency"
    description = description or "Disaster event reported by citizen through mobile portal."

    # ────────────────────────────────────────────────────────────
    # 1. AI COMPUTER VISION VERIFICATION PIPELINE
    # ────────────────────────────────────────────────────────────
    ai_analysis: Optional[Dict[str, Any]] = None
    is_ai_verified = False
    verified_incident_type = incident_type or "FLOOD"
    confidence_score = 0.0

    if photo and photo.filename:
        try:
            photo_bytes = await photo.read()
            if len(photo_bytes) > 0:
                try:
                    pil_img = Image.open(BytesIO(photo_bytes)).convert("RGB")
                    # Run CLIP zero-shot classification
                    ai_analysis = await run_in_threadpool(classify_image, pil_img)
                    pred_cat = ai_analysis.get("predicted_category", "")
                    confidence_score = float(
                        ai_analysis.get("confidence_score")
                        or ai_analysis.get("model_score")
                        or 0.0
                    )

                    if (
                        pred_cat in AI_CATEGORY_TO_INCIDENT_TYPE
                        and pred_cat not in ("NO_CLEAR_DISASTER_EVIDENCE", "UNRELATED_OR_UNCERTAIN")
                        and confidence_score >= DISASTER_CONFIRM_THRESHOLD
                    ):
                        is_ai_verified = True
                        verified_incident_type = AI_CATEGORY_TO_INCIDENT_TYPE[pred_cat]
                        logger.info(
                            "Citizen photo AI-verified as %s with confidence %.2f",
                            verified_incident_type,
                            confidence_score,
                        )
                except Exception as img_err:
                    logger.warning("CLIP Vision processing error: %s", img_err)
        except Exception as read_err:
            logger.warning("Error reading uploaded photo bytes: %s", read_err)

    # ────────────────────────────────────────────────────────────
    # 2. SAVE CITIZEN REPORT (DB or Fallback)
    # ────────────────────────────────────────────────────────────
    initial_status = "AI_VERIFIED" if is_ai_verified else ("SOS_VERIFIED" if is_sos else "SUBMITTED")

    try:
        query = text("""
            INSERT INTO citizen_reports (
                category,
                description,
                location,
                media_url,
                status,
                created_at
            ) VALUES (
                :category,
                :description,
                ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                :media_url,
                :status,
                NOW()
            )
            RETURNING id, category, description, status, created_at
        """)
        result = await db.execute(
            query,
            {
                "category": verified_incident_type,
                "description": f"{title} - {description} (Reported by: {name or 'Anonymous'}, Tel: {phone or 'N/A'})",
                "latitude": latitude,
                "longitude": longitude,
                "media_url": photo.filename if photo else None,
                "status": initial_status,
            },
        )
        await db.commit()
        row = dict(result.mappings().one())
        row["latitude"] = latitude
        row["longitude"] = longitude
        report_data = row
    except Exception:
        report_data = fallback_store.create_citizen_report({
            "name": name,
            "phone": phone,
            "incident_type": verified_incident_type,
            "title": title,
            "description": description,
            "latitude": latitude,
            "longitude": longitude,
            "media_url": photo.filename if photo else None,
            "status": initial_status,
        })

    # ────────────────────────────────────────────────────────────
    # 3. AUTOMATED INCIDENT ELEVATION & NEAREST TEAM AUTO-DISPATCH
    # ────────────────────────────────────────────────────────────
    auto_incident: Optional[Dict[str, Any]] = None
    auto_dispatch: Optional[Dict[str, Any]] = None
    assigned_team_data: Optional[Dict[str, Any]] = None

    if is_ai_verified or is_sos:
        # Determine Severity
        if is_sos:
            incident_severity = "CRITICAL"
        elif confidence_score >= 0.50:
            incident_severity = "CRITICAL"
        elif confidence_score >= 0.35:
            incident_severity = "HIGH"
        else:
            incident_severity = "MEDIUM"

        incident_title = (
            f"AI-VERIFIED: {title}"
            if is_ai_verified
            else f"SOS LIFE-SAFETY: {title}"
        )

        verification_note = (
            f" [AI Vision Telemetry: {ai_analysis.get('matched_description')} | Confidence: {confidence_score * 100:.1f}%]"
            if is_ai_verified and ai_analysis
            else " [Citizen Instant SOS Beacon Telemetry]"
        )

        full_incident_desc = f"{description}{verification_note}\nReporter: {name or 'Citizen'} (Phone: {phone or 'N/A'})."

        # Create Official Incident
        try:
            inc_query = text("""
                INSERT INTO incidents (
                    incident_type,
                    severity,
                    status,
                    title,
                    description,
                    source,
                    location,
                    reported_at
                )
                VALUES (
                    :incident_type,
                    :severity,
                    'DISPATCHED',
                    :title,
                    :description,
                    :source,
                    ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                    NOW()
                )
                RETURNING
                    id,
                    incident_type,
                    severity,
                    status,
                    title,
                    description,
                    source,
                    reported_at,
                    created_at,
                    ST_Y(location::geometry) AS latitude,
                    ST_X(location::geometry) AS longitude
            """)
            inc_res = await db.execute(
                inc_query,
                {
                    "incident_type": verified_incident_type,
                    "severity": incident_severity,
                    "title": incident_title,
                    "description": full_incident_desc,
                    "source": "CITIZEN_PHOTO_AI_VERIFIED" if is_ai_verified else "CITIZEN_SOS_BEACON",
                    "latitude": latitude,
                    "longitude": longitude,
                },
            )
            await db.commit()
            auto_incident = dict(inc_res.mappings().one())
        except Exception:
            auto_incident = fallback_store.create_incident({
                "incident_type": verified_incident_type,
                "severity": incident_severity,
                "title": incident_title,
                "description": full_incident_desc,
                "latitude": latitude,
                "longitude": longitude,
                "source": "CITIZEN_PHOTO_AI_VERIFIED" if is_ai_verified else "CITIZEN_SOS_BEACON",
            })
            auto_incident["status"] = "DISPATCHED"

        # Find Nearest Available Rescue Team
        nearest_team, dist_km, eta_mins = select_nearest_rescue_team(
            latitude, longitude, verified_incident_type
        )

        instructions = (
            f"AUTOMATED EMERGENCY QRT DISPATCH: System verified citizen emergency telemetry "
            f"({incident_title}). Target Coordinates: {latitude:.4f}, {longitude:.4f} "
            f"(Approx {dist_km:.1f} km from battalion base, estimated transit ETA ~{eta_mins} mins). "
            f"Reporter Contact: {name or 'Anonymous'} (Tel: {phone or 'N/A'}). "
            f"Proceed immediately with priority rescue equipment."
        )

        # Create Official Dispatch
        try:
            disp_query = text("""
                INSERT INTO dispatches (
                    incident_id,
                    team_id,
                    dispatcher_id,
                    assigned_location,
                    priority,
                    instructions,
                    status,
                    assigned_at
                )
                VALUES (
                    :incident_id,
                    :team_id,
                    :dispatcher_id,
                    ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                    :priority,
                    :instructions,
                    'EN_ROUTE',
                    NOW()
                )
                RETURNING
                    id,
                    incident_id,
                    team_id,
                    dispatcher_id,
                    priority,
                    instructions,
                    status,
                    assigned_at,
                    ST_Y(assigned_location::geometry) AS latitude,
                    ST_X(assigned_location::geometry) AS longitude
            """)
            disp_res = await db.execute(
                disp_query,
                {
                    "incident_id": auto_incident["id"],
                    "team_id": nearest_team["id"],
                    "dispatcher_id": "22222222-2222-4222-8222-222222222222",
                    "latitude": latitude,
                    "longitude": longitude,
                    "priority": "CRITICAL" if incident_severity == "CRITICAL" else "HIGH",
                    "instructions": instructions,
                },
            )
            await db.commit()
            auto_dispatch = dict(disp_res.mappings().one())
        except Exception:
            auto_dispatch = fallback_store.create_dispatch({
                "incident_id": str(auto_incident["id"]),
                "team_id": str(nearest_team["id"]),
                "dispatcher_id": "22222222-2222-4222-8222-222222222222",
                "latitude": latitude,
                "longitude": longitude,
                "priority": "CRITICAL" if incident_severity == "CRITICAL" else "HIGH",
                "instructions": instructions,
            })
            auto_dispatch["status"] = "EN_ROUTE"

        # Update Rescue Team status to DEPLOYED / EN_ROUTE
        nearest_team["status"] = "EN_ROUTE"

        assigned_team_data = {
            "id": str(nearest_team.get("id")),
            "team_name": nearest_team.get("team_name"),
            "organization": nearest_team.get("organization"),
            "team_type": nearest_team.get("team_type"),
            "contact_phone": nearest_team.get("contact_phone"),
            "distance_km": dist_km,
            "eta_minutes": eta_mins,
            "status": "EN_ROUTE",
        }

        # Broadcast WebSocket Notifications so Map & EOC update in real-time
        try:
            await alert_manager.broadcast({
                "type": "new_incident",
                "incident": auto_incident,
            })
            await alert_manager.broadcast({
                "type": "new_dispatch",
                "dispatch": auto_dispatch,
            })
        except Exception:
            pass

    # Broadcast citizen report alert
    try:
        await alert_manager.broadcast({
            "type": "citizen_report_alert",
            "report_id": str(report_data.get("id")),
            "title": title,
            "incident_type": verified_incident_type,
            "latitude": latitude,
            "longitude": longitude,
            "auto_dispatched": bool(auto_dispatch),
            "assigned_team": assigned_team_data.get("team_name") if assigned_team_data else None,
        })
    except Exception:
        pass

    confirmation_msg = (
        f"✓ Photographic Evidence Verified by CLIP Vision AI ({confidence_score * 100:.1f}% confidence in {verified_incident_type})! "
        f"Official Incident established and nearest battalion [{assigned_team_data['team_name']}] "
        f"automatically dispatched (Estimated Distance: {assigned_team_data['distance_km']} km, ETA: {assigned_team_data['eta_minutes']} mins)."
        if is_ai_verified and assigned_team_data
        else (
            f"🚨 Immediate Life-Safety SOS Beacon Transmitted! "
            f"Nearest battalion [{assigned_team_data['team_name']}] scrambled and en route (ETA {assigned_team_data['eta_minutes']} mins)."
            if is_sos and assigned_team_data
            else "Citizen emergency report received and logged into National Command queue."
        )
    )

    return {
        "status": "success",
        "message": confirmation_msg,
        "id": report_data.get("id"),
        "report_id": report_data.get("id"),
        "verified": is_ai_verified or is_sos,
        "verification_status": initial_status,
        "ai_analysis": ai_analysis,
        "incident": auto_incident,
        "dispatch": auto_dispatch,
        "assigned_team": assigned_team_data,
        "data": report_data,
    }


@router.post("/{report_id}/verify")
async def verify_citizen_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Manually verify a citizen report and automatically convert it into an official AIDERS Incident
    with automatic nearest rescue team dispatch.
    """
    report = next((r for r in fallback_store.citizen_reports if str(r["id"]) == report_id), None)
    if not report:
        raise HTTPException(status_code=404, detail="Citizen report not found")

    report["status"] = "VERIFIED"
    lat = float(report.get("latitude", 20.5937))
    lon = float(report.get("longitude", 78.9629))
    inc_type = report.get("incident_type", "FLOOD")

    # Create official incident
    incident = fallback_store.create_incident({
        "incident_type": inc_type,
        "severity": "HIGH",
        "title": f"VERIFIED: {report.get('title', 'Citizen Report')}",
        "description": report.get("description", ""),
        "source": "CITIZEN_CROWDSOURCE_VERIFIED",
        "latitude": lat,
        "longitude": lon,
    })
    incident["status"] = "DISPATCHED"

    # Select nearest rescue team
    nearest_team, dist_km, eta_mins = select_nearest_rescue_team(lat, lon, inc_type)

    instructions = (
        f"DISPATCH ORDER (MANUALLY VERIFIED): Incident confirmed by duty officer. "
        f"Target: {lat:.4f}, {lon:.4f} (~{dist_km:.1f} km, ETA {eta_mins} mins)."
    )

    dispatch = fallback_store.create_dispatch({
        "incident_id": str(incident["id"]),
        "team_id": str(nearest_team["id"]),
        "dispatcher_id": "22222222-2222-4222-8222-222222222222",
        "latitude": lat,
        "longitude": lon,
        "priority": "HIGH",
        "instructions": instructions,
    })
    nearest_team["status"] = "EN_ROUTE"

    # Broadcast over WebSockets
    try:
        await alert_manager.broadcast({"type": "new_incident", "incident": incident})
        await alert_manager.broadcast({"type": "new_dispatch", "dispatch": dispatch})
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Report verified and elevated to active Incident. Rescue unit [{nearest_team['team_name']}] dispatched.",
        "incident": incident,
        "dispatch": dispatch,
        "assigned_team": {
            "team_name": nearest_team.get("team_name"),
            "distance_km": dist_km,
            "eta_minutes": eta_mins,
            "contact_phone": nearest_team.get("contact_phone"),
        },
    }
