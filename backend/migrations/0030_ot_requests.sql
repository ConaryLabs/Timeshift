-- ═══════════════════════════════════════════════════════════════════════════════
-- 0030_ot_requests.sql — Standalone OT Request system
--
-- Decouples overtime from the callout/scheduled_shift model. OT requests
-- represent arbitrary time blocks (typically 2-hour) that supervisors create
-- when there is a staffing gap. Employees can volunteer, and supervisors can
-- assign (voluntary, mandatory, or fixed coverage).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── OT Requests ──────────────────────────────────────────────────────────────
-- Core table: a supervisor creates one OT request per staffing gap.
-- Unlike callout_events (tied to a scheduled_shift), these are free-standing
-- with explicit date + start_time/end_time for arbitrary time blocks.

CREATE TABLE ot_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id),
    date              DATE NOT NULL,
    start_time        TIME NOT NULL,
    end_time          TIME NOT NULL,
    hours             NUMERIC(5,2) NOT NULL,  -- stored for convenience; derived from start/end
    classification_id UUID NOT NULL REFERENCES classifications(id),
    ot_reason_id      UUID REFERENCES ot_reasons(id),
    location          TEXT,                    -- e.g. "Communications", "OT - out of Com Room"
    is_fixed_coverage BOOLEAN NOT NULL DEFAULT FALSE,
    notes             TEXT,
    status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'partially_filled', 'filled', 'cancelled')),
    created_by        UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at      TIMESTAMPTZ,
    cancelled_by      UUID REFERENCES users(id)
);

-- Most common query: "show me today's OT requests for this org"
CREATE INDEX idx_ot_requests_org_date ON ot_requests(org_id, date);

-- Filter by status (open requests, filled, etc.)
CREATE INDEX idx_ot_requests_org_status ON ot_requests(org_id, status);

-- Filter by classification on a given date
CREATE INDEX idx_ot_requests_org_class_date ON ot_requests(org_id, classification_id, date);

-- ── OT Request Volunteers ────────────────────────────────────────────────────
-- When an employee clicks "Volunteer" on an available OT slot.
-- withdrawn_at NULL means the volunteer entry is still active.

CREATE TABLE ot_request_volunteers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_request_id  UUID NOT NULL REFERENCES ot_requests(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id),
    volunteered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    withdrawn_at   TIMESTAMPTZ,  -- null = active volunteer
    UNIQUE(ot_request_id, user_id)
);

-- List all volunteers for a given request
CREATE INDEX idx_ot_request_volunteers_request ON ot_request_volunteers(ot_request_id);

-- List all volunteer entries for a given user (e.g. "my OT volunteering")
CREATE INDEX idx_ot_request_volunteers_user ON ot_request_volunteers(user_id);

-- ── OT Request Assignments ──────────────────────────────────────────────────
-- When an OT slot is filled — either from a volunteer, mandate, or fixed coverage.
-- cancelled_at NULL means the assignment is still active.

CREATE TABLE ot_request_assignments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_request_id  UUID NOT NULL REFERENCES ot_requests(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id),
    ot_type        TEXT NOT NULL DEFAULT 'voluntary'
                   CHECK (ot_type IN ('voluntary', 'mandatory', 'fixed_coverage')),
    assigned_by    UUID NOT NULL REFERENCES users(id),
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at   TIMESTAMPTZ,
    cancelled_by   UUID REFERENCES users(id),
    UNIQUE(ot_request_id, user_id)
);

-- List assignments for a given request
CREATE INDEX idx_ot_request_assignments_request ON ot_request_assignments(ot_request_id);

-- List a user's OT assignments (e.g. "my OT history")
CREATE INDEX idx_ot_request_assignments_user ON ot_request_assignments(user_id);

-- ── Link callout_events → ot_requests ────────────────────────────────────────
-- Optional FK so existing callout events can reference the new OT request
-- that triggered them (migration bridge between old and new systems).

ALTER TABLE callout_events ADD COLUMN ot_request_id UUID REFERENCES ot_requests(id);
CREATE INDEX idx_callout_events_ot_request ON callout_events(ot_request_id);

-- ── Seed OT Reasons ─────────────────────────────────────────────────────────
-- Insert the OT reasons that represent the underlying
-- absence/staffing reasons generating the OT need. These complement the
-- existing coverage-type reasons already in the seed data.

INSERT INTO ot_reasons (org_id, code, name, display_order)
SELECT o.id, reason.code, reason.name, reason.display_order
FROM organizations o,
(VALUES
    ('sick',                      'Sick',                          30),
    ('fmla',                      'FMLA',                          31),
    ('pfml',                      'PFML',                          32),
    ('fcl',                       'FCL',                           33),
    ('comp_time',                 'Comp Time',                     34),
    ('vacation',                  'Vacation',                      35),
    ('holiday_paid',              'Holiday Paid',                  36),
    ('staffing',                  'Staffing',                      37),
    ('second_cr_breaker',         'Second CR Breaker',             38),
    ('acting_supervisor',         'Acting Supervisor',             39),
    ('ada_sick',                  'ADA Sick',                      40),
    ('admin_leave',               'Admin Leave',                   41),
    ('bereavement',               'Bereavement',                   42),
    ('cto_duties_academy_prep',   'CTO Duties | Academy Prep',     43),
    ('emergency_leave',           'Emergency Leave',               44),
    ('long_call_hold_over',       'Long Call Hold Over',           45),
    ('jury_duty',                 'Jury Duty',                     46),
    ('li_sick',                   'L&I Sick',                      47),
    ('leave_of_absence',          'Leave of Absence',              48),
    ('lwop',                      'LWOP',                          49),
    ('maternity',                 'Maternity',                     50),
    ('military',                  'Military',                      51),
    ('ot_meeting',                'Meeting',                       52),
    ('ot_accom',                  'OT Accom',                      53),
    ('special_assignment',        'Special Assignment',            54),
    ('late_employee',             'Late Employee',                 55),
    ('training',                  'Training',                      56),
    ('weather_event',             'Weather | Event',               57),
    ('unpaid_holiday',            'Unpaid Holiday',                58)
) AS reason(code, name, display_order)
WHERE o.slug = 'valleycom'
ON CONFLICT (org_id, code) DO NOTHING;
