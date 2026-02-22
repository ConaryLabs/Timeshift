-- Replace inline UNIQUE constraint with a named index so ON CONFLICT upsert
-- can resolve the constraint by column list.
ALTER TABLE slot_assignments
    DROP CONSTRAINT slot_assignments_slot_id_period_id_key;

CREATE UNIQUE INDEX idx_slot_assignments_slot_period
    ON slot_assignments (slot_id, period_id);

-- Add updated_at to track when a slot was reassigned to a different user.
ALTER TABLE slot_assignments
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
