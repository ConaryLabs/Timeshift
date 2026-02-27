-- Duty board enhancements: qualifications system, position operating hours,
-- and block-based assignments for the 2-hour grid seating chart.

-- ============================================================
-- 1. Qualifications system
-- ============================================================

-- Org-level qualification definitions (e.g., "Fire Dispatch", "Police Dispatch")
CREATE TABLE qualifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(50) NOT NULL,
    description VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, name)
);

-- Which qualifications a position requires (many-to-many)
CREATE TABLE duty_position_qualifications (
    duty_position_id UUID NOT NULL REFERENCES duty_positions(id) ON DELETE CASCADE,
    qualification_id UUID NOT NULL REFERENCES qualifications(id) ON DELETE CASCADE,
    PRIMARY KEY (duty_position_id, qualification_id)
);

-- Which qualifications a user has (many-to-many)
CREATE TABLE user_qualifications (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qualification_id UUID NOT NULL REFERENCES qualifications(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, qualification_id)
);

-- ============================================================
-- 2. Position operating hours (per day-of-week open/close)
-- ============================================================

-- No row for a position+day = open 24/7 that day
-- day_of_week: 0=Sunday through 6=Saturday (matches EXTRACT(DOW))
CREATE TABLE duty_position_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duty_position_id UUID NOT NULL REFERENCES duty_positions(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    crosses_midnight BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (duty_position_id, day_of_week)
);

-- ============================================================
-- 3. Duty assignments — add block-based support
-- ============================================================

-- Add 2-hour block index (0=00:00-02:00 through 11=22:00-24:00)
ALTER TABLE duty_assignments ADD COLUMN block_index SMALLINT;

-- Allow OT-needed markers (no user assigned yet)
ALTER TABLE duty_assignments ALTER COLUMN user_id DROP NOT NULL;

-- Cell status: 'assigned' (person filling position) or 'ot_needed' (vacancy marker)
ALTER TABLE duty_assignments ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'assigned';
ALTER TABLE duty_assignments ADD CONSTRAINT chk_duty_status
    CHECK (status IN ('assigned', 'ot_needed'));
-- If status is 'assigned', user_id must be set
ALTER TABLE duty_assignments ADD CONSTRAINT chk_duty_user_required
    CHECK (status != 'assigned' OR user_id IS NOT NULL);

-- Drop old unique index (was per shift_template), create new per block
DROP INDEX IF EXISTS idx_duty_assignments_unique;
CREATE UNIQUE INDEX idx_duty_assignments_unique
    ON duty_assignments (duty_position_id, date, block_index);

-- Drop shift_template_id (block_index replaces it for the grid)
ALTER TABLE duty_assignments DROP COLUMN shift_template_id;
