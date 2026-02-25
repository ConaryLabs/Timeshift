-- Multi-org generalization: scope unique constraints to org, add configurable
-- settings for fiscal year, contract rules, and leave type categories.

-- ── 1. Scope email + employee_id uniqueness to per-org ──────────────────────

-- Drop global unique constraints and replace with per-org unique indexes.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_id_key;
DROP INDEX IF EXISTS idx_users_email;

CREATE UNIQUE INDEX idx_users_org_email ON users (org_id, email);
CREATE UNIQUE INDEX idx_users_org_employee_id ON users (org_id, employee_id)
    WHERE employee_id IS NOT NULL;

-- ── 2. Configurable fiscal year start ───────────────────────────────────────

-- fiscal_year_start_month: 1 = January (calendar year), 7 = July, 10 = October
INSERT INTO org_settings (id, org_id, key, value, updated_at)
SELECT gen_random_uuid(), id, 'fiscal_year_start_month', '1', NOW()
FROM organizations
ON CONFLICT (org_id, key) DO NOTHING;

-- ── 3. Contract rules as org_settings ───────────────────────────────────────

-- Bump request deadline (hours before shift start). Default 24 per VCCEA 15.9.
INSERT INTO org_settings (id, org_id, key, value, updated_at)
SELECT gen_random_uuid(), id, 'bump_deadline_hours', '24', NOW()
FROM organizations
ON CONFLICT (org_id, key) DO NOTHING;

-- Voluntary OT cancellation window (hours before shift start). Default 24.
INSERT INTO org_settings (id, org_id, key, value, updated_at)
SELECT gen_random_uuid(), id, 'voluntary_ot_cancel_hours', '24', NOW()
FROM organizations
ON CONFLICT (org_id, key) DO NOTHING;

-- Trade approval cutoff (minutes before shift start). Default 60.
INSERT INTO org_settings (id, org_id, key, value, updated_at)
SELECT gen_random_uuid(), id, 'trade_approval_cutoff_minutes', '60', NOW()
FROM organizations
ON CONFLICT (org_id, key) DO NOTHING;

-- Whether trades must be within the same schedule period. Default true (VCCEA 14.3).
INSERT INTO org_settings (id, org_id, key, value, updated_at)
SELECT gen_random_uuid(), id, 'trade_require_same_period', 'true', NOW()
FROM organizations
ON CONFLICT (org_id, key) DO NOTHING;

-- ── 4. Leave type category system ───────────────────────────────────────────

-- Add a category column to leave_types so business logic can query by role
-- instead of matching magic code strings ("sick", "lwop", "fmla_*").
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS category TEXT;

-- Backfill from existing draws_from and code patterns
UPDATE leave_types SET category = 'lwop' WHERE code = 'lwop' AND category IS NULL;
UPDATE leave_types SET category = 'fmla' WHERE code LIKE 'fmla_%' AND category IS NULL;
UPDATE leave_types SET category = draws_from WHERE draws_from IS NOT NULL AND category IS NULL;
-- Anything remaining gets 'other'
UPDATE leave_types SET category = 'other' WHERE category IS NULL;
