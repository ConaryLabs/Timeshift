-- Bid period status enum
CREATE TYPE bid_period_status AS ENUM ('draft', 'open', 'in_progress', 'completed', 'archived');

-- Add bid workflow columns to schedule_periods
ALTER TABLE schedule_periods ADD COLUMN status bid_period_status NOT NULL DEFAULT 'draft';
ALTER TABLE schedule_periods ADD COLUMN bid_opens_at TIMESTAMPTZ;
ALTER TABLE schedule_periods ADD COLUMN bid_closes_at TIMESTAMPTZ;

-- Bid windows: per-user time windows ordered by seniority
CREATE TABLE bid_windows (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id      UUID NOT NULL REFERENCES schedule_periods(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id),
    seniority_rank INT NOT NULL,
    opens_at       TIMESTAMPTZ NOT NULL,
    closes_at      TIMESTAMPTZ NOT NULL,
    submitted_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, user_id)
);
CREATE INDEX idx_bid_windows_period ON bid_windows (period_id);

-- Bid submissions: ranked slot preferences within a bid window
CREATE TABLE bid_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_window_id   UUID NOT NULL REFERENCES bid_windows(id) ON DELETE CASCADE,
    slot_id         UUID NOT NULL REFERENCES shift_slots(id),
    preference_rank INT NOT NULL,
    awarded         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bid_window_id, slot_id),
    UNIQUE(bid_window_id, preference_rank)
);
CREATE INDEX idx_bid_submissions_window ON bid_submissions (bid_window_id);
