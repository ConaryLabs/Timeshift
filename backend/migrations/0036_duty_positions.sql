-- Duty position definitions (reusable templates)
CREATE TABLE duty_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    classification_id UUID REFERENCES classifications(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_duty_positions_name ON duty_positions (org_id, name) WHERE is_active = TRUE;

-- Daily duty position assignments (who fills each position on a given date/shift)
CREATE TABLE duty_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    duty_position_id UUID NOT NULL REFERENCES duty_positions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    shift_template_id UUID REFERENCES shift_templates(id),
    notes VARCHAR(500),
    assigned_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_duty_assignments_unique ON duty_assignments (duty_position_id, date, shift_template_id);
CREATE INDEX idx_duty_assignments_date ON duty_assignments (org_id, date);
CREATE INDEX idx_duty_assignments_user ON duty_assignments (user_id, date);
