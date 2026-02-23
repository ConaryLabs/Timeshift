-- M312: Per-supervisor approval tracking for trades.
-- When a trade moves to pending_approval, one row is inserted per supervisor
-- who oversees either of the two shifts (via slot → team → supervisor_id).
-- If no rows are inserted (shifts have no slot/team/supervisor), the legacy
-- single-supervisor flow is used instead.

CREATE TABLE trade_approvals (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id),
    trade_id      UUID NOT NULL REFERENCES trade_requests(id) ON DELETE CASCADE,
    supervisor_id UUID NOT NULL REFERENCES users(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'denied')),
    reviewer_notes TEXT,
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (trade_id, supervisor_id)
);

CREATE INDEX trade_approvals_trade_idx      ON trade_approvals(trade_id);
CREATE INDEX trade_approvals_supervisor_idx ON trade_approvals(supervisor_id);
