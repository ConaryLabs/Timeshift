-- Prevent duplicate pending bump requests per event (closes race condition)
CREATE UNIQUE INDEX idx_bump_requests_one_pending_per_event
    ON bump_requests (event_id) WHERE status = 'pending';

-- DB-level ot_type constraint
ALTER TABLE assignments
    ADD CONSTRAINT assignments_ot_type_check
    CHECK (ot_type IS NULL OR ot_type IN ('voluntary', 'elective', 'mandatory'));

-- DB-level bump_requests status constraint
ALTER TABLE bump_requests
    ADD CONSTRAINT bump_requests_status_check
    CHECK (status IN ('pending', 'approved', 'denied'));
