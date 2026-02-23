-- Vacation bid periods
CREATE TABLE vacation_bid_periods (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES organizations(id),
    year       INT NOT NULL,
    round      INT NOT NULL CHECK (round IN (1, 2)),
    status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'in_progress', 'completed')),
    opens_at   TIMESTAMPTZ,
    closes_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, year, round)
);

-- Vacation bid windows: per-user seniority-ordered windows
CREATE TABLE vacation_bid_windows (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vacation_bid_period_id UUID NOT NULL REFERENCES vacation_bid_periods(id) ON DELETE CASCADE,
    user_id                UUID NOT NULL REFERENCES users(id),
    seniority_rank         INT NOT NULL,
    opens_at               TIMESTAMPTZ NOT NULL,
    closes_at              TIMESTAMPTZ NOT NULL,
    submitted_at           TIMESTAMPTZ,
    UNIQUE(vacation_bid_period_id, user_id)
);
CREATE INDEX idx_vac_bid_windows_period ON vacation_bid_windows (vacation_bid_period_id);

-- Vacation bids: date picks within a window
CREATE TABLE vacation_bids (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vacation_bid_window_id UUID NOT NULL REFERENCES vacation_bid_windows(id) ON DELETE CASCADE,
    start_date             DATE NOT NULL,
    end_date               DATE NOT NULL,
    preference_rank        INT NOT NULL,
    awarded                BOOLEAN NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK(end_date >= start_date)
);
CREATE INDEX idx_vac_bids_window ON vacation_bids (vacation_bid_window_id);
