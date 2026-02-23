-- Goal 166: Leave System Contract Compliance
-- M4: Per-bargaining-unit accrual rates
-- M1: Leave request segments for split absences and FMLA sequencing
-- M5: Leave accrual pause tracking
-- M8: Holiday sellback requests
-- M9: Sick leave donation pool

-- ── M4: bargaining_unit dimension on accrual_schedules ───────────────────────
-- NULL means the schedule applies to all bargaining units (fallback/default).
-- A BU-specific row (bargaining_unit IS NOT NULL) takes precedence when matched.
ALTER TABLE accrual_schedules
    ADD COLUMN bargaining_unit bargaining_unit_enum;

-- ── M1: leave_request_segments ────────────────────────────────────────────────
-- Each row represents one slice of a leave request drawing from a specific
-- leave type balance.  Used for FMLA sequencing (sick→comp→holiday→vac→LWOP)
-- and manually-split absences.
CREATE TABLE leave_request_segments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    leave_type_id    UUID NOT NULL REFERENCES leave_types(id),
    hours            NUMERIC(6,2) NOT NULL CHECK (hours > 0),
    sort_order       INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX leave_request_segments_req_idx ON leave_request_segments(leave_request_id);

-- ── M5: Leave accrual pause tracking ─────────────────────────────────────────
-- Set when the employee transitions to a status that pauses accruals
-- (unpaid_loa / lwop / layoff) and no OJI/pregnancy/military exception applies.
-- Separate from seniority accrual pause (seniority_records.accrual_pause_started_at).
ALTER TABLE users
    ADD COLUMN leave_accrual_paused_at DATE;

-- ── M8: Holiday sellback requests ─────────────────────────────────────────────
-- Employees elect to sell back holiday hours in June or December windows.
-- Caps: VCCEA 96 hrs/year, VCSG 88 hrs/year.
CREATE TABLE holiday_sellback_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    fiscal_year     INT NOT NULL,
    period          VARCHAR(10) NOT NULL CHECK (period IN ('june', 'december')),
    hours_requested NUMERIC(6,2) NOT NULL CHECK (hours_requested > 0),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
    reviewed_by     UUID REFERENCES users(id),
    reviewer_notes  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, fiscal_year, period)
);
CREATE INDEX holiday_sellback_user_idx ON holiday_sellback_requests(user_id, fiscal_year);

-- ── M9: Sick leave donation pool ──────────────────────────────────────────────
-- Donors contribute sick hours to a specific recipient.
-- Donor must retain ≥ 100 hrs after donation.
-- Annual caps: VCCEA 20 hrs donated, VCSG 40 hrs donated.
CREATE TABLE sick_leave_donations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         UUID NOT NULL REFERENCES organizations(id),
    donor_id       UUID NOT NULL REFERENCES users(id),
    recipient_id   UUID NOT NULL REFERENCES users(id),
    leave_type_id  UUID NOT NULL REFERENCES leave_types(id),
    hours          NUMERIC(6,2) NOT NULL CHECK (hours > 0),
    fiscal_year    INT NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
    reviewed_by    UUID REFERENCES users(id),
    reviewer_notes TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX sick_leave_donations_donor_idx     ON sick_leave_donations(donor_id, fiscal_year);
CREATE INDEX sick_leave_donations_recipient_idx ON sick_leave_donations(recipient_id);
