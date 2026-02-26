-- SMS audit log for OT alerts
CREATE TABLE sms_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    sent_by UUID NOT NULL REFERENCES users(id),
    recipient_user_id UUID REFERENCES users(id),
    to_number TEXT NOT NULL,
    message_body TEXT NOT NULL,
    status TEXT NOT NULL,  -- 'sent' | 'failed'
    error_detail TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_log_org_sent ON sms_log(org_id, sent_at DESC);
