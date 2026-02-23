-- Enforce classification_id on callout_events.
-- The three OT lists (COI / COII / Supervisor) must be explicitly chosen
-- when initiating a callout; a NULL classification has no defined queue.
--
-- Cascades via ON DELETE CASCADE to callout_attempts and ot_volunteers.

DELETE FROM callout_events WHERE classification_id IS NULL;

ALTER TABLE callout_events
    ALTER COLUMN classification_id SET NOT NULL;
