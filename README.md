# AIDERS — AI Disaster Intelligence & Emergency Response System

> **Mission-Critical National Command Center & Emergency Operations Platform**  
> Real-time integration of NDMA SACHET government alerts, IMD meteorological nowcasts, Central Water Commission (CWC) river telemetry, Geological Survey of India (GSI) landslides, USGS seismic data, and AI-powered zero-shot visual damage classification.

---

## 🏛️ Executive Overview

**AIDERS** is an enterprise-grade Emergency Operations Center (EOC) platform built to empower disaster response commanders, district magistrates, and field rescue forces (NDRF / SDRF) with unified geospatial intelligence, automated resource dispatching, and citizen crowdsourced life-safety reporting.

### Core System Architecture

```
                                  ┌───────────────────────────────┐
                                  │      AIDERS Command Center    │
                                  │   React 18 + Vite + Leaflet   │
                                  └───────────────┬───────────────┘
                                                  │ REST / WebSocket
                                  ┌───────────────▼───────────────┐
                                  │       FastAPI API Gateway     │
                                  │  (Port 8000 · Python 3.11)    │
                                  └───────┬───────────────┬───────┘
                                          │               │
                     ┌────────────────────▼─────┐   ┌─────▼────────────────────┐
                     │   PostgreSQL + PostGIS   │   │  Resilient Fallback Hub  │
                     │  (Spatial GIST Indexing) │   │ (In-Memory Tactical EOC) │
                     └──────────────────────────┘   └──────────────────────────┘
                                          ▲
                                          │
       ┌──────────────────┬───────────────┼───────────────┬──────────────────┐
       │                  │               │               │                  │
┌──────┴───────┐   ┌──────┴───────┐ ┌─────┴──────┐ ┌──────┴───────┐   ┌──────┴───────┐
│ NDMA SACHET  │   │  IMD Weather │ │ CWC / NWIC │ │     GSI      │   │     USGS     │
│  Alert Feed  │   │   Nowcasts   │ │ Water/Rain │ │  Landslides  │   │ Seismic Tele │
└──────────────┘   └──────────────┘ └────────────┘ └──────────────┘   └──────────────┘
```

---

## 🚀 Key Operational Modules

### 1. 🛰️ National Command Center (EOC Dashboard)
- **DEFCON Readiness Meter**: Live threat posture tracking (`DEFCON 2 · ELEVATED READINESS`).
- **Dual Synchronized Master Clocks**: Simultaneous precision UTC and Indian Standard Time (IST).
- **Acoustic Audio Siren System**: Web Audio API-synthesized critical alert siren and dispatch ping alarms (toggleable with persistent memory).
- **Live Advisory Ticker Ribbon**: Continuous marquee broadcasting active NDMA / IMD / CWC critical warning bulletins.
- **Situation Report (SITREP) Generator**: One-click official SITREP briefing export with print-optimized CSS for executive meetings and PDF archival.

### 2. 🗺️ Geospatial Intelligence GIS Map
- High-performance Leaflet engine rendered on tactical dark cartography.
- Multi-layer real telemetry toggles:
  - **Earthquake Epicenters**: Color-coded by magnitude (M3.5 to M6.5+) with depth and focal mechanism.
  - **CWC River Hydrological Telemetry**: Real-time river water levels, warning marks, and danger thresholds across Godavari, Krishna, and Brahmaputra basins.
  - **CWC Rainfall Observations**: Hourly gauge measurements and intensity heatmaps.
  - **GSI Field-Validated Landslides**: 500+ Geological Survey of India landslide inventory points.
  - **SACHET Warning Polygons**: Real-time polygon geospatial geometries for cyclone and flash flood sectors.

### 3. 🚨 Operations & Resource Dispatch Command
- **Incident Register**: Real-time incident logs covering `FLOOD`, `LANDSLIDE`, `EARTHQUAKE`, and `HEAVY_RAINFALL`.
- **NDRF / SDRF Mobilization**: Track specialized rescue battalions (Guwahati 01-Bn, Arakkonam 04-Bn, Ghaziabad 08-Bn, Vijayawada 10-Bn, Kerala SDRF, Indian Coast Guard).
- **Status Lifecycle Workflow**: `ASSIGNED` ➔ `ACKNOWLEDGED` ➔ `EN_ROUTE` ➔ `ON_SCENE` ➔ `COMPLETED`.
- **Dispatch Creation Modal**: Assign available teams, set operational priority (`CRITICAL`, `HIGH`, `MEDIUM`), and transmit field instructions.

### 4. 🧠 AI Disaster Computer Vision Laboratory
- **Zero-Shot CLIP Deep Learning**: Instant visual damage classification (`openai/clip-vit-base-patch32`).
- **Interactive Scenarios**: Pre-loaded test cases for Flood Inundation, Mountain Landslides, Seismic Shear Cracks, and Forest Fires.
- **Neural Confidence Meter**: Visual confidence probability score and damage severity assessment.
- **One-Click Incident Elevation**: Instantly promote visual AI findings into verified EOC incidents and dispatch response battalions.

### 5. 👥 Citizen Emergency & SOS Portal
- **One-Touch SOS Emergency Beacon**: High-priority distress signal broadcasting live geolocation to district EOCs.
- **Detailed Disaster Reporting**: Form with GPS coordinate acquisition, category picker, and scene photo upload.
- **Offline & Resilient Queueing**: Continues functioning and issuing reference tracking tokens even under degraded network conditions.

### 6. ☎️ Emergency Directory & Standard Operating Procedures (SOP)
- **Speed-Dial Cards**: Direct links for `112` (Unified National Emergency), `1078` (NDRF HQ), `1070` (State Relief Commissioner), `108` (Ambulance), and `101` (Fire).
- **NDMA Disaster Safety SOPs**: Actionable life-safety checklists for Floods, Landslides, Earthquakes, and Cyclones.

---

## ⚡ Zero-Setup Resilient Architecture

AIDERS is engineered for **unconditional availability**. It features an intelligent **Dual-Engine Persistence Layer**:

1. **Production Mode (PostgreSQL + PostGIS)**:
   - When PostgreSQL is available, all geospatial queries use PostGIS spatial indexing (`ST_SetSRID`, `ST_MakePoint`, `ST_AsGeoJSON`).
2. **Resilient Tactical Mode (Zero-Setup Fallback)**:
   - If PostgreSQL or Docker is not running, the backend **automatically and seamlessly switches to the In-Memory Tactical Store**.
   - Local CSV datasets from `data/landslides/gsi_landslide_inventory.csv` and `data/cwc/` are parsed and served without crashing.
   - Developers and evaluators can immediately run the project without configuring database servers or Docker containers!

---

## 🛠️ Quick Start Guide

### Prerequisites
- Node.js (v18+)
- Python (v3.11+)

### 1. Start the Backend API

```powershell
# Navigate to backend directory
cd backend

# Activate virtual environment
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

# Start FastAPI server
uvicorn app.main:app --port 8000 --reload
```

- API Base: `http://localhost:8000`
- Interactive Swagger Documentation: `http://localhost:8000/docs`
- Health Endpoint: `http://localhost:8000/health`

### 2. Start the Frontend Dashboard

```powershell
# Open a second terminal and navigate to frontend directory
cd frontend

# Install dependencies (if not already installed)
npm install

# Start Vite dev server
npm run dev
```

- Frontend Dashboard: `http://localhost:5173`

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | System health and database connectivity mode |
| `GET` | `/api/v1/alerts` | Government alerts from NDMA SACHET / IMD / CWC |
| `GET` | `/api/v1/incidents` | Active operational incident registers |
| `POST` | `/api/v1/incidents` | Create a new disaster incident |
| `GET` | `/api/v1/incidents/count` | Operational incident counts by status |
| `GET` | `/api/v1/rescue-teams` | Search-and-rescue team deployment status |
| `GET` | `/api/v1/rescue-teams/count` | Team availability counts (Available, En Route, Deployed) |
| `GET` | `/api/v1/dispatches` | Active rescue dispatch operations |
| `POST` | `/api/v1/dispatches` | Issue a new dispatch order |
| `PATCH` | `/api/v1/dispatches/{id}/status` | Advance dispatch lifecycle (`EN_ROUTE`, `ON_SCENE`, `COMPLETED`) |
| `POST` | `/api/v1/citizen-reports` | Public disaster report & SOS distress submission |
| `POST` | `/api/v1/citizen-reports/{id}/verify` | Verify citizen report and convert to incident |
| `POST` | `/api/v1/image-analyzer/classify` | Zero-shot deep learning image damage classifier |
| `GET` | `/api/v1/ingestion/landslides` | Geological Survey of India landslide inventory |
| `GET` | `/api/v1/ingestion/cwc/stations` | CWC river water level telemetry |
| `GET` | `/api/v1/ingestion/cwc/rainfall` | CWC hourly rainfall observations |
| `GET` | `/api/v1/ingestion/earthquakes` | USGS seismic activity records |
| `GET` | `/api/v1/ingestion/intelligence/flood-risk` | AI-derived hydrological flood risk index |
| `WS` | `/ws/alerts` | Real-time WebSocket alert and dispatch telemetry stream |

---

## 🔒 Security & Disaster Compliance Notice

This platform is engineered for training, research, and technical evaluation. In a certified government deployment:
- Credentials and JWT keys must be loaded from HSM or cloud vault secrets.
- Mobile numbers and citizen identities are salted and hashed under Indian DPDP Act requirements.
- Satellite telemetry streams adhere to National Remote Sensing Centre (NRSC / ISRO) open data protocols.

---

*AIDERS — Empowering disaster response with rapid intelligence, precision logistics, and resilient life-safety operations.*
