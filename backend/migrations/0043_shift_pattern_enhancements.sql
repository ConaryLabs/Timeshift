-- Support complex non-contiguous patterns (e.g. Pitman 2-2-3-2-2-3)
-- When set, work_days_in_cycle lists which days (1-indexed) of the cycle are work days.
-- When NULL, the simple work_days/off_days formula applies.
ALTER TABLE shift_patterns ADD COLUMN work_days_in_cycle INT[] DEFAULT NULL;

-- Drop the constraint requiring work_days + off_days = pattern_days
-- (complex patterns may not follow this rule)
ALTER TABLE shift_patterns DROP CONSTRAINT IF EXISTS shift_patterns_days_check;

-- Assign users to shift patterns
CREATE TABLE shift_pattern_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    pattern_id UUID NOT NULL REFERENCES shift_patterns(id),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spa_org ON shift_pattern_assignments(org_id);
CREATE INDEX idx_spa_user ON shift_pattern_assignments(user_id);
CREATE INDEX idx_spa_pattern ON shift_pattern_assignments(pattern_id);

-- Prevent overlapping assignments for the same user
-- (a user can only follow one pattern at a time)
CREATE UNIQUE INDEX idx_spa_user_active ON shift_pattern_assignments(user_id)
    WHERE effective_to IS NULL;
