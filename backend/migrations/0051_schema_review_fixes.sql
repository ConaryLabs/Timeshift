-- Schema review fixes: constraint alignment, nullability, missing indexes.

-- ============================================================
-- 1. Fix assignments.ot_type CHECK to match all OtType enum variants
--    (0021 only allowed voluntary/elective/mandatory; Rust enum also
--     has mandatory_day_off and fixed_coverage)
-- ============================================================
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_ot_type_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_ot_type_check
    CHECK (ot_type IS NULL OR ot_type IN ('voluntary', 'elective', 'mandatory', 'mandatory_day_off', 'fixed_coverage'));

-- ============================================================
-- 2. Make duty_assignments.block_index NOT NULL
--    API always provides it, and the unique index
--    (duty_position_id, date, block_index) needs it non-null.
-- ============================================================
UPDATE duty_assignments SET block_index = 0 WHERE block_index IS NULL;
ALTER TABLE duty_assignments ALTER COLUMN block_index SET NOT NULL;

-- ============================================================
-- 3. Add CHECK constraint on sms_log.status
-- ============================================================
ALTER TABLE sms_log ADD CONSTRAINT sms_log_status_check
    CHECK (status IN ('sent', 'failed'));

-- ============================================================
-- 4. Composite index on seniority_records for org-level bid ordering
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_seniority_records_org_overall
    ON seniority_records (org_id, overall_seniority_date);
