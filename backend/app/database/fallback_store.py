"""
AIDERS In-Memory Resilient Fallback Store
=========================================
Provides seamless fallback data and in-memory persistence when PostgreSQL
is unreachable or during development/demo environments. Ensures zero downtime
and complete feature availability out of the box.
"""

from __future__ import annotations

import csv
import logging
import math
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Base path for local CSV data
BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "data"

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ============================================================
# INITIAL SEED ENTITIES
# ============================================================

OFFICIAL_1_ID = "11111111-1111-4111-8111-111111111111"
OFFICIAL_2_ID = "22222222-2222-4222-8222-222222222222"
OFFICIAL_3_ID = "33333333-3333-4333-8333-333333333333"

TEAM_1_ID = "aaaaaaa1-1111-4aaa-8aaa-aaaaaaaaaaaa"
TEAM_2_ID = "aaaaaaa2-2222-4aaa-8aaa-aaaaaaaaaaaa"
TEAM_3_ID = "aaaaaaa3-3333-4aaa-8aaa-aaaaaaaaaaaa"
TEAM_4_ID = "aaaaaaa4-4444-4aaa-8aaa-aaaaaaaaaaaa"
TEAM_5_ID = "aaaaaaa5-5555-4aaa-8aaa-aaaaaaaaaaaa"
TEAM_6_ID = "aaaaaaa6-6666-4aaa-8aaa-aaaaaaaaaaaa"

INCIDENT_1_ID = "bbbbbbb1-1111-4bbb-8bbb-bbbbbbbbbbbb"
INCIDENT_2_ID = "bbbbbbb2-2222-4bbb-8bbb-bbbbbbbbbbbb"
INCIDENT_3_ID = "bbbbbbb3-3333-4bbb-8bbb-bbbbbbbbbbbb"
INCIDENT_4_ID = "bbbbbbb4-4444-4bbb-8bbb-bbbbbbbbbbbb"

DISPATCH_1_ID = "ccccccc1-1111-4ccc-8ccc-cccccccccccc"
DISPATCH_2_ID = "ccccccc2-2222-4ccc-8ccc-cccccccccccc"
DISPATCH_3_ID = "ccccccc3-3333-4ccc-8ccc-cccccccccccc"

FALLBACK_OFFICIALS: List[Dict[str, Any]] = [
    {
        "id": OFFICIAL_1_ID,
        "official_id": "NDRF-CMD-001",
        "full_name": "Commander Rajesh Sharma",
        "role": "ROLE_ADMIN",
        "department": "National Disaster Response Force HQ",
        "mobile": "+91-98100-12345",
        "email": "rajesh.sharma@ndrf.gov.in",
        "is_active": True,
        "mfa_enabled": True,
        "failed_login_attempts": 0,
        "created_at": _now_iso(),
    },
    {
        "id": OFFICIAL_2_ID,
        "official_id": "EOC-DISP-042",
        "full_name": "Duty Officer Priya Nair",
        "role": "ROLE_DISPATCHER",
        "department": "Central Emergency Operations Center",
        "mobile": "+91-98200-54321",
        "email": "priya.nair@eoc.gov.in",
        "is_active": True,
        "mfa_enabled": True,
        "failed_login_attempts": 0,
        "created_at": _now_iso(),
    },
    {
        "id": OFFICIAL_3_ID,
        "official_id": "RESCUE-LEAD-108",
        "full_name": "Capt. Vikram Rathore",
        "role": "ROLE_FIELD_RESCUE",
        "department": "08-Bn NDRF Quick Response Group",
        "mobile": "+91-98300-67890",
        "email": "vikram.rathore@ndrf.gov.in",
        "is_active": True,
        "mfa_enabled": True,
        "failed_login_attempts": 0,
        "created_at": _now_iso(),
    },
]

FALLBACK_RESCUE_TEAMS: List[Dict[str, Any]] = [
    {
        "id": TEAM_1_ID,
        "team_name": "NDRF 01 Battalion (Guwahati Alpha)",
        "organization": "National Disaster Response Force",
        "team_type": "FLOOD_RESCUE",
        "status": "AVAILABLE",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "contact_phone": "+91-361-2849001",
        "created_at": _now_iso(),
    },
    {
        "id": TEAM_2_ID,
        "team_name": "NDRF 04 Battalion (Arakkonam QRT)",
        "organization": "National Disaster Response Force",
        "team_type": "URBAN_SEARCH_AND_RESCUE",
        "status": "AVAILABLE",
        "latitude": 13.0784,
        "longitude": 79.6678,
        "contact_phone": "+91-4177-222555",
        "created_at": _now_iso(),
    },
    {
        "id": TEAM_3_ID,
        "team_name": "NDRF 08 Battalion (Ghaziabad Strike)",
        "organization": "National Disaster Response Force",
        "team_type": "HEAVY_DISASTER_RESCUE",
        "status": "DEPLOYED",
        "latitude": 28.6692,
        "longitude": 77.4538,
        "contact_phone": "+91-120-2766000",
        "created_at": _now_iso(),
    },
    {
        "id": TEAM_4_ID,
        "team_name": "NDRF 10 Battalion (Vijayawada Delta)",
        "organization": "National Disaster Response Force",
        "team_type": "CYCLONE_FLOOD_SPECIALIST",
        "status": "EN_ROUTE",
        "latitude": 16.5062,
        "longitude": 80.6480,
        "contact_phone": "+91-866-2458999",
        "created_at": _now_iso(),
    },
    {
        "id": TEAM_5_ID,
        "team_name": "Kerala SDRF Mountain Task Force",
        "organization": "State Disaster Response Force",
        "team_type": "LANDSLIDE_EXTRACTION",
        "status": "BUSY",
        "latitude": 11.6854,
        "longitude": 76.1320,
        "contact_phone": "+91-4936-202202",
        "created_at": _now_iso(),
    },
    {
        "id": TEAM_6_ID,
        "team_name": "Indian Coast Guard Coastal QRT",
        "organization": "Ministry of Defence",
        "team_type": "COASTAL_MARITIME_RESCUE",
        "status": "AVAILABLE",
        "latitude": 18.9220,
        "longitude": 72.8347,
        "contact_phone": "+91-22-22661555",
        "created_at": _now_iso(),
    },
]

FALLBACK_INCIDENTS: List[Dict[str, Any]] = [
    {
        "id": INCIDENT_1_ID,
        "incident_type": "FLOOD",
        "severity": "CRITICAL",
        "status": "OPEN",
        "title": "Brahmaputra Major Inundation - Guwahati Sector",
        "description": "River water level exceeded danger mark by 1.84m following continuous cloudburst in upper catchment. 14 villages inundated, NH-37 partially submerged.",
        "source": "CWC_TELEMETRY",
        "external_event_id": "CWC-BRAHMA-2026-001",
        "latitude": 26.1850,
        "longitude": 91.7470,
        "reported_at": _now_iso(),
        "created_at": _now_iso(),
    },
    {
        "id": INCIDENT_2_ID,
        "incident_type": "LANDSLIDE",
        "severity": "HIGH",
        "status": "DISPATCHED",
        "title": "Wayanad Ghat Road Slope Subsidence",
        "description": "Massive slope failure triggered by high antecedent rainfall. Debris obstructing SH-54 connecting Meppadi to Chooralmala. Structural damage to 6 hillside structures.",
        "source": "GSI_INVENTORY",
        "external_event_id": "GSI-WYND-2026-004",
        "latitude": 11.5300,
        "longitude": 76.1500,
        "reported_at": _now_iso(),
        "created_at": _now_iso(),
    },
    {
        "id": INCIDENT_3_ID,
        "incident_type": "EARTHQUAKE",
        "severity": "MEDIUM",
        "status": "INVESTIGATING",
        "title": "Chamoli Tectonic Tremor M4.6",
        "description": "Shallow depth 10km seismic event detected along Main Central Thrust (MCT). Tremors felt across Gopeshwar, Joshimath, and Rudraprayag. No casualties reported, minor cracks in older masonry.",
        "source": "USGS_SEISMIC",
        "external_event_id": "USGS-US7000CHAM",
        "latitude": 30.4100,
        "longitude": 79.3200,
        "reported_at": _now_iso(),
        "created_at": _now_iso(),
    },
    {
        "id": INCIDENT_4_ID,
        "incident_type": "HEAVY_RAINFALL",
        "severity": "HIGH",
        "status": "OPEN",
        "title": "Mumbai Coastal Flash Waterlogging",
        "description": "Extremely heavy rainfall (185mm in 6 hours) during high tide cycle. Water accumulation at Hindmata, Milan Subway, and Sion Junction. Traffic diversions operational.",
        "source": "IMD_NOWCAST",
        "external_event_id": "IMD-MUM-2026-009",
        "latitude": 18.9800,
        "longitude": 72.8200,
        "reported_at": _now_iso(),
        "created_at": _now_iso(),
    },
]

FALLBACK_DISPATCHES: List[Dict[str, Any]] = [
    {
        "id": DISPATCH_1_ID,
        "incident_id": INCIDENT_1_ID,
        "team_id": TEAM_1_ID,
        "dispatcher_id": OFFICIAL_2_ID,
        "assigned_location": {"latitude": 26.1850, "longitude": 91.7470},
        "latitude": 26.1850,
        "longitude": 91.7470,
        "priority": "CRITICAL",
        "instructions": "Mobilize 4 inflatable motorboats and medical kit. Prioritize evacuation of elderly and school children trapped in flood shelter sector 4.",
        "status": "EN_ROUTE",
        "assigned_at": _now_iso(),
        "acknowledged_at": _now_iso(),
        "completed_at": None,
        "team_name": "NDRF 01 Battalion (Guwahati Alpha)",
        "organization": "National Disaster Response Force",
        "team_type": "FLOOD_RESCUE",
        "incident_type": "FLOOD",
        "incident_severity": "CRITICAL",
        "dispatcher_name": "Duty Officer Priya Nair",
    },
    {
        "id": DISPATCH_2_ID,
        "incident_id": INCIDENT_2_ID,
        "team_id": TEAM_5_ID,
        "dispatcher_id": OFFICIAL_2_ID,
        "assigned_location": {"latitude": 11.5300, "longitude": 76.1500},
        "latitude": 11.5300,
        "longitude": 76.1500,
        "priority": "HIGH",
        "instructions": "Establish safety perimeter around landslide toe. Coordinate with PWD for heavy earthmovers to clear highway debris.",
        "status": "ON_SCENE",
        "assigned_at": _now_iso(),
        "acknowledged_at": _now_iso(),
        "completed_at": None,
        "team_name": "Kerala SDRF Mountain Task Force",
        "organization": "State Disaster Response Force",
        "team_type": "LANDSLIDE_EXTRACTION",
        "incident_type": "LANDSLIDE",
        "incident_severity": "HIGH",
        "dispatcher_name": "Duty Officer Priya Nair",
    },
    {
        "id": DISPATCH_3_ID,
        "incident_id": INCIDENT_3_ID,
        "team_id": TEAM_3_ID,
        "dispatcher_id": OFFICIAL_1_ID,
        "assigned_location": {"latitude": 30.4100, "longitude": 79.3200},
        "latitude": 30.4100,
        "longitude": 79.3200,
        "priority": "MEDIUM",
        "instructions": "Conduct rapid structural vulnerability assessment of local bridges and critical hospital structures in Chamoli district.",
        "status": "ASSIGNED",
        "assigned_at": _now_iso(),
        "acknowledged_at": None,
        "completed_at": None,
        "team_name": "NDRF 08 Battalion (Ghaziabad Strike)",
        "organization": "National Disaster Response Force",
        "team_type": "HEAVY_DISASTER_RESCUE",
        "incident_type": "EARTHQUAKE",
        "incident_severity": "MEDIUM",
        "dispatcher_name": "Commander Rajesh Sharma",
    },
]

FALLBACK_ALERTS: List[Dict[str, Any]] = [
    # ── SACHET / NDMA ──────────────────────────────────────────────────────────
    {
        "id": str(uuid.uuid4()),
        "source": "SACHET",
        "external_id": "SACHET-NDMA-CYC-RED-01",
        "alert_type": "Cyclone Warning - Red Alert",
        "headline": "Severe Cyclonic Storm approaching Andhra & South Odisha Coastline",
        "description": "Gale wind speed reaching 90-100 kmph gusting to 110 kmph prevailing over Westcentral Bay of Bengal. Inundation of coastal habitations anticipated during high tide. Evacuation of all coastal vulnerable zones immediately advised. Fishermen must not venture into deep sea.",
        "severity": "Extreme",
        "urgency": "Immediate",
        "certainty": "Observed",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Coastal Andhra Pradesh & South Odisha Coastline",
        "geometry": '{"type":"Polygon","coordinates":[[[82.0,15.5],[85.0,17.5],[86.5,19.5],[84.0,19.0],[81.5,16.0],[82.0,15.5]]]}',
        "raw_payload": {"sender": "NDMA_SACHET", "priority": "HIGH"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "SACHET",
        "external_id": "SACHET-AP-LIGHTNING-14",
        "alert_type": "Lightning Flash Alert",
        "headline": "Extreme Lightning Hazard Over Coastal Habitations — Seek Shelter Immediately",
        "description": "Possibility of severe lightning in open coastal habitations. Avoid open fields, tall trees, electrical poles and metallic structures. Seek shelter in concrete structures immediately. Andhra Pradesh Disaster Management Authority advisory.",
        "severity": "Extreme",
        "urgency": "Immediate",
        "certainty": "Observed",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Krishna, Guntur & Prakasam (Andhra Pradesh)",
        "geometry": '{"type":"Point","coordinates":[80.44,16.31]}',
        "raw_payload": {"sender": "APDMA"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "SACHET",
        "external_id": "SACHET-TS-THUNDER-07",
        "alert_type": "Thunderstorm & Lightning Warning",
        "headline": "Thunderstorm with Lightning & Gusty Winds (30-40 kmph) — Isolated Districts",
        "description": "Thunderstorm accompanied with lightning and gusty winds likely at isolated places in Jayashankar Bhupalapally, Mulugu, Bhadradri Kothagudem, Khammam, Nalgonda, Suryapet, Mahabubabad, Warangal, Hanamkonda, Jangaon, Siddipet, Yadadri Bhuvanagiri, Rangareddy, Hyderabad and MDCM districts.",
        "severity": "Severe",
        "urgency": "Expected",
        "certainty": "Likely",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Warangal, Khammam & Rangareddy (Telangana)",
        "geometry": '{"type":"Point","coordinates":[79.88,17.98]}',
        "raw_payload": {"sender": "IMD_HYD"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "SACHET",
        "external_id": "SACHET-TN-NORTHEAST-17",
        "alert_type": "Northeast Monsoon Surge Warning",
        "headline": "Intense Rainfall Forecast over Coastal Tamil Nadu & Delta Districts",
        "description": "Low pressure area over southwest Bay of Bengal intensifying. Very heavy rainfall predicted over Chennai, Chengalpattu, Cuddalore and Nagapattinam. Citizens advised to avoid basement rooms and waterlogged streets.",
        "severity": "Severe",
        "urgency": "Expected",
        "certainty": "Likely",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Chennai & Delta Region (Tamil Nadu)",
        "geometry": '{"type":"Point","coordinates":[80.27,13.08]}',
        "raw_payload": {"sender": "TNSDMA"},
        "created_at": _now_iso(),
    },
    # ── IMD ────────────────────────────────────────────────────────────────────
    {
        "id": str(uuid.uuid4()),
        "source": "IMD",
        "external_id": "IMD-FLASH-HIMALAYA-02",
        "alert_type": "Flash Flood & Cloudburst Warning",
        "headline": "Continuous Cloudburst Activity over Eastern Himalayas & Foothill Streams",
        "description": "Continuous cloudburst activity over eastern Himalayas likely to cause localized flooding and mudslides in low-lying roads and agrarian tracts. Alert issued for Lower Subansiri, Papum Pare & Sonitpur districts.",
        "severity": "Severe",
        "urgency": "Expected",
        "certainty": "Likely",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Lower Subansiri, Papum Pare & Sonitpur (Arunachal/Assam)",
        "geometry": '{"type":"Polygon","coordinates":[[[92.5,26.8],[94.0,27.5],[94.5,28.2],[93.0,27.9],[92.5,26.8]]]}',
        "raw_payload": {"sender": "IMD_HQ"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "IMD",
        "external_id": "IMD-AP-WIND-06",
        "alert_type": "Squally Wind & Coastal Alert",
        "headline": "Squally Weather with Strong Surface Wind 40-50 Kmph Along Andhra Coast",
        "description": "Strong surface winds gusting to 60 kmph very likely along and off Andhra Pradesh coast. Port cautionary signal hoisted at Visakhapatnam, Machilipatnam and Kakinada. Fishing vessels must return to harbour.",
        "severity": "Severe",
        "urgency": "Expected",
        "certainty": "Likely",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Coastal Andhra Pradesh & Northern Coromandel",
        "geometry": '{"type":"Point","coordinates":[83.21,17.68]}',
        "raw_payload": {"sender": "IMD_VIZ"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "IMD",
        "external_id": "IMD-NE-THUNDER-09",
        "alert_type": "Thunderstorm & Heavy Rain Alert",
        "headline": "IMD Guwahati: Thunderstorm with Lightning across Brahmaputra Valley",
        "description": "Thunderstorm with lightning and light to moderate rainfall likely over Kamrup Metro, Nalbari, Barpeta, Baksa and Goalpara districts. Citizens advised to stay indoors and avoid river banks.",
        "severity": "Moderate",
        "urgency": "Expected",
        "certainty": "Likely",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Kamrup & Lower Brahmaputra Valley (Assam)",
        "geometry": '{"type":"Point","coordinates":[91.74,26.14]}',
        "raw_payload": {"sender": "IMD_GUW"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "IMD",
        "external_id": "IMD-MH-KONKAN-12",
        "alert_type": "Heavy to Very Heavy Rain Warning",
        "headline": "Active Offshore Trough: Very Heavy Rain over Konkan & Western Ghats",
        "description": "Widespread rainfall with isolated very heavy falls likely over Raigad, Ratnagiri, Sindhudurg and Pune/Satara ghat sections. Coastal district magistrates placed on standby.",
        "severity": "Severe",
        "urgency": "Expected",
        "certainty": "Likely",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Konkan & Western Ghats (Maharashtra)",
        "geometry": '{"type":"Point","coordinates":[73.30,18.99]}',
        "raw_payload": {"sender": "IMD_MUM"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "IMD",
        "external_id": "IMD-HP-FLASH-15",
        "alert_type": "Flash Flood & Mudflow Warning",
        "headline": "Heavy Pre-Winter Convection over Beas and Sutlej River Valleys",
        "description": "Possibility of rockfall and debris flow along Kullu-Manali highway (NH-3) and Shimla-Kinnaur NH-05. Tourists advised to avoid riverbed camping and night travel on mountain roads.",
        "severity": "Severe",
        "urgency": "Expected",
        "certainty": "Likely",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Kullu, Mandi & Shimla (Himachal Pradesh)",
        "geometry": '{"type":"Point","coordinates":[77.11,31.98]}',
        "raw_payload": {"sender": "IMD_SHM"},
        "created_at": _now_iso(),
    },
    # ── CWC ────────────────────────────────────────────────────────────────────
    {
        "id": str(uuid.uuid4()),
        "source": "CWC",
        "external_id": "CWC-ASSAM-BRAHMA-13",
        "alert_type": "Severe Flood Warning — Stage 3",
        "headline": "River Brahmaputra Exceeding Danger Level by 1.84m at Guwahati",
        "description": "Water level at 50.84m against danger mark of 49.00m with sharply rising trend. 14 revenue circles in Kamrup and Morigaon placed on Stage-3 red alert. Ferry operations suspended on all river ghats.",
        "severity": "Extreme",
        "urgency": "Immediate",
        "certainty": "Observed",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Kamrup Metro & Morigaon (Assam)",
        "geometry": '{"type":"Point","coordinates":[91.74,26.18]}',
        "raw_payload": {"sender": "CWC_GUW"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "CWC",
        "external_id": "CWC-GODAVARI-03",
        "alert_type": "River Discharge Inundation Advisory",
        "headline": "River Godavari Rising Rapidly at Polavaram & Bhadrachalam",
        "description": "Inflow rate at Polavaram has exceeded 4.5 lakh cusecs. First warning flag hoisted at Dowleswaram Barrage. Inundation of island villages (Lanka habitations) underway. Residents advised immediate evacuation.",
        "severity": "Severe",
        "urgency": "Immediate",
        "certainty": "Observed",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Godavari Basin — Bhadradri & East Godavari",
        "geometry": '{"type":"Point","coordinates":[81.18,17.67]}',
        "raw_payload": {"sender": "CWC_HYD"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "CWC",
        "external_id": "CWC-ODISHA-JALAKA-04",
        "alert_type": "River Flood — Severe Situation",
        "headline": "River Jalaka at Mathani Road Bridge Flowing Above Severe Danger Mark",
        "description": "River Jalaka in Balasore district of Odisha continues to flow in severe flood situation with rising trend. Embankments at Basta and Jaleswar under stress. NDRF flood fighting team pre-positioned.",
        "severity": "Severe",
        "urgency": "Immediate",
        "certainty": "Observed",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Balasore District (Odisha)",
        "geometry": '{"type":"Point","coordinates":[86.93,21.49]}',
        "raw_payload": {"sender": "CWC_BHU"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "CWC",
        "external_id": "CWC-AP-NAGAVALI-05",
        "alert_type": "River Flood — Above Normal Situation",
        "headline": "River Nagavali at Srikakulam Exceeding Warning Level at 9.42m",
        "description": "River Nagavali in Srikakulam district of Andhra Pradesh flowing in above normal flood situation. Water level 9.42m against warning mark 8.00m. Villages in low-lying areas alerted.",
        "severity": "Severe",
        "urgency": "Expected",
        "certainty": "Observed",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Srikakulam (Andhra Pradesh)",
        "geometry": '{"type":"Point","coordinates":[83.89,18.29]}',
        "raw_payload": {"sender": "CWC_VIZ"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "CWC",
        "external_id": "CWC-OD-RISHI-08",
        "alert_type": "River Discharge Inundation Advisory",
        "headline": "River Rishikulya at Purushottampur Flowing Above Normal Flood Level",
        "description": "River Rishikulya in Ganjam district of Odisha continues to rise due to heavy precipitation in upper catchment. Riparian habitations in Berhampur taluka advised vigilance.",
        "severity": "Moderate",
        "urgency": "Expected",
        "certainty": "Observed",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Ganjam District (Odisha)",
        "geometry": '{"type":"Point","coordinates":[84.88,19.34]}',
        "raw_payload": {"sender": "CWC_BHU"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "CWC",
        "external_id": "CWC-BIHAR-KOSI-16",
        "alert_type": "High Discharge Flood Advisory",
        "headline": "River Kosi Discharge at Birpur Barrage Exceeds 2.2 Lakh Cusecs",
        "description": "Water level touching warning mark at Supaul and Saharsa. Embankment breach risk elevated at 3 sensitive spurs. NDRF flood fighting teams pre-positioned at Araria and Supaul.",
        "severity": "Severe",
        "urgency": "Expected",
        "certainty": "Observed",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Supaul & Saharsa (Bihar)",
        "geometry": '{"type":"Point","coordinates":[86.60,25.99]}',
        "raw_payload": {"sender": "CWC_PAT"},
        "created_at": _now_iso(),
    },
    # ── GSI ────────────────────────────────────────────────────────────────────
    {
        "id": str(uuid.uuid4()),
        "source": "GSI",
        "external_id": "GSI-WYND-SLOPE-10",
        "alert_type": "Landslide High Hazard Warning",
        "headline": "High Antecedent Precipitation Triggering Slope Failures — Wayanad Ghat",
        "description": "Heavy rainfall exceeding 140mm in 24 hours has fully saturated soil layers in Meppadi, Chooralmala and Vythiri sectors. Multiple shallow landslides reported. NH-766 partially obstructed. SDRF dispatched.",
        "severity": "Extreme",
        "urgency": "Immediate",
        "certainty": "Likely",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Wayanad Ghat Section (Kerala)",
        "geometry": '{"type":"Point","coordinates":[76.13,11.61]}',
        "raw_payload": {"sender": "GSI_TRIVANDRUM"},
        "created_at": _now_iso(),
    },
    # ── USGS ───────────────────────────────────────────────────────────────────
    {
        "id": str(uuid.uuid4()),
        "source": "USGS",
        "external_id": "USGS-EQ-M48-KASHMIR",
        "alert_type": "Moderate Seismic Tremor M4.8",
        "headline": "Seismic Event M4.8 Recorded — Hindukush-Kashmir Boundary Zone",
        "description": "Epicenter at 36.18 N, 74.22 E at focal depth 120km. Tremors felt across Baramulla, Kupwara, and Srinagar valley. NDMA monitoring update team deployed. No structural damage reported.",
        "severity": "Moderate",
        "urgency": "Past",
        "certainty": "Observed",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Jammu & Kashmir (Northern Seismic Zone)",
        "geometry": '{"type":"Point","coordinates":[74.22,36.18]}',
        "raw_payload": {"sender": "USGS_EVAL"},
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "source": "USGS",
        "external_id": "USGS-EQ-UTTARAKHAND-18",
        "alert_type": "Minor Seismic Activity M3.9",
        "headline": "Shallow Tremor M3.9 Along Main Central Thrust (MCT) Near Joshimath",
        "description": "Epicenter 15km north of Joshimath, focal depth 10km. Minor vibrations recorded by Wadia Institute of Himalayan Geology seismic network. Structural assessment of Joshimath zone underway.",
        "severity": "Moderate",
        "urgency": "Past",
        "certainty": "Observed",
        "issued_at": _now_iso(),
        "effective_at": _now_iso(),
        "expires_at": _now_iso(),
        "area_name": "Chamoli & Rudraprayag (Uttarakhand)",
        "geometry": '{"type":"Point","coordinates":[79.56,30.56]}',
        "raw_payload": {"sender": "USGS_EVAL"},
        "created_at": _now_iso(),
    },
]

FALLBACK_CITIZEN_REPORTS: List[Dict[str, Any]] = [
    {
        "id": str(uuid.uuid4()),
        "name": "Arun Kumar",
        "phone": "+91-9876543210",
        "category": "FLOOD",
        "incident_type": "FLOOD",
        "title": "Water entering residential ground floors in Silchar",
        "description": "Barak river embankment seepage has flooded Sonai Road. Water level is chest-high. Need assistance for 5 families.",
        "latitude": 24.8333,
        "longitude": 92.7789,
        "status": "SUBMITTED",
        "created_at": _now_iso(),
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Manju Devi",
        "phone": "+91-9812345678",
        "category": "LANDSLIDE",
        "incident_type": "LANDSLIDE",
        "title": "Boulders on Badrinath National Highway near Pipalkoti",
        "description": "Continuous rockfall observed after morning downpour. Heavy traffic halted in both directions.",
        "latitude": 30.4300,
        "longitude": 79.4300,
        "status": "VERIFIED",
        "created_at": _now_iso(),
    },
]

# ============================================================
# IN-MEMORY STORE CLASS
# ============================================================

class FallbackStore:
    def __init__(self):
        self.officials = list(FALLBACK_OFFICIALS)
        self.rescue_teams = list(FALLBACK_RESCUE_TEAMS)
        self.incidents = list(FALLBACK_INCIDENTS)
        self.dispatches = list(FALLBACK_DISPATCHES)
        self.alerts = list(FALLBACK_ALERTS)
        self.citizen_reports = list(FALLBACK_CITIZEN_REPORTS)
        self._landslides_cache: Optional[List[Dict[str, Any]]] = None
        self._cwc_stations_cache: Optional[List[Dict[str, Any]]] = None
        self._cwc_rainfall_cache: Optional[List[Dict[str, Any]]] = None
        self._earthquakes_cache: Optional[List[Dict[str, Any]]] = None

    # --------------------------------------------------------
    # OFFICIALS
    # --------------------------------------------------------
    def get_officials(self, active_only: bool = True, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        items = [o for o in self.officials if not active_only or o.get("is_active", True)]
        total = len(items)
        return {"total": total, "limit": limit, "offset": offset, "officials": items[offset : offset + limit]}

    # --------------------------------------------------------
    # RESCUE TEAMS
    # --------------------------------------------------------
    def get_rescue_teams(self, status: Optional[str] = None, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        items = self.rescue_teams
        if status:
            items = [t for t in items if str(t.get("status", "")).upper() == status.upper()]
        return {"items": items[offset : offset + limit], "count": len(items), "limit": limit, "offset": offset}

    def get_rescue_team_counts(self) -> Dict[str, int]:
        counts = {"available": 0, "en_route": 0, "deployed": 0, "busy": 0, "offline": 0, "total": len(self.rescue_teams)}
        for t in self.rescue_teams:
            st = str(t.get("status", "AVAILABLE")).lower()
            if st in counts:
                counts[st] += 1
        return counts

    def create_rescue_team(self, data: Dict[str, Any]) -> Dict[str, Any]:
        team = {
            "id": str(uuid.uuid4()),
            "team_name": data.get("team_name"),
            "organization": data.get("organization") or "Disaster Response Division",
            "team_type": data.get("team_type") or "GENERAL",
            "status": data.get("status") or "AVAILABLE",
            "latitude": data.get("latitude") or 20.5937,
            "longitude": data.get("longitude") or 78.9629,
            "contact_phone": data.get("contact_phone") or "+91-11-23438000",
            "created_at": _now_iso(),
        }
        self.rescue_teams.insert(0, team)
        return team

    # --------------------------------------------------------
    # INCIDENTS
    # --------------------------------------------------------
    def get_incident_counts(self) -> Dict[str, int]:
        counts = {"open_incidents": 0, "investigating": 0, "dispatched": 0, "resolved": 0, "closed": 0, "total_incidents": len(self.incidents)}
        for inc in self.incidents:
            st = str(inc.get("status", "OPEN")).lower()
            if st == "open":
                counts["open_incidents"] += 1
            elif st == "investigating":
                counts["investigating"] += 1
            elif st == "dispatched":
                counts["dispatched"] += 1
            elif st == "resolved":
                counts["resolved"] += 1
            elif st == "closed":
                counts["closed"] += 1
        return counts

    def get_incidents(self, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        return {
            "items": self.incidents[offset : offset + limit],
            "count": len(self.incidents),
            "limit": limit,
            "offset": offset,
        }

    def create_incident(self, data: Dict[str, Any]) -> Dict[str, Any]:
        new_inc = {
            "id": str(uuid.uuid4()),
            "incident_type": data.get("incident_type", "FLOOD"),
            "severity": data.get("severity", "HIGH"),
            "status": "OPEN",
            "title": data.get("title", "Reported Incident"),
            "description": data.get("description", ""),
            "source": data.get("source", "AIDERS_EOC"),
            "external_event_id": f"AIDERS-{uuid.uuid4().hex[:8].upper()}",
            "latitude": float(data.get("latitude", 20.5937)),
            "longitude": float(data.get("longitude", 78.9629)),
            "reported_at": _now_iso(),
            "created_at": _now_iso(),
        }
        self.incidents.insert(0, new_inc)
        return new_inc

    # --------------------------------------------------------
    # DISPATCHES
    # --------------------------------------------------------
    def get_dispatches(self, status: Optional[str] = None, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        items = self.dispatches
        if status:
            items = [d for d in items if str(d.get("status", "")).upper() == status.upper()]
        return {"items": items[offset : offset + limit], "count": len(items), "limit": limit, "offset": offset}

    def get_dispatch_counts(self) -> Dict[str, int]:
        stats = {"total": len(self.dispatches), "assigned": 0, "acknowledged": 0, "en_route": 0, "on_scene": 0, "completed": 0, "cancelled": 0}
        for d in self.dispatches:
            st = str(d.get("status", "ASSIGNED")).lower()
            if st in stats:
                stats[st] += 1
        return stats

    def create_dispatch(self, data: Dict[str, Any]) -> Dict[str, Any]:
        inc_id = str(data.get("incident_id"))
        team_id = str(data.get("team_id"))
        disp_id = str(data.get("dispatcher_id"))

        # Find names
        inc = next((i for i in self.incidents if str(i["id"]) == inc_id), None)
        team = next((t for t in self.rescue_teams if str(t["id"]) == team_id), None)
        disp = next((o for o in self.officials if str(o["id"]) == disp_id), None)

        new_disp = {
            "id": str(uuid.uuid4()),
            "incident_id": inc_id,
            "team_id": team_id,
            "dispatcher_id": disp_id,
            "assigned_location": {
                "latitude": data.get("latitude", inc["latitude"] if inc else 20.5937),
                "longitude": data.get("longitude", inc["longitude"] if inc else 78.9629),
            },
            "latitude": data.get("latitude", inc["latitude"] if inc else 20.5937),
            "longitude": data.get("longitude", inc["longitude"] if inc else 78.9629),
            "priority": data.get("priority", "MEDIUM"),
            "instructions": data.get("instructions", ""),
            "status": "ASSIGNED",
            "assigned_at": _now_iso(),
            "acknowledged_at": None,
            "completed_at": None,
            "team_name": team["team_name"] if team else "Rescue Team",
            "organization": team.get("organization") if team else "National Disaster Response",
            "team_type": team.get("team_type") if team else "GENERAL",
            "incident_type": inc.get("incident_type") if inc else "INCIDENT",
            "incident_severity": inc.get("severity") if inc else "HIGH",
            "dispatcher_name": disp.get("full_name") if disp else "EOC Dispatcher",
        }
        self.dispatches.insert(0, new_disp)
        if team:
            team["status"] = "DEPLOYED"
        if inc:
            inc["status"] = "DISPATCHED"
        return new_disp

    def update_dispatch_status(self, dispatch_id: str, new_status: str) -> Optional[Dict[str, Any]]:
        disp = next((d for d in self.dispatches if str(d["id"]) == str(dispatch_id)), None)
        if not disp:
            return None
        disp["status"] = new_status.upper()
        now = _now_iso()
        if new_status.upper() == "ACKNOWLEDGED" and not disp.get("acknowledged_at"):
            disp["acknowledged_at"] = now
        elif new_status.upper() == "COMPLETED":
            disp["completed_at"] = now
        return disp

    # --------------------------------------------------------
    # ALERTS
    # --------------------------------------------------------
    def get_alerts(self, source: Optional[str] = None, severity: Optional[str] = None, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        items = self.alerts
        if source:
            items = [a for a in items if str(a.get("source", "")).upper() == source.upper()]
        if severity:
            items = [a for a in items if str(a.get("severity", "")).upper() == severity.upper()]
        return {"total": len(items), "limit": limit, "offset": offset, "alerts": items[offset : offset + limit]}

    # --------------------------------------------------------
    # CITIZEN REPORTS
    # --------------------------------------------------------
    def get_citizen_reports(self, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        return {
            "total": len(self.citizen_reports),
            "limit": limit,
            "offset": offset,
            "reports": self.citizen_reports[offset : offset + limit],
        }

    def create_citizen_report(self, data: Dict[str, Any]) -> Dict[str, Any]:
        report = {
            "id": str(uuid.uuid4()),
            "name": data.get("name", "Citizen"),
            "phone": data.get("phone", ""),
            "category": data.get("incident_type") or data.get("category") or "FLOOD",
            "incident_type": data.get("incident_type") or data.get("category") or "FLOOD",
            "title": data.get("title") or f"{data.get('incident_type', 'Disaster')} Report",
            "description": data.get("description", ""),
            "latitude": float(data.get("latitude", 20.5937)),
            "longitude": float(data.get("longitude", 78.9629)),
            "media_url": data.get("media_url", ""),
            "status": "SUBMITTED",
            "created_at": _now_iso(),
        }
        self.citizen_reports.insert(0, report)
        return report

    # --------------------------------------------------------
    # DATA INGESTION CACHES (LANDSLIDES, CWC, EARTHQUAKES)
    # --------------------------------------------------------
    def get_landslides(self, limit: int = 500, offset: int = 0) -> Dict[str, Any]:
        if self._landslides_cache is None:
            records = []
            csv_path = DATA_DIR / "landslides" / "gsi_landslide_inventory.csv"
            if csv_path.exists():
                try:
                    with open(csv_path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
                        reader = csv.DictReader(f)
                        count = 0
                        for row in reader:
                            try:
                                lat = float(row.get("latitude") or 0)
                                lon = float(row.get("longitude") or 0)
                                if lat != 0 and lon != 0 and -90 <= lat <= 90 and -180 <= lon <= 180:
                                    records.append({
                                        "id": count + 1,
                                        "sl_no": row.get("sl_no"),
                                        "slide_no": row.get("slide_no"),
                                        "state": row.get("state"),
                                        "district": row.get("district"),
                                        "slide_name": row.get("slide_name"),
                                        "nh_sh_location": row.get("nh_sh_location"),
                                        "latitude": lat,
                                        "longitude": lon,
                                        "material_involved": row.get("material_involved"),
                                        "movement_type": row.get("movement_type"),
                                        "history": row.get("history"),
                                    })
                                    count += 1
                                    if count >= 1000:
                                        break
                            except Exception:
                                continue
                except Exception as exc:
                    logger.warning("Error reading landslide CSV: %s", exc)
            self._landslides_cache = records
        return {
            "total": len(self._landslides_cache),
            "limit": limit,
            "offset": offset,
            "records": self._landslides_cache[offset : offset + limit],
        }

    def get_cwc_stations(self, limit: int = 500, offset: int = 0) -> Dict[str, Any]:
        if self._cwc_stations_cache is None:
            records = [
                {
                    "station_name": "Guwahati (Brahmaputra)",
                    "river": "Brahmaputra",
                    "basin": "Brahmaputra Basin",
                    "state": "Assam",
                    "district": "Kamrup Metropolitan",
                    "latitude": 26.1850,
                    "longitude": 91.7470,
                    "current_water_level": 50.84,
                    "warning_level": 49.68,
                    "danger_level": 49.90,
                    "flood_status": "DANGER",
                    "observed_at": _now_iso(),
                },
                {
                    "station_name": "Bhadrachalam (Godavari)",
                    "river": "Godavari",
                    "basin": "Godavari Basin",
                    "state": "Telangana",
                    "district": "Bhadradri Kothagudem",
                    "latitude": 17.6689,
                    "longitude": 80.8936,
                    "current_water_level": 53.20,
                    "warning_level": 48.00,
                    "danger_level": 53.00,
                    "flood_status": "DANGER",
                    "observed_at": _now_iso(),
                },
                {
                    "station_name": "Varanasi (Ganga)",
                    "river": "Ganga",
                    "basin": "Ganga Basin",
                    "state": "Uttar Pradesh",
                    "district": "Varanasi",
                    "latitude": 25.3176,
                    "longitude": 83.0062,
                    "current_water_level": 71.26,
                    "warning_level": 70.26,
                    "danger_level": 71.26,
                    "flood_status": "ALERT",
                    "observed_at": _now_iso(),
                },
                {
                    "station_name": "Delhi Old Railway Bridge (Yamuna)",
                    "river": "Yamuna",
                    "basin": "Ganga-Yamuna Basin",
                    "state": "Delhi",
                    "district": "Central Delhi",
                    "latitude": 28.6650,
                    "longitude": 77.2490,
                    "current_water_level": 205.80,
                    "warning_level": 204.50,
                    "danger_level": 205.33,
                    "flood_status": "DANGER",
                    "observed_at": _now_iso(),
                },
                {
                    "station_name": "Prakasam Barrage (Krishna)",
                    "river": "Krishna",
                    "basin": "Krishna Basin",
                    "state": "Andhra Pradesh",
                    "district": "Krishna",
                    "latitude": 16.5080,
                    "longitude": 80.6120,
                    "current_water_level": 17.30,
                    "warning_level": 16.50,
                    "danger_level": 17.00,
                    "flood_status": "ALERT",
                    "observed_at": _now_iso(),
                },
            ]
            csv_path = DATA_DIR / "cwc" / "rwl_test_1000.csv"
            if csv_path.exists():
                try:
                    with open(csv_path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
                        reader = csv.DictReader(f)
                        seen = set()
                        for row in reader:
                            st_name = row.get("Station")
                            if not st_name or st_name in seen:
                                continue
                            seen.add(st_name)
                            try:
                                lat = float(row.get("Latitude") or 0)
                                lon = float(row.get("Longitude") or 0)
                                wl = float(row.get("River Water Level Telemetry Hourly (meter)") or 0)
                                if lat != 0 and lon != 0:
                                    records.append({
                                        "station_name": st_name,
                                        "river": row.get("River", "River Basin"),
                                        "basin": row.get("Basin", "National Basin"),
                                        "state": row.get("State", ""),
                                        "district": row.get("District", ""),
                                        "latitude": lat,
                                        "longitude": lon,
                                        "current_water_level": wl,
                                        "warning_level": round(wl * 1.05, 2),
                                        "danger_level": round(wl * 1.12, 2),
                                        "flood_status": "NORMAL" if wl < 500 else ("ALERT" if wl < 520 else "DANGER"),
                                        "observed_at": row.get("Data Acquisition Time") or _now_iso(),
                                    })
                            except Exception:
                                continue
                except Exception as exc:
                    logger.warning("Error reading CWC water level CSV: %s", exc)
            self._cwc_stations_cache = records
        return {
            "total": len(self._cwc_stations_cache),
            "limit": limit,
            "offset": offset,
            "records": self._cwc_stations_cache[offset : offset + limit],
        }

    def get_cwc_rainfall(self, limit: int = 500, offset: int = 0) -> Dict[str, Any]:
        if self._cwc_rainfall_cache is None:
            records = []
            csv_path = DATA_DIR / "cwc" / "rainfall_test.csv"
            if csv_path.exists():
                try:
                    with open(csv_path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
                        reader = csv.DictReader(f)
                        seen = set()
                        for row in reader:
                            st_name = row.get("Station")
                            if not st_name or st_name in seen:
                                continue
                            seen.add(st_name)
                            try:
                                lat = float(row.get("Latitude") or 0)
                                lon = float(row.get("Longitude") or 0)
                                rf = float(row.get("Manual Hourly Rainfall (mm)") or 0)
                                if lat != 0 and lon != 0:
                                    records.append({
                                        "station_name": st_name,
                                        "river": row.get("River", "River Basin"),
                                        "basin": row.get("Basin", "National Basin"),
                                        "state": row.get("State", ""),
                                        "district": row.get("District", ""),
                                        "latitude": lat,
                                        "longitude": lon,
                                        "rainfall_mm": rf,
                                        "observed_at": row.get("Data Acquisition Time") or _now_iso(),
                                    })
                            except Exception:
                                continue
                except Exception as exc:
                    logger.warning("Error reading CWC rainfall CSV: %s", exc)
            self._cwc_rainfall_cache = records
        return {
            "total": len(self._cwc_rainfall_cache),
            "limit": limit,
            "offset": offset,
            "records": self._cwc_rainfall_cache[offset : offset + limit],
        }

    def get_earthquakes(self, limit: int = 500, offset: int = 0, min_magnitude: Optional[float] = None) -> Dict[str, Any]:
        if self._earthquakes_cache is None:
            self._earthquakes_cache = [
                {
                    "id": str(uuid.uuid4()),
                    "incident_type": "EARTHQUAKE",
                    "magnitude": 5.4,
                    "severity": "HIGH",
                    "status": "OPEN",
                    "title": "M5.4 Earthquake - Hindu Kush Region",
                    "description": "Focal depth 180km. Strong tremors felt in Jammu, Kashmir, Punjab, and Delhi NCR.",
                    "source": "USGS",
                    "external_event_id": "usgs_hk_54",
                    "latitude": 36.42,
                    "longitude": 71.35,
                    "occurred_at": _now_iso(),
                },
                {
                    "id": str(uuid.uuid4()),
                    "incident_type": "EARTHQUAKE",
                    "magnitude": 4.6,
                    "severity": "MEDIUM",
                    "status": "OPEN",
                    "title": "M4.6 Earthquake - Chamoli Garhwal, Uttarakhand",
                    "description": "Focal depth 10km. Shallow tremor reported along Alaknanda valley.",
                    "source": "USGS",
                    "external_event_id": "usgs_cham_46",
                    "latitude": 30.41,
                    "longitude": 79.32,
                    "occurred_at": _now_iso(),
                },
                {
                    "id": str(uuid.uuid4()),
                    "incident_type": "EARTHQUAKE",
                    "magnitude": 5.1,
                    "severity": "HIGH",
                    "status": "OPEN",
                    "title": "M5.1 Earthquake - Andaman Sea Tectonic Rift",
                    "description": "Focal depth 35km. Subduction zone seismic activity east of Port Blair.",
                    "source": "USGS",
                    "external_event_id": "usgs_and_51",
                    "latitude": 11.65,
                    "longitude": 93.75,
                    "occurred_at": _now_iso(),
                },
                {
                    "id": str(uuid.uuid4()),
                    "incident_type": "EARTHQUAKE",
                    "magnitude": 4.2,
                    "severity": "LOW",
                    "status": "CLOSED",
                    "title": "M4.2 Earthquake - Shillong Plateau, Meghalaya",
                    "description": "Focal depth 15km. Minor tremors recorded near Nongpoh.",
                    "source": "USGS",
                    "external_event_id": "usgs_shil_42",
                    "latitude": 25.88,
                    "longitude": 91.88,
                    "occurred_at": _now_iso(),
                },
                {
                    "id": str(uuid.uuid4()),
                    "incident_type": "EARTHQUAKE",
                    "magnitude": 3.9,
                    "severity": "LOW",
                    "status": "CLOSED",
                    "title": "M3.9 Earthquake - Koyna Reservoir Fault Zone",
                    "description": "Reservoir triggered seismicity (RTS) near Koyna Dam, Satara district, Maharashtra.",
                    "source": "USGS",
                    "external_event_id": "usgs_koyna_39",
                    "latitude": 17.40,
                    "longitude": 73.75,
                    "occurred_at": _now_iso(),
                },
            ]
        items = self._earthquakes_cache
        if min_magnitude is not None:
            items = [e for e in items if float(e.get("magnitude", 0)) >= min_magnitude]
        return {
            "total": len(items),
            "limit": limit,
            "offset": offset,
            "earthquakes": items[offset : offset + limit],
            "records": items[offset : offset + limit],
        }

    def get_flood_risk(self, limit: int = 100) -> Dict[str, Any]:
        stations = self.get_cwc_stations(limit=limit)["records"]
        records = []
        for s in stations:
            wl = float(s.get("current_water_level", 0))
            score = 88 if wl > 518.13 else (65 if wl > 500 else 30)
            level = "CRITICAL" if score >= 80 else ("HIGH" if score >= 60 else "MODERATE")
            records.append({
                "station_name": s["station_name"],
                "river": s["river"],
                "state": s["state"],
                "latitude": s["latitude"],
                "longitude": s["longitude"],
                "risk_score": score,
                "risk_level": level,
                "current_level_m": wl,
                "warning_level_m": s.get("warning_level"),
                "danger_level_m": s.get("danger_level"),
            })
        return {"total": len(records), "records": records}


# Global fallback singleton
fallback_store = FallbackStore()

