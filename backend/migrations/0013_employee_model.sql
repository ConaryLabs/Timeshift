-- Employee model enhancements: bargaining unit, CTO designation, Admin/Training Supervisor flag

-- Bargaining unit enum: VCCEA (COI/COII), VCSG (supervisors), non-represented (admin/temp)
CREATE TYPE bargaining_unit_enum AS ENUM ('vccea', 'vcsg', 'non_represented');

-- Add bargaining_unit to users.
-- Default to 'non_represented' (safe null-equivalent); seed/admin script should set per employee.
ALTER TABLE users
    ADD COLUMN bargaining_unit bargaining_unit_enum NOT NULL DEFAULT 'non_represented';

-- Backfill: employees (role='employee') → vccea, supervisors (role='supervisor' or 'admin') → vcsg
-- Admins (role='admin') are typically management/non-represented, so keep as non_represented.
UPDATE users SET bargaining_unit = 'vccea' WHERE role = 'employee';
UPDATE users SET bargaining_unit = 'vcsg'  WHERE role = 'supervisor';

-- CTO (Communications Training Officer) designation: a role modifier on top of COI/COII.
-- Does not change classification; affects pay (+CTO premium) and training duties.
ALTER TABLE users
    ADD COLUMN cto_designation BOOLEAN NOT NULL DEFAULT FALSE;

-- Admin/Training Supervisor rotational assignment flag (VCSG only).
-- Non-null = currently in rotational assignment; value = start date of the assignment.
-- Rotations are 36 months per VCSG CBA; management tracks via this date.
ALTER TABLE users
    ADD COLUMN admin_training_supervisor_since DATE;

-- Index bargaining_unit for query filtering (e.g. OT list by unit, bid enrollment by unit)
CREATE INDEX idx_users_org_bargaining_unit ON users (org_id, bargaining_unit);
