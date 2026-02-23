-- Callout step enum for the 5-step VCCEA callout process
CREATE TYPE callout_step AS ENUM ('volunteers', 'low_ot_hours', 'inverse_seniority', 'equal_ot_hours', 'mandatory');

-- OT queue positions: per-classification ordering for callout
CREATE TABLE ot_queue_positions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id),
    classification_id UUID NOT NULL REFERENCES classifications(id),
    user_id           UUID NOT NULL REFERENCES users(id),
    position          INT NOT NULL,
    fiscal_year       INT NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_ot_queue_unique ON ot_queue_positions (org_id, classification_id, user_id, fiscal_year);
CREATE INDEX idx_ot_queue_org_class ON ot_queue_positions (org_id, classification_id, fiscal_year);

-- OT volunteers: track who volunteers for a callout event
CREATE TABLE ot_volunteers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES organizations(id),
    callout_event_id UUID NOT NULL REFERENCES callout_events(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id),
    volunteered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(callout_event_id, user_id)
);

-- Add step tracking to callout_events
ALTER TABLE callout_events ADD COLUMN current_step callout_step DEFAULT 'volunteers';
ALTER TABLE callout_events ADD COLUMN step_started_at TIMESTAMPTZ;
