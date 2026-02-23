CREATE TABLE bump_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id),
    event_id            UUID NOT NULL REFERENCES callout_events(id) ON DELETE CASCADE,
    requesting_user_id  UUID NOT NULL REFERENCES users(id),
    displaced_user_id   UUID NOT NULL REFERENCES users(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    reason              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at         TIMESTAMPTZ,
    reviewed_by         UUID REFERENCES users(id)
);
CREATE INDEX bump_requests_event_idx ON bump_requests(event_id);
CREATE INDEX bump_requests_org_idx ON bump_requests(org_id);
