CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE officials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    official_id VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(40) NOT NULL CHECK (role IN ('ROLE_ADMIN','ROLE_DISPATCHER','ROLE_FIELD_RESCUE')),
    department VARCHAR(150),
    mobile VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE official_face_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    official_id UUID NOT NULL REFERENCES officials(id) ON DELETE CASCADE,
    embedding BYTEA NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    official_id UUID NOT NULL REFERENCES officials(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE TABLE government_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(30) NOT NULL CHECK (source IN ('SACHET','IMD','CWC','USGS')),
    external_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(100),
    headline TEXT,
    description TEXT,
    severity VARCHAR(30),
    urgency VARCHAR(30),
    certainty VARCHAR(30),
    issued_at TIMESTAMPTZ,
    effective_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    area_name VARCHAR(255),
    geometry GEOMETRY(GEOMETRY,4326),
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source, external_id)
);

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_type VARCHAR(40) NOT NULL CHECK (incident_type IN ('FLOOD','HEAVY_RAINFALL','LANDSLIDE','EARTHQUAKE')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source VARCHAR(50),
    external_event_id VARCHAR(255),
    location GEOGRAPHY(POINT,4326) NOT NULL,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    occurred_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES officials(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source, external_event_id)
);

CREATE TABLE citizen_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_hash TEXT,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    location GEOGRAPHY(POINT,4326) NOT NULL,
    media_url TEXT,
    status VARCHAR(30) DEFAULT 'SUBMITTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rescue_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name VARCHAR(150) NOT NULL,
    organization VARCHAR(150),
    team_type VARCHAR(80),
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    current_location GEOGRAPHY(POINT,4326),
    contact_phone VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id),
    team_id UUID NOT NULL REFERENCES rescue_teams(id),
    dispatcher_id UUID NOT NULL REFERENCES officials(id),
    assigned_location GEOGRAPHY(POINT,4326) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    instructions TEXT,
    status VARCHAR(30) DEFAULT 'ASSIGNED',
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE TABLE telemetry_observations (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(40) NOT NULL,
    station_id VARCHAR(150) NOT NULL,
    parameter VARCHAR(50) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(30) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(POINT,4326),
    metadata JSONB,
    UNIQUE(source,station_id,parameter,observed_at)
);

CREATE INDEX telemetry_time_idx ON telemetry_observations(observed_at);
CREATE INDEX telemetry_location_idx ON telemetry_observations USING GIST(location);
CREATE INDEX incident_location_idx ON incidents USING GIST(location);
CREATE INDEX alert_geometry_idx ON government_alerts USING GIST(geometry);



CREATE TABLE IF NOT EXISTS landslide_inventory (
    id BIGSERIAL PRIMARY KEY,
    sl_no INTEGER,
    slide_no TEXT,
    state TEXT,
    district TEXT,
    slide_name TEXT,
    nh_sh_location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    material_involved TEXT,
    movement_type TEXT,
    history TEXT,
    source_page INTEGER,
    source_document TEXT,
    location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_landslide_slide_no UNIQUE (slide_no)
);

CREATE INDEX IF NOT EXISTS idx_landslide_inventory_location
    ON landslide_inventory
    USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_landslide_inventory_state
    ON landslide_inventory (state);

CREATE INDEX IF NOT EXISTS idx_landslide_inventory_district
    ON landslide_inventory (district);