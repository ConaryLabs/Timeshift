-- Fix duty_assignments unique index to handle NULL shift_template_id.
-- PostgreSQL treats NULLs as distinct in unique indexes, allowing duplicate
-- (duty_position_id, date, NULL) rows. Use COALESCE with a sentinel UUID
-- to make NULL values participate in uniqueness checks.
DROP INDEX IF EXISTS idx_duty_assignments_unique;
CREATE UNIQUE INDEX idx_duty_assignments_unique
    ON duty_assignments (duty_position_id, date, COALESCE(shift_template_id, '00000000-0000-0000-0000-000000000000'::uuid));
