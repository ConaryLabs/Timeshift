-- Performance indexes for frequently queried tables

-- Partial index for active (non-cancelled) assignments, used in 10-hour rest checks and schedule queries
CREATE INDEX IF NOT EXISTS idx_assignments_user_active
ON assignments (user_id) WHERE cancelled_at IS NULL;

-- Composite index for overlap detection queries
CREATE INDEX IF NOT EXISTS idx_leave_request_lines_id_date
ON leave_request_lines (leave_request_id, date);
