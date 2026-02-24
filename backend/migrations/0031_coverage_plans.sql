-- ═══════════════════════════════════════════════════════════════════════════════
-- 0031_coverage_plans.sql — Per-half-hour-slot coverage plan system
--
-- Replaces the coarse coverage_requirements model with named coverage plans
-- containing 48 half-hour slot entries per classification per day-of-week.
-- coverage_requirements is kept for backward compatibility; new system is primary.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Coverage Plans ────────────────────────────────────────────────────────────
-- A named coverage plan belonging to an org. One plan may be the default;
-- others are assigned to specific date ranges via coverage_plan_assignments.

CREATE TABLE coverage_plans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id),
    name        TEXT NOT NULL,
    description TEXT,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, name)
);

-- Only one active default plan per org.
CREATE UNIQUE INDEX idx_coverage_plans_one_default
    ON coverage_plans (org_id)
    WHERE is_default = TRUE AND is_active = TRUE;

CREATE INDEX idx_coverage_plans_org ON coverage_plans (org_id, is_active);

-- ── Coverage Plan Slots ───────────────────────────────────────────────────────
-- One row per (plan, classification, day_of_week, slot_index).
-- slot_index: 0 = 00:00–00:30, 1 = 00:30–01:00, ..., 47 = 23:30–00:00.
-- day_of_week: 0 = Sunday ... 6 = Saturday.

CREATE TABLE coverage_plan_slots (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id           UUID NOT NULL REFERENCES coverage_plans(id) ON DELETE CASCADE,
    classification_id UUID NOT NULL REFERENCES classifications(id),
    day_of_week       SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    slot_index        SMALLINT NOT NULL CHECK (slot_index BETWEEN 0 AND 47),
    min_headcount     SMALLINT NOT NULL DEFAULT 0 CHECK (min_headcount >= 0),
    target_headcount  SMALLINT NOT NULL DEFAULT 0 CHECK (target_headcount >= 0),
    max_headcount     SMALLINT NOT NULL DEFAULT 0 CHECK (max_headcount >= 0),
    UNIQUE (plan_id, classification_id, day_of_week, slot_index),
    CHECK (min_headcount <= target_headcount),
    CHECK (target_headcount <= max_headcount)
);

CREATE INDEX idx_coverage_plan_slots_plan_class_dow
    ON coverage_plan_slots (plan_id, classification_id, day_of_week);

CREATE INDEX idx_coverage_plan_slots_plan
    ON coverage_plan_slots (plan_id);

-- ── Coverage Plan Assignments ─────────────────────────────────────────────────
-- Associates a plan with a date range. end_date NULL means open-ended.
-- When multiple assignments overlap a date, the one with the latest
-- start_date wins. If no assignment matches, the org's is_default plan is used.

CREATE TABLE coverage_plan_assignments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES organizations(id),
    plan_id    UUID NOT NULL REFERENCES coverage_plans(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date   DATE,
    notes      TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_coverage_plan_assignments_org_date
    ON coverage_plan_assignments (org_id, start_date, end_date);
