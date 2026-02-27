-- Add 'mandatory_day_off' to ot_request_assignments ot_type CHECK constraint.
-- The backend and frontend already use this value but the DB constraint was missing it.
ALTER TABLE ot_request_assignments
    DROP CONSTRAINT IF EXISTS ot_request_assignments_ot_type_check;

ALTER TABLE ot_request_assignments
    ADD CONSTRAINT ot_request_assignments_ot_type_check
    CHECK (ot_type IN ('voluntary', 'mandatory', 'mandatory_day_off', 'fixed_coverage'));
