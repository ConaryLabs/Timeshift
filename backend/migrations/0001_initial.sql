-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum Types ──────────────────────────────────────────────────────────────

CREATE TYPE app_role AS ENUM ('admin', 'supervisor', 'employee');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'denied', 'cancelled');
CREATE TYPE employee_type_enum AS ENUM ('regular_full_time', 'job_share', 'medical_part_time', 'temp_part_time');
CREATE TYPE callout_status AS ENUM ('open', 'filled', 'cancelled');

-- ── Organizations ───────────────────────────────────────────────────────────

CREATE TABLE organizations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    timezone   TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Classifications ─────────────────────────────────────────────────────────

CREATE TABLE classifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id),
    name          TEXT NOT NULL,
    abbreviation  TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, abbreviation)
);

-- ── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id),
    employee_id       TEXT UNIQUE,
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL,
    email             TEXT NOT NULL UNIQUE,
    phone             TEXT,
    password_hash     TEXT NOT NULL,
    role              app_role NOT NULL DEFAULT 'employee',
    classification_id UUID REFERENCES classifications(id),
    employee_type     employee_type_enum NOT NULL DEFAULT 'regular_full_time',
    hire_date         DATE,
    seniority_date    DATE,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_org_active ON users (org_id, is_active);

-- ── Seniority Records ───────────────────────────────────────────────────────

CREATE TABLE seniority_records (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id),
    seniority_type TEXT NOT NULL CHECK (seniority_type IN ('overall', 'bargaining_unit', 'classification')),
    effective_date DATE NOT NULL,
    notes          TEXT,
    UNIQUE (user_id, seniority_type)
);

-- ── Shift Templates ─────────────────────────────────────────────────────────

CREATE TABLE shift_templates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES organizations(id),
    name             TEXT NOT NULL,
    start_time       TIME NOT NULL,
    end_time         TIME NOT NULL,
    crosses_midnight BOOLEAN NOT NULL DEFAULT FALSE,
    duration_minutes INT NOT NULL,
    color            TEXT NOT NULL DEFAULT '#4f86c6',
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Teams ───────────────────────────────────────────────────────────────────

CREATE TABLE teams (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id),
    name          TEXT NOT NULL,
    supervisor_id UUID REFERENCES users(id),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, name)
);

-- ── Shift Slots ─────────────────────────────────────────────────────────────

CREATE TABLE shift_slots (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id           UUID NOT NULL REFERENCES teams(id),
    shift_template_id UUID NOT NULL REFERENCES shift_templates(id),
    classification_id UUID NOT NULL REFERENCES classifications(id),
    days_of_week      INT[] NOT NULL,
    label             TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slots_team ON shift_slots (team_id);

-- ── Schedule Periods ────────────────────────────────────────────────────────

CREATE TABLE schedule_periods (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES organizations(id),
    name       TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date > start_date)
);

-- ── Slot Assignments ────────────────────────────────────────────────────────

CREATE TABLE slot_assignments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id    UUID NOT NULL REFERENCES shift_slots(id),
    user_id    UUID NOT NULL REFERENCES users(id),
    period_id  UUID NOT NULL REFERENCES schedule_periods(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (slot_id, period_id)
);

CREATE INDEX idx_slot_assign_user ON slot_assignments (user_id);
CREATE INDEX idx_slot_assign_period ON slot_assignments (period_id);

-- ── Scheduled Shifts ────────────────────────────────────────────────────────

CREATE TABLE scheduled_shifts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id             UUID NOT NULL REFERENCES organizations(id),
    shift_template_id  UUID NOT NULL REFERENCES shift_templates(id),
    date               DATE NOT NULL,
    required_headcount INT NOT NULL DEFAULT 1,
    slot_id            UUID REFERENCES shift_slots(id),
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_scheduled_shifts_template_date_slot
    ON scheduled_shifts (shift_template_id, date, COALESCE(slot_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_scheduled_shifts_date ON scheduled_shifts (date);
CREATE INDEX idx_scheduled_shifts_org_date ON scheduled_shifts (org_id, date);

-- ── Assignments ─────────────────────────────────────────────────────────────

CREATE TABLE assignments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_shift_id UUID NOT NULL REFERENCES scheduled_shifts(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES users(id),
    position           TEXT,
    is_overtime        BOOLEAN NOT NULL DEFAULT FALSE,
    is_trade           BOOLEAN NOT NULL DEFAULT FALSE,
    notes              TEXT,
    created_by         UUID NOT NULL REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scheduled_shift_id, user_id)
);

CREATE INDEX idx_assignments_user ON assignments (user_id);
CREATE INDEX idx_assignments_shift ON assignments (scheduled_shift_id);

-- ── Leave Types ─────────────────────────────────────────────────────────────

CREATE TABLE leave_types (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id),
    code              TEXT NOT NULL,
    name              TEXT NOT NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    is_reported       BOOLEAN NOT NULL DEFAULT FALSE,
    draws_from        TEXT,
    display_order     INT NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, code)
);

-- ── Leave Requests ──────────────────────────────────────────────────────────

CREATE TABLE leave_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id),
    leave_type_id  UUID NOT NULL REFERENCES leave_types(id),
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    hours          NUMERIC(6,2),
    reason         TEXT,
    status         leave_status NOT NULL DEFAULT 'pending',
    reviewed_by    UUID REFERENCES users(id),
    reviewer_notes TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_user ON leave_requests (user_id);
CREATE INDEX idx_leave_status ON leave_requests (status);
CREATE INDEX idx_leave_dates ON leave_requests (start_date, end_date);

-- ── OT Reasons ──────────────────────────────────────────────────────────────

CREATE TABLE ot_reasons (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id),
    code          TEXT NOT NULL,
    name          TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, code)
);

-- ── OT Hours Tracking ───────────────────────────────────────────────────────

CREATE TABLE ot_hours (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id),
    fiscal_year       INT NOT NULL,
    classification_id UUID REFERENCES classifications(id),
    hours_worked      NUMERIC(8,2) NOT NULL DEFAULT 0,
    hours_declined    NUMERIC(8,2) NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ot_hours_user_year_class
    ON ot_hours (user_id, fiscal_year, COALESCE(classification_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ── Callout Events ──────────────────────────────────────────────────────────

CREATE TABLE callout_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_shift_id UUID NOT NULL REFERENCES scheduled_shifts(id),
    initiated_by       UUID NOT NULL REFERENCES users(id),
    ot_reason_id       UUID REFERENCES ot_reasons(id),
    reason_text        TEXT,
    classification_id  UUID REFERENCES classifications(id),
    status             callout_status NOT NULL DEFAULT 'open',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Callout Attempts ────────────────────────────────────────────────────────

CREATE TABLE callout_attempts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES callout_events(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    list_position       INT NOT NULL,
    contacted_at        TIMESTAMPTZ,
    response            TEXT CHECK (response IN ('accepted', 'declined', 'no_answer')),
    ot_hours_at_contact NUMERIC(8,2) NOT NULL DEFAULT 0,
    notes               TEXT
);

CREATE INDEX idx_attempts_event ON callout_attempts (event_id);
