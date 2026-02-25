-- Special assignments: temporary role assignments (e.g., "Acting Supervisor", "Training", "Light Duty")
CREATE TABLE special_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    assignment_type VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    assigned_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_special_assignments_user ON special_assignments (user_id, start_date, end_date);
CREATE INDEX idx_special_assignments_org ON special_assignments (org_id, start_date);
CREATE INDEX idx_special_assignments_type ON special_assignments (org_id, assignment_type);

-- Team hierarchy: parent_team_id for location/division relationships
ALTER TABLE teams ADD COLUMN parent_team_id UUID REFERENCES teams(id);
CREATE INDEX idx_teams_parent ON teams (parent_team_id);
