-- Employee preferences
CREATE TABLE employee_preferences (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    notification_email BOOLEAN NOT NULL DEFAULT TRUE,
    notification_sms   BOOLEAN NOT NULL DEFAULT FALSE,
    preferred_view     TEXT NOT NULL DEFAULT 'week' CHECK (preferred_view IN ('month', 'week', 'day')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employee_preferences_user ON employee_preferences (user_id);
