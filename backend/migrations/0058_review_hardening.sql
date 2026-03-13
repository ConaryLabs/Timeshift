-- Fix: assignments unique constraint blocks re-assignment after soft cancellation.
-- Replace unconditional unique with partial unique index on active assignments only.
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_scheduled_shift_id_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_active_unique
    ON assignments (scheduled_shift_id, user_id)
    WHERE cancelled_at IS NULL;

-- Add missing FK indexes identified in code review.
CREATE INDEX IF NOT EXISTS idx_shift_slots_template ON shift_slots (shift_template_id);
CREATE INDEX IF NOT EXISTS idx_shift_slots_classification ON shift_slots (classification_id);
CREATE INDEX IF NOT EXISTS idx_users_classification ON users (classification_id);
CREATE INDEX IF NOT EXISTS idx_callout_attempts_user ON callout_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_callout_events_ot_reason ON callout_events (ot_reason_id);
CREATE INDEX IF NOT EXISTS idx_trade_requests_requester ON trade_requests (requester_assignment_id);
CREATE INDEX IF NOT EXISTS idx_trade_requests_partner ON trade_requests (partner_assignment_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_slot ON scheduled_shifts (slot_id);
CREATE INDEX IF NOT EXISTS idx_bump_requests_requesting ON bump_requests (requesting_user_id);
CREATE INDEX IF NOT EXISTS idx_bump_requests_displaced ON bump_requests (displaced_user_id);
CREATE INDEX IF NOT EXISTS idx_teams_supervisor ON teams (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_coverage_plan_assignments_plan ON coverage_plan_assignments (plan_id);

-- Add org_id covering indexes for hot-path tables.
CREATE INDEX IF NOT EXISTS idx_shift_templates_org_active ON shift_templates (org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_schedule_periods_org ON schedule_periods (org_id, start_date DESC);

-- Drop redundant indexes (duplicated by unique constraints).
DROP INDEX IF EXISTS refresh_tokens_token_idx;
DROP INDEX IF EXISTS idx_employee_preferences_user;
