-- Prevent duplicate active callout events for the same shift + classification.
-- Only one callout can be 'open' or 'filled' per (scheduled_shift_id, classification_id).
-- Terminal statuses ('completed', 'cancelled') are excluded so historical records don't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS uq_callout_events_active_shift_class
ON callout_events (scheduled_shift_id, classification_id)
WHERE status IN ('open', 'filled');
