-- Rework ot_queue_positions: replace static integer position with last_ot_event_at timestamp.
--
-- Queue order is now derived dynamically:
--   last_ot_event_at ASC NULLS FIRST
--   = oldest-event employee goes first; NULL (never called) goes to very front.
--
-- record_attempt() updates last_ot_event_at = NOW() after each contact.
-- Admins can move an employee to the front by setting last_ot_event_at = NULL via
-- the PATCH /api/ot/queue/set-position endpoint.

ALTER TABLE ot_queue_positions
    ADD COLUMN last_ot_event_at TIMESTAMPTZ,
    DROP COLUMN position;

COMMENT ON COLUMN ot_queue_positions.last_ot_event_at IS
    'Timestamp of the last OT callout contact for this employee/classification/year.
     NULL means the employee has never been contacted — they sort to the front of the queue.
     Updated automatically by record_attempt(); admin can reset to NULL to move employee to front.';
