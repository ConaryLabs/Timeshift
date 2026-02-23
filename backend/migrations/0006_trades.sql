-- Trade status enum
CREATE TYPE trade_status AS ENUM ('pending_partner', 'pending_approval', 'approved', 'denied', 'cancelled');

-- Trade requests
CREATE TABLE trade_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organizations(id),
    requester_id            UUID NOT NULL REFERENCES users(id),
    partner_id              UUID NOT NULL REFERENCES users(id),
    requester_assignment_id UUID NOT NULL REFERENCES assignments(id),
    partner_assignment_id   UUID NOT NULL REFERENCES assignments(id),
    requester_date          DATE NOT NULL,
    partner_date            DATE NOT NULL,
    status                  trade_status NOT NULL DEFAULT 'pending_partner',
    reviewed_by             UUID REFERENCES users(id),
    reviewer_notes          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trade_requests_org ON trade_requests (org_id, status);
CREATE INDEX idx_trade_requests_requester ON trade_requests (requester_id);
CREATE INDEX idx_trade_requests_partner ON trade_requests (partner_id);
