-- Restructure seniority_records from EAV (entity-attribute-value) to explicit columns.
-- The three VCCEA/VCSG seniority counters:
--   overall_seniority_date          = total service at org (drives bid window ordering)
--   bargaining_unit_seniority_date  = time in bargaining unit (drives inverse-seniority callout step)
--   classification_seniority_date   = time in current classification (tie-breaking)
--
-- Also removes users.seniority_date (renamed here first for clarity, then migrated to
-- seniority_records.overall_seniority_date and dropped).

-- 1. Rename column first so the backfill query below is legible
ALTER TABLE users RENAME COLUMN seniority_date TO overall_seniority_date;

-- 2. Drop old EAV table
DROP TABLE seniority_records;

-- 3. New design: one row per user, explicit columns
CREATE TABLE seniority_records (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    org_id                          UUID NOT NULL REFERENCES organizations(id),
    overall_seniority_date          DATE,
    bargaining_unit_seniority_date  DATE,
    classification_seniority_date   DATE,
    notes                           TEXT,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Backfill from users.overall_seniority_date
INSERT INTO seniority_records (user_id, org_id, overall_seniority_date)
SELECT id, org_id, overall_seniority_date
FROM users
WHERE overall_seniority_date IS NOT NULL;

CREATE INDEX idx_seniority_records_org ON seniority_records (org_id);

-- 5. Drop the column from users; bid ordering now uses seniority_records via LEFT JOIN
ALTER TABLE users DROP COLUMN overall_seniority_date;
