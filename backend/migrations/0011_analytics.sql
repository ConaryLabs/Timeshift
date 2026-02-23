-- Holiday calendar
CREATE TABLE holiday_calendar (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         UUID NOT NULL REFERENCES organizations(id),
    date           DATE NOT NULL,
    name           TEXT NOT NULL,
    is_premium_pay BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, date)
);
CREATE INDEX idx_holiday_calendar_org ON holiday_calendar (org_id, date);

-- Org settings (key-value store for org-specific configuration)
CREATE TABLE org_settings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES organizations(id),
    key        VARCHAR(100) NOT NULL,
    value      JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, key)
);
