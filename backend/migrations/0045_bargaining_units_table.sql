-- 0045: Extract bargaining_unit from PG enum to a configurable per-org table.
-- Caps, longevity tiers, and donation/sellback limits move to columns on this table
-- so each org can define its own bargaining units with its own rules.

-- 1. Create the bargaining_units config table
CREATE TABLE IF NOT EXISTS bargaining_units (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code        TEXT NOT NULL,               -- e.g. 'vccea', 'vcsg', 'non_represented'
    name        TEXT NOT NULL,               -- Human-readable display name
    -- Carryover enforcement
    carryover_cap_hours      FLOAT8,         -- NULL = no cap enforced
    carryover_categories     TEXT[] NOT NULL DEFAULT '{}', -- e.g. {'vacation','holiday'}
    -- Holiday sellback
    sellback_annual_cap      FLOAT8,         -- NULL = sellback not available
    -- Sick leave donation
    donation_annual_cap      FLOAT8,         -- NULL = donation not available
    donation_retention_floor FLOAT8 NOT NULL DEFAULT 100.0, -- min hrs donor must retain
    -- Longevity credit
    longevity_eligible       BOOLEAN NOT NULL DEFAULT false,
    longevity_vacation_credit FLOAT8 NOT NULL DEFAULT 0.0, -- hrs credited on anniversary
    longevity_tiers          JSONB,          -- e.g. [{"min_years":0,"max_years":4,"percent":1.55}, ...]
    --
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, code)
);

CREATE INDEX idx_bargaining_units_org ON bargaining_units(org_id);

-- 2. Seed bargaining units from existing enum values
INSERT INTO bargaining_units (org_id, code, name,
    carryover_cap_hours, carryover_categories,
    sellback_annual_cap,
    donation_annual_cap, donation_retention_floor,
    longevity_eligible, longevity_vacation_credit, longevity_tiers)
SELECT o.id, 'vccea', 'VCCEA',
    240.0, ARRAY['vacation','holiday'],
    96.0,
    20.0, 100.0,
    false, 0.0, NULL
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM bargaining_units bu WHERE bu.org_id = o.id AND bu.code = 'vccea');

INSERT INTO bargaining_units (org_id, code, name,
    carryover_cap_hours, carryover_categories,
    sellback_annual_cap,
    donation_annual_cap, donation_retention_floor,
    longevity_eligible, longevity_vacation_credit, longevity_tiers)
SELECT o.id, 'vcsg', 'VCSG',
    260.0, ARRAY['vacation'],
    88.0,
    40.0, 100.0,
    true, 24.0, '[{"min_years":0,"max_years":4,"percent":1.55},{"min_years":5,"max_years":9,"percent":2.05},{"min_years":10,"max_years":14,"percent":2.55},{"min_years":15,"max_years":19,"percent":3.05},{"min_years":20,"max_years":99,"percent":3.55}]'::jsonb
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM bargaining_units bu WHERE bu.org_id = o.id AND bu.code = 'vcsg');

INSERT INTO bargaining_units (org_id, code, name,
    carryover_cap_hours, carryover_categories,
    sellback_annual_cap,
    donation_annual_cap, donation_retention_floor,
    longevity_eligible, longevity_vacation_credit, longevity_tiers)
SELECT o.id, 'non_represented', 'Non-Represented',
    NULL, '{}',
    NULL,
    NULL, 100.0,
    false, 0.0, NULL
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM bargaining_units bu WHERE bu.org_id = o.id AND bu.code = 'non_represented');

-- 3. Convert users.bargaining_unit from enum to TEXT
ALTER TABLE users ALTER COLUMN bargaining_unit DROP DEFAULT;
ALTER TABLE users ALTER COLUMN bargaining_unit TYPE TEXT USING bargaining_unit::TEXT;
ALTER TABLE users ALTER COLUMN bargaining_unit SET DEFAULT 'non_represented';

-- 4. Convert schedule_periods.bargaining_unit (already TEXT but may have CHECK constraint)
-- Drop any CHECK constraints that limit to specific values
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'schedule_periods'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%bargaining_unit%'
    LOOP
        EXECUTE format('ALTER TABLE schedule_periods DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

-- 5. Convert vacation_bid_periods.bargaining_unit (same treatment)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'vacation_bid_periods'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%bargaining_unit%'
    LOOP
        EXECUTE format('ALTER TABLE vacation_bid_periods DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

-- 6. Convert schedule_periods.bargaining_unit from enum to TEXT
ALTER TABLE schedule_periods ALTER COLUMN bargaining_unit TYPE TEXT USING bargaining_unit::TEXT;

-- 7. Convert vacation_bid_periods.bargaining_unit from enum to TEXT
ALTER TABLE vacation_bid_periods ALTER COLUMN bargaining_unit TYPE TEXT USING bargaining_unit::TEXT;

-- 8. Convert accrual_schedules.bargaining_unit from enum to TEXT
ALTER TABLE accrual_schedules ALTER COLUMN bargaining_unit TYPE TEXT USING bargaining_unit::TEXT;
