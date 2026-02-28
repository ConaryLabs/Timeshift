-- Prevent duplicate open callout events for the same scheduled shift.
-- Only one callout can be 'open' per scheduled_shift_id (regardless of classification).
-- This complements the existing uq_callout_events_active_shift_class index from 0052,
-- which covers the (shift, classification) pair for open+filled statuses.
CREATE UNIQUE INDEX IF NOT EXISTS idx_callout_events_shift_open
ON callout_events (scheduled_shift_id)
WHERE status = 'open';
