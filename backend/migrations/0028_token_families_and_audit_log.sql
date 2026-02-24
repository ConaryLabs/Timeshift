-- Refresh token family tracking for reuse detection.
-- Each login session creates a family_id; rotated tokens inherit the same family_id.
-- If a token is reused after rotation, all tokens in that family are revoked.
ALTER TABLE refresh_tokens ADD COLUMN family_id UUID NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);

-- Login audit log for security event tracking.
CREATE TABLE login_audit_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id),
    org_id     UUID,
    event_type TEXT NOT NULL CHECK (event_type IN ('login_success', 'login_failed', 'refresh', 'logout')),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_login_audit_user_created ON login_audit_log (user_id, created_at DESC);
