-- Add updated_at columns to tables that need optimistic locking support.
-- These tables previously only had created_at.

ALTER TABLE shift_templates
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE teams
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE schedule_periods
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
