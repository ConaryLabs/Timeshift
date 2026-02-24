-- Add partial-day, conditional, and RDO fields to leave_requests
ALTER TABLE leave_requests
    ADD COLUMN start_time       TIME,
    ADD COLUMN scheduled_shift_id UUID REFERENCES scheduled_shifts(id),
    ADD COLUMN is_rdo           BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN emergency_contact TEXT,
    ADD COLUMN bereavement_relationship TEXT,
    ADD COLUMN bereavement_name TEXT;

CREATE INDEX idx_leave_shift ON leave_requests (scheduled_shift_id)
    WHERE scheduled_shift_id IS NOT NULL;
