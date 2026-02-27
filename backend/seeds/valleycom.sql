-- Valleycom seed data
-- Run after migrations: make seed
-- March 2026 team structure: 1 admin + 10 SUP + 49 COII + 39 COI = 99 users

BEGIN;

-- ── Organization ────────────────────────────────────────────────────────────

INSERT INTO organizations (id, name, slug, timezone) VALUES
    ('00000000-0000-0000-0000-000000000a01', 'Valley Communications Center', 'valleycom', 'America/Los_Angeles');

-- ── Bargaining Units ──────────────────────────────────────────────────────
-- Recreated here (originally from migration 0045) so reseed works after TRUNCATE

INSERT INTO bargaining_units (org_id, code, name,
    carryover_cap_hours, carryover_categories,
    sellback_annual_cap,
    donation_annual_cap, donation_retention_floor,
    longevity_eligible, longevity_vacation_credit, longevity_tiers)
VALUES
    ('00000000-0000-0000-0000-000000000a01', 'vccea', 'VCCEA',
     240.0, ARRAY['vacation','holiday'], 96.0, 20.0, 100.0, false, 0.0, NULL),
    ('00000000-0000-0000-0000-000000000a01', 'vcsg', 'VCSG',
     260.0, ARRAY['vacation'], 88.0, 40.0, 100.0, true, 24.0,
     '[{"min_years":0,"max_years":4,"percent":1.55},{"min_years":5,"max_years":9,"percent":2.05},{"min_years":10,"max_years":14,"percent":2.55},{"min_years":15,"max_years":19,"percent":3.05},{"min_years":20,"max_years":99,"percent":3.55}]'::jsonb),
    ('00000000-0000-0000-0000-000000000a01', 'non_represented', 'Non-Represented',
     NULL, '{}', NULL, NULL, 100.0, false, 0.0, NULL);

-- ── Classifications ─────────────────────────────────────────────────────────

INSERT INTO classifications (id, org_id, name, abbreviation, display_order) VALUES
    ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000a01', 'Communications Officer I',  'COI',  1),
    ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-000000000a01', 'Communications Officer II', 'COII', 2),
    ('00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-000000000a01', 'Supervisor',                'SUP',  3);

-- ── Users ───────────────────────────────────────────────────────────────────
-- All passwords: "admin123" (argon2 hash)
-- 1 admin + 98 team members (10 SUP + 49 COII + 39 COI)

-- Admin
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-0000000000a1',
     '00000000-0000-0000-0000-000000000a01',
     'ADMIN001', 'System', 'Admin',
     'admin@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'admin',
     '00000000-0000-0000-0000-000000000c03',
     '2000-01-01', 'non_represented');

-- Team 1
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit, phone) VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000a01', 'SUP001', 'Sarah', 'Chen',
     'sarah.chen@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2012-03-15', 'vcsg', '253-555-0102');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit, phone) VALUES
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000a01', 'EMP002', 'Mike', 'Johnson',
     'mike.johnson@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2018-06-01', 'vccea', '253-555-0201');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit, phone) VALUES
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000a01', 'EMP003', 'Lisa', 'Park',
     'lisa.park@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2021-09-12', 'vccea', '253-555-0202');

-- Team 2
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit, phone) VALUES
    ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000a01', 'EMP004', 'James', 'Rivera',
     'james.rivera@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2015-11-20', 'vccea', '253-555-0203');

-- Team 1
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000a01', 'EMP005', 'Marcus', 'Torres',
     'marcus.torres@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2021-04-27', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000a01', 'EMP006', 'Elena', 'Nakamura',
     'elena.nakamura@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2018-01-26', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000a01', 'EMP007', 'Devon', 'Okonkwo',
     'devon.okonkwo@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2014-10-27', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000a01', 'EMP008', 'Priya', 'Petrov',
     'priya.petrov@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2011-07-28', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000a01', 'EMP009', 'Tyler', 'Santos',
     'tyler.santos@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2023-01-23', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000a01', 'EMP010', 'Keiko', 'Chang',
     'keiko.chang@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2015-10-25', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000a01', 'EMP011', 'Brandon', 'Hoffman',
     'brandon.hoffman@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2018-07-24', 'vccea');

-- Team 2
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000a01', 'SUP012', 'Amara', 'Morales',
     'amara.morales@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2005-08-30', 'vcsg');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000a01', 'EMP013', 'Nathan', 'Cooper',
     'nathan.cooper@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2013-02-26', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000a01', 'EMP014', 'Sofia', 'Walsh',
     'sofia.walsh@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2022-11-24', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000a01', 'EMP015', 'Jordan', 'Patel',
     'jordan.patel@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2019-08-25', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000a01', 'EMP016', 'Yuki', 'Brooks',
     'yuki.brooks@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2016-05-25', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000a01', 'EMP017', 'Cameron', 'Williams',
     'cameron.williams@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2019-02-23', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000a01', 'EMP018', 'Zara', 'Hayes',
     'zara.hayes@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2021-11-22', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000a01', 'EMP019', 'Dylan', 'Cruz',
     'dylan.cruz@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2024-08-21', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000a01', 'EMP020', 'Mei', 'Nguyen',
     'mei.nguyen@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2017-05-23', 'vccea');

-- Team 3
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000a01', 'SUP021', 'Travis', 'Mitchell',
     'travis.mitchell@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2011-06-28', 'vcsg');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000a01', 'EMP022', 'Anika', 'Edwards',
     'anika.edwards@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2021-03-26', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000a01', 'EMP023', 'Colton', 'Kim',
     'colton.kim@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2017-12-25', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000a01', 'EMP024', 'Fatima', 'Wright',
     'fatima.wright@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2014-09-25', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000a01', 'EMP025', 'Ryan', 'Baker',
     'ryan.baker@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2011-06-26', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-000000000a01', 'EMP026', 'Lena', 'Foster',
     'lena.foster@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2021-03-23', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-000000000a01', 'EMP027', 'Wyatt', 'Reed',
     'wyatt.reed@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2017-12-23', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000001c', '00000000-0000-0000-0000-000000000a01', 'EMP028', 'Nadia', 'Bell',
     'nadia.bell@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2020-09-21', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000001d', '00000000-0000-0000-0000-000000000a01', 'EMP029', 'Grant', 'Green',
     'grant.green@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2023-06-21', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000001e', '00000000-0000-0000-0000-000000000a01', 'EMP030', 'Sasha', 'Sharma',
     'sasha.sharma@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2016-03-22', 'vccea');

-- Team 4
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000001f', '00000000-0000-0000-0000-000000000a01', 'SUP031', 'Keith', 'Lee',
     'keith.lee@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2006-04-28', 'vcsg');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000a01', 'EMP032', 'Dina', 'Huang',
     'dina.huang@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2013-01-25', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000a01', 'EMP033', 'Derek', 'Vargas',
     'derek.vargas@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2022-10-23', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000a01', 'EMP034', 'Rosa', 'Dubois',
     'rosa.dubois@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2019-07-24', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000a01', 'EMP035', 'Blake', 'Svensson',
     'blake.svensson@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2016-04-23', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000a01', 'EMP036', 'Ines', 'Kowalski',
     'ines.kowalski@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2013-01-22', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000a01', 'EMP037', 'Craig', 'Tanaka',
     'craig.tanaka@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2016-10-22', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000a01', 'EMP038', 'Tanya', 'Singh',
     'tanya.singh@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2019-07-22', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000a01', 'EMP039', 'Brett', 'Fernandez',
     'brett.fernandez@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2022-04-20', 'vccea');

-- Team 5
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000a01', 'SUP040', 'Leila', 'Russo',
     'leila.russo@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2012-02-24', 'vcsg');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000a01', 'EMP041', 'Shane', 'Novak',
     'shane.novak@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2017-11-23', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000002a', '00000000-0000-0000-0000-000000000a01', 'EMP042', 'Marta', 'Andersen',
     'marta.andersen@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2014-08-24', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000002b', '00000000-0000-0000-0000-000000000a01', 'EMP043', 'Wade', 'Kato',
     'wade.kato@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2011-05-25', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000002c', '00000000-0000-0000-0000-000000000a01', 'EMP044', 'Anya', 'Ali',
     'anya.ali@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2021-02-19', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000002d', '00000000-0000-0000-0000-000000000a01', 'EMP045', 'Drew', 'Weber',
     'drew.weber@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2017-11-20', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000002e', '00000000-0000-0000-0000-000000000a01', 'EMP046', 'Vera', 'Berg',
     'vera.berg@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2015-08-22', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000002f', '00000000-0000-0000-0000-000000000a01', 'EMP047', 'Cole', 'Nilsson',
     'cole.nilsson@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2018-05-21', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000a01', 'EMP048', 'Nina', 'Hernandez',
     'nina.hernandez@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2021-02-17', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000a01', 'EMP049', 'Troy', 'Roth',
     'troy.roth@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2023-11-17', 'vccea');

-- Team 6
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000a01', 'SUP050', 'Iris', 'Lam',
     'iris.lam@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2006-12-25', 'vcsg');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000a01', 'EMP051', 'Glen', 'Fischer',
     'glen.fischer@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2022-09-21', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000a01', 'EMP052', 'Lydia', 'Vogel',
     'lydia.vogel@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2019-06-22', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000a01', 'EMP053', 'Miles', 'Mendez',
     'miles.mendez@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2016-03-22', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000036', '00000000-0000-0000-0000-000000000a01', 'EMP054', 'Clara', 'Larsson',
     'clara.larsson@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2012-12-21', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-000000000a01', 'EMP055', 'Reed', 'Schneider',
     'reed.schneider@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2022-09-18', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000a01', 'EMP056', 'Jana', 'Lund',
     'jana.lund@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2024-06-18', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000039', '00000000-0000-0000-0000-000000000a01', 'EMP057', 'Quinn', 'Muller',
     'quinn.muller@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2017-03-20', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000003a', '00000000-0000-0000-0000-000000000a01', 'EMP058', 'Daria', 'Bergman',
     'daria.bergman@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2019-12-18', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000003b', '00000000-0000-0000-0000-000000000a01', 'EMP059', 'Ross', 'Costa',
     'ross.costa@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2022-09-16', 'vccea');

-- Team 7
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000003c', '00000000-0000-0000-0000-000000000a01', 'SUP060', 'Olga', 'Johansson',
     'olga.johansson@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2012-10-22', 'vcsg');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000003d', '00000000-0000-0000-0000-000000000a01', 'EMP061', 'Knox', 'Varga',
     'knox.varga@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2014-07-23', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000003e', '00000000-0000-0000-0000-000000000a01', 'EMP062', 'Faye', 'Stein',
     'faye.stein@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2011-04-23', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000003f', '00000000-0000-0000-0000-000000000a01', 'EMP063', 'Seth', 'Orozco',
     'seth.orozco@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2021-01-18', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000a01', 'EMP064', 'Gwen', 'Lindberg',
     'gwen.lindberg@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2017-10-19', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000a01', 'EMP065', 'Dane', 'Poole',
     'dane.poole@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2014-07-20', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000a01', 'EMP066', 'Ruth', 'Stanton',
     'ruth.stanton@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2023-04-18', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000a01', 'EMP067', 'Kurt', 'Barker',
     'kurt.barker@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2016-01-18', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000a01', 'EMP068', 'Hope', 'Hewitt',
     'hope.hewitt@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2018-10-17', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000a01', 'EMP069', 'Lance', 'Delgado',
     'lance.delgado@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2021-07-16', 'vccea');

-- Team 8
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000046', '00000000-0000-0000-0000-000000000a01', 'SUP070', 'Pearl', 'Cervantes',
     'pearl.cervantes@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2007-08-23', 'vcsg');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000047', '00000000-0000-0000-0000-000000000a01', 'EMP071', 'Todd', 'Ortega',
     'todd.ortega@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2019-05-21', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000048', '00000000-0000-0000-0000-000000000a01', 'EMP072', 'Luz', 'Goodwin',
     'luz.goodwin@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2016-02-19', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000049', '00000000-0000-0000-0000-000000000a01', 'EMP073', 'Brent', 'Preston',
     'brent.preston@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2012-11-19', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000004a', '00000000-0000-0000-0000-000000000a01', 'EMP074', 'Ivy', 'Harmon',
     'ivy.harmon@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2022-08-17', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000004b', '00000000-0000-0000-0000-000000000a01', 'EMP075', 'Clark', 'Stafford',
     'clark.stafford@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2019-05-18', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000004c', '00000000-0000-0000-0000-000000000a01', 'EMP076', 'Ada', 'Reeves',
     'ada.reeves@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2022-02-15', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000004d', '00000000-0000-0000-0000-000000000a01', 'EMP077', 'Neil', 'Holt',
     'neil.holt@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2024-11-14', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000004e', '00000000-0000-0000-0000-000000000a01', 'EMP078', 'Opal', 'Mercer',
     'opal.mercer@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2017-08-16', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000004f', '00000000-0000-0000-0000-000000000a01', 'EMP079', 'Rex', 'Dillon',
     'rex.dillon@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2020-05-15', 'vccea');

-- Team 9
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000a01', 'SUP080', 'Eve', 'Kemp',
     'eve.kemp@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2013-06-20', 'vcsg');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000a01', 'EMP081', 'Vince', 'Monroe',
     'vince.monroe@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2011-03-22', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000a01', 'EMP082', 'Joy', 'Vance',
     'joy.vance@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2020-12-17', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000a01', 'EMP083', 'Cliff', 'Garrett',
     'cliff.garrett@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2017-09-17', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000a01', 'EMP084', 'May', 'Lucero',
     'may.lucero@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2014-06-18', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-000000000a01', 'EMP085', 'Dale', 'McBride',
     'dale.mcbride@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2011-03-19', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000056', '00000000-0000-0000-0000-000000000a01', 'EMP086', 'Fern', 'Dorsey',
     'fern.dorsey@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2020-12-15', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000057', '00000000-0000-0000-0000-000000000a01', 'EMP087', 'Ray', 'Whitfield',
     'ray.whitfield@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2023-09-14', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000058', '00000000-0000-0000-0000-000000000a01', 'EMP088', 'Bree', 'Blevins',
     'bree.blevins@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2016-06-15', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000059', '00000000-0000-0000-0000-000000000a01', 'EMP089', 'Jude', 'Cantu',
     'jude.cantu@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2019-03-15', 'vccea');

-- Team 10
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-000000000a01', 'SUP090', 'Cara', 'Mack',
     'cara.mack@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2008-04-20', 'vcsg');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-000000000a01', 'EMP091', 'Noel', 'Winters',
     'noel.winters@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2016-01-18', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000005c', '00000000-0000-0000-0000-000000000a01', 'EMP092', 'Gemma', 'Robles',
     'gemma.robles@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2012-10-18', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000005d', '00000000-0000-0000-0000-000000000a01', 'EMP093', 'Hugh', 'Henson',
     'hugh.henson@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2022-07-16', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000005e', '00000000-0000-0000-0000-000000000a01', 'EMP094', 'Sage', 'Downing',
     'sage.downing@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2019-04-16', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-00000000005f', '00000000-0000-0000-0000-000000000a01', 'EMP095', 'Roy', 'Estrada',
     'roy.estrada@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2017-01-15', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000060', '00000000-0000-0000-0000-000000000a01', 'EMP096', 'Lark', 'Pace',
     'lark.pace@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2019-10-15', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000a01', 'EMP097', 'Paul', 'Bowen',
     'paul.bowen@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2022-07-14', 'vccea');
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000a01', 'EMP098', 'Wren', 'Kirk',
     'wren.kirk@valleycom.org', '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2015-04-15', 'vccea');

-- ── Seniority Records ──────────────────────────────────────────────────────

INSERT INTO seniority_records (user_id, org_id, overall_seniority_date, bargaining_unit_seniority_date, classification_seniority_date) VALUES
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000a01', '2000-01-01', NULL, '2000-01-01'),
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000a01', '2012-03-15', '2012-03-15', '2015-05-01'),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000a01', '2018-06-01', '2018-06-01', '2018-06-01'),
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000a01', '2021-09-12', '2021-09-12', '2021-09-12'),
    ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000a01', '2015-11-20', '2015-11-20', '2015-11-20'),
    ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000a01', '2021-04-27', '2021-04-27', '2021-04-27'),
    ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000a01', '2018-01-26', '2018-01-26', '2018-01-26'),
    ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000a01', '2014-10-27', '2014-10-27', '2014-10-27'),
    ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000a01', '2011-07-28', '2011-07-28', '2011-07-28'),
    ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000a01', '2023-01-23', '2023-01-23', '2023-01-23'),
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000a01', '2015-10-25', '2015-10-25', '2015-10-25'),
    ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000a01', '2018-07-24', '2018-07-24', '2018-07-24'),
    ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000a01', '2005-08-30', '2005-08-30', '2010-03-16'),
    ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000a01', '2013-02-26', '2013-02-26', '2013-02-26'),
    ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000a01', '2022-11-24', '2022-11-24', '2022-11-24'),
    ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000a01', '2019-08-25', '2019-08-25', '2019-08-25'),
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000a01', '2016-05-25', '2016-05-25', '2016-05-25'),
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000a01', '2019-02-23', '2019-02-23', '2019-02-23'),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000a01', '2021-11-22', '2021-11-22', '2021-11-22'),
    ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000a01', '2024-08-21', '2024-08-21', '2024-08-21'),
    ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000a01', '2017-05-23', '2017-05-23', '2017-05-23'),
    ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000a01', '2011-06-28', '2011-06-28', '2015-03-11'),
    ('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000a01', '2021-03-26', '2021-03-26', '2021-03-26'),
    ('00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000a01', '2017-12-25', '2017-12-25', '2017-12-25'),
    ('00000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000a01', '2014-09-25', '2014-09-25', '2014-09-25'),
    ('00000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000a01', '2011-06-26', '2011-06-26', '2011-06-26'),
    ('00000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-000000000a01', '2021-03-23', '2021-03-23', '2021-03-23'),
    ('00000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-000000000a01', '2017-12-23', '2017-12-23', '2017-12-23'),
    ('00000000-0000-0000-0000-00000000001c', '00000000-0000-0000-0000-000000000a01', '2020-09-21', '2020-09-21', '2020-09-21'),
    ('00000000-0000-0000-0000-00000000001d', '00000000-0000-0000-0000-000000000a01', '2023-06-21', '2023-06-21', '2023-06-21'),
    ('00000000-0000-0000-0000-00000000001e', '00000000-0000-0000-0000-000000000a01', '2016-03-22', '2016-03-22', '2016-03-22'),
    ('00000000-0000-0000-0000-00000000001f', '00000000-0000-0000-0000-000000000a01', '2006-04-28', '2006-04-28', '2011-04-24'),
    ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000a01', '2013-01-25', '2013-01-25', '2013-01-25'),
    ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000a01', '2022-10-23', '2022-10-23', '2022-10-23'),
    ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000a01', '2019-07-24', '2019-07-24', '2019-07-24'),
    ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000a01', '2016-04-23', '2016-04-23', '2016-04-23'),
    ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000a01', '2013-01-22', '2013-01-22', '2013-01-22'),
    ('00000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000a01', '2016-10-22', '2016-10-22', '2016-10-22'),
    ('00000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000a01', '2019-07-22', '2019-07-22', '2019-07-22'),
    ('00000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000a01', '2022-04-20', '2022-04-20', '2022-04-20'),
    ('00000000-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000a01', '2012-02-24', '2012-02-24', '2016-04-18'),
    ('00000000-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000a01', '2017-11-23', '2017-11-23', '2017-11-23'),
    ('00000000-0000-0000-0000-00000000002a', '00000000-0000-0000-0000-000000000a01', '2014-08-24', '2014-08-24', '2014-08-24'),
    ('00000000-0000-0000-0000-00000000002b', '00000000-0000-0000-0000-000000000a01', '2011-05-25', '2011-05-25', '2011-05-25'),
    ('00000000-0000-0000-0000-00000000002c', '00000000-0000-0000-0000-000000000a01', '2021-02-19', '2021-02-19', '2021-02-19'),
    ('00000000-0000-0000-0000-00000000002d', '00000000-0000-0000-0000-000000000a01', '2017-11-20', '2017-11-20', '2017-11-20'),
    ('00000000-0000-0000-0000-00000000002e', '00000000-0000-0000-0000-000000000a01', '2015-08-22', '2015-08-22', '2015-08-22'),
    ('00000000-0000-0000-0000-00000000002f', '00000000-0000-0000-0000-000000000a01', '2018-05-21', '2018-05-21', '2018-05-21'),
    ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000a01', '2021-02-17', '2021-02-17', '2021-02-17'),
    ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000a01', '2023-11-17', '2023-11-17', '2023-11-17'),
    ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000a01', '2006-12-25', '2006-12-25', '2010-06-02'),
    ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000a01', '2022-09-21', '2022-09-21', '2022-09-21'),
    ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000a01', '2019-06-22', '2019-06-22', '2019-06-22'),
    ('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000a01', '2016-03-22', '2016-03-22', '2016-03-22'),
    ('00000000-0000-0000-0000-000000000036', '00000000-0000-0000-0000-000000000a01', '2012-12-21', '2012-12-21', '2012-12-21'),
    ('00000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-000000000a01', '2022-09-18', '2022-09-18', '2022-09-18'),
    ('00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000a01', '2024-06-18', '2024-06-18', '2024-06-18'),
    ('00000000-0000-0000-0000-000000000039', '00000000-0000-0000-0000-000000000a01', '2017-03-20', '2017-03-20', '2017-03-20'),
    ('00000000-0000-0000-0000-00000000003a', '00000000-0000-0000-0000-000000000a01', '2019-12-18', '2019-12-18', '2019-12-18'),
    ('00000000-0000-0000-0000-00000000003b', '00000000-0000-0000-0000-000000000a01', '2022-09-16', '2022-09-16', '2022-09-16'),
    ('00000000-0000-0000-0000-00000000003c', '00000000-0000-0000-0000-000000000a01', '2012-10-22', '2012-10-22', '2017-07-13'),
    ('00000000-0000-0000-0000-00000000003d', '00000000-0000-0000-0000-000000000a01', '2014-07-23', '2014-07-23', '2014-07-23'),
    ('00000000-0000-0000-0000-00000000003e', '00000000-0000-0000-0000-000000000a01', '2011-04-23', '2011-04-23', '2011-04-23'),
    ('00000000-0000-0000-0000-00000000003f', '00000000-0000-0000-0000-000000000a01', '2021-01-18', '2021-01-18', '2021-01-18'),
    ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000a01', '2017-10-19', '2017-10-19', '2017-10-19'),
    ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000a01', '2014-07-20', '2014-07-20', '2014-07-20'),
    ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000a01', '2023-04-18', '2023-04-18', '2023-04-18'),
    ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000a01', '2016-01-18', '2016-01-18', '2016-01-18'),
    ('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000a01', '2018-10-17', '2018-10-17', '2018-10-17'),
    ('00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000a01', '2021-07-16', '2021-07-16', '2021-07-16'),
    ('00000000-0000-0000-0000-000000000046', '00000000-0000-0000-0000-000000000a01', '2007-08-23', '2007-08-23', '2011-08-27'),
    ('00000000-0000-0000-0000-000000000047', '00000000-0000-0000-0000-000000000a01', '2019-05-21', '2019-05-21', '2019-05-21'),
    ('00000000-0000-0000-0000-000000000048', '00000000-0000-0000-0000-000000000a01', '2016-02-19', '2016-02-19', '2016-02-19'),
    ('00000000-0000-0000-0000-000000000049', '00000000-0000-0000-0000-000000000a01', '2012-11-19', '2012-11-19', '2012-11-19'),
    ('00000000-0000-0000-0000-00000000004a', '00000000-0000-0000-0000-000000000a01', '2022-08-17', '2022-08-17', '2022-08-17'),
    ('00000000-0000-0000-0000-00000000004b', '00000000-0000-0000-0000-000000000a01', '2019-05-18', '2019-05-18', '2019-05-18'),
    ('00000000-0000-0000-0000-00000000004c', '00000000-0000-0000-0000-000000000a01', '2022-02-15', '2022-02-15', '2022-02-15'),
    ('00000000-0000-0000-0000-00000000004d', '00000000-0000-0000-0000-000000000a01', '2024-11-14', '2024-11-14', '2024-11-14'),
    ('00000000-0000-0000-0000-00000000004e', '00000000-0000-0000-0000-000000000a01', '2017-08-16', '2017-08-16', '2017-08-16'),
    ('00000000-0000-0000-0000-00000000004f', '00000000-0000-0000-0000-000000000a01', '2020-05-15', '2020-05-15', '2020-05-15'),
    ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000a01', '2013-06-20', '2013-06-20', '2016-10-07'),
    ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000a01', '2011-03-22', '2011-03-22', '2011-03-22'),
    ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000a01', '2020-12-17', '2020-12-17', '2020-12-17'),
    ('00000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000a01', '2017-09-17', '2017-09-17', '2017-09-17'),
    ('00000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000a01', '2014-06-18', '2014-06-18', '2014-06-18'),
    ('00000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-000000000a01', '2011-03-19', '2011-03-19', '2011-03-19'),
    ('00000000-0000-0000-0000-000000000056', '00000000-0000-0000-0000-000000000a01', '2020-12-15', '2020-12-15', '2020-12-15'),
    ('00000000-0000-0000-0000-000000000057', '00000000-0000-0000-0000-000000000a01', '2023-09-14', '2023-09-14', '2023-09-14'),
    ('00000000-0000-0000-0000-000000000058', '00000000-0000-0000-0000-000000000a01', '2016-06-15', '2016-06-15', '2016-06-15'),
    ('00000000-0000-0000-0000-000000000059', '00000000-0000-0000-0000-000000000a01', '2019-03-15', '2019-03-15', '2019-03-15'),
    ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-000000000a01', '2008-04-20', '2008-04-20', '2012-11-20'),
    ('00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-000000000a01', '2016-01-18', '2016-01-18', '2016-01-18'),
    ('00000000-0000-0000-0000-00000000005c', '00000000-0000-0000-0000-000000000a01', '2012-10-18', '2012-10-18', '2012-10-18'),
    ('00000000-0000-0000-0000-00000000005d', '00000000-0000-0000-0000-000000000a01', '2022-07-16', '2022-07-16', '2022-07-16'),
    ('00000000-0000-0000-0000-00000000005e', '00000000-0000-0000-0000-000000000a01', '2019-04-16', '2019-04-16', '2019-04-16'),
    ('00000000-0000-0000-0000-00000000005f', '00000000-0000-0000-0000-000000000a01', '2017-01-15', '2017-01-15', '2017-01-15'),
    ('00000000-0000-0000-0000-000000000060', '00000000-0000-0000-0000-000000000a01', '2019-10-15', '2019-10-15', '2019-10-15'),
    ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000a01', '2022-07-14', '2022-07-14', '2022-07-14'),
    ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000a01', '2015-04-15', '2015-04-15', '2015-04-15');

-- ── Shift Templates ─────────────────────────────────────────────────────────
-- 11 Valleycom time patterns (includes 04-1600 for Team 4 SUP)

INSERT INTO shift_templates (id, org_id, name, start_time, end_time, crosses_midnight, duration_minutes, color) VALUES
    ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000a01', '04-1400', '04:00', '14:00', false, 600, '#2196F3'),
    ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000a01', '06-1600', '06:00', '16:00', false, 600, '#4CAF50'),
    ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000a01', '06-1800', '06:00', '18:00', false, 720, '#8BC34A'),
    ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000a01', '08-1800', '08:00', '18:00', false, 600, '#FF9800'),
    ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000a01', '12-2200', '12:00', '22:00', false, 600, '#9C27B0'),
    ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-000000000a01', '12-2400', '12:00', '00:00', true,  720, '#E91E63'),
    ('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000a01', '14-2400', '14:00', '00:00', true,  600, '#F44336'),
    ('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-000000000a01', '16-0400', '16:00', '04:00', true,  720, '#673AB7'),
    ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000a01', '18-0400', '18:00', '04:00', true,  600, '#3F51B5'),
    ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000a01', '22-0800', '22:00', '08:00', true,  600, '#00BCD4'),
    ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-000000000a01', '04-1600', '04:00', '16:00', false, 720, '#795548');

-- ── Leave Types ─────────────────────────────────────────────────────────────
-- All 26 Valleycom leave codes

INSERT INTO leave_types (org_id, code, name, requires_approval, is_reported, draws_from, display_order) VALUES
    ('00000000-0000-0000-0000-000000000a01', 'bid_vacation',      'BID Vacation',             true,  false, 'vacation',  1),
    ('00000000-0000-0000-0000-000000000a01', 'posted_vacation',   'Posted Vacation',          true,  false, 'vacation',  2),
    ('00000000-0000-0000-0000-000000000a01', 'sick',              'Sick',                     false, true,  'sick',      3),
    ('00000000-0000-0000-0000-000000000a01', 'sick_family',       'Sick (Family)',             false, true,  'sick',      4),
    ('00000000-0000-0000-0000-000000000a01', 'fmla_sick',         'FMLA Sick',                false, true,  'sick',      5),
    ('00000000-0000-0000-0000-000000000a01', 'fmla_family',       'FMLA (Family)',            false, true,  'sick',      6),
    ('00000000-0000-0000-0000-000000000a01', 'fmla_military',     'FMLA (Military)',          false, true,  'sick',      7),
    ('00000000-0000-0000-0000-000000000a01', 'kin_care',          'Kin Care',                 false, true,  'sick',      8),
    ('00000000-0000-0000-0000-000000000a01', 'bereavement',       'Bereavement',              false, true,  NULL,        9),
    ('00000000-0000-0000-0000-000000000a01', 'holiday',           'Holiday',                  true,  false, 'holiday',  10),
    ('00000000-0000-0000-0000-000000000a01', 'holiday_personal',  'Holiday (Personal)',       true,  false, 'holiday',  11),
    ('00000000-0000-0000-0000-000000000a01', 'comp_time',         'Comp Time',                true,  false, 'comp',     12),
    ('00000000-0000-0000-0000-000000000a01', 'comp_earned',       'Comp Time Earned',         false, false, 'comp',     13),
    ('00000000-0000-0000-0000-000000000a01', 'military_leave',    'Military Leave',           true,  false, NULL,       14),
    ('00000000-0000-0000-0000-000000000a01', 'jury_duty',         'Jury Duty',                false, true,  NULL,       15),
    ('00000000-0000-0000-0000-000000000a01', 'admin_leave',       'Administrative Leave',     true,  false, NULL,       16),
    ('00000000-0000-0000-0000-000000000a01', 'union_business',    'Union Business',           true,  false, NULL,       17),
    ('00000000-0000-0000-0000-000000000a01', 'training',          'Training',                 true,  false, NULL,       18),
    ('00000000-0000-0000-0000-000000000a01', 'light_duty',        'Light Duty',               true,  false, NULL,       19),
    ('00000000-0000-0000-0000-000000000a01', 'workers_comp',      'Workers Comp',             false, true,  NULL,       20),
    ('00000000-0000-0000-0000-000000000a01', 'lwop',              'Leave Without Pay',        true,  false, NULL,       21),
    ('00000000-0000-0000-0000-000000000a01', 'donation_received', 'Shared Leave (Received)',  true,  false, NULL,       22),
    ('00000000-0000-0000-0000-000000000a01', 'donation_given',    'Shared Leave (Given)',     true,  false, NULL,       23),
    ('00000000-0000-0000-0000-000000000a01', 'covid',             'COVID',                    false, true,  'sick',     24),
    ('00000000-0000-0000-0000-000000000a01', 'suspension',        'Suspension',               true,  false, NULL,       25),
    ('00000000-0000-0000-0000-000000000a01', 'other',             'Other',                    true,  false, NULL,       26);

-- ── OT Reasons ──────────────────────────────────────────────────────────────
-- All 29 Valleycom OT reason codes

INSERT INTO ot_reasons (org_id, code, name, display_order) VALUES
    ('00000000-0000-0000-0000-000000000a01', 'sick_coverage',        'Sick Coverage',            1),
    ('00000000-0000-0000-0000-000000000a01', 'vacation_coverage',    'Vacation Coverage',        2),
    ('00000000-0000-0000-0000-000000000a01', 'fmla_coverage',        'FMLA Coverage',            3),
    ('00000000-0000-0000-0000-000000000a01', 'training_coverage',    'Training Coverage',        4),
    ('00000000-0000-0000-0000-000000000a01', 'military_coverage',    'Military Leave Coverage',  5),
    ('00000000-0000-0000-0000-000000000a01', 'bereavement_coverage', 'Bereavement Coverage',     6),
    ('00000000-0000-0000-0000-000000000a01', 'jury_duty_coverage',   'Jury Duty Coverage',       7),
    ('00000000-0000-0000-0000-000000000a01', 'admin_leave_cov',      'Admin Leave Coverage',     8),
    ('00000000-0000-0000-0000-000000000a01', 'union_business_cov',   'Union Business Coverage',  9),
    ('00000000-0000-0000-0000-000000000a01', 'light_duty_cov',       'Light Duty Coverage',     10),
    ('00000000-0000-0000-0000-000000000a01', 'workers_comp_cov',     'Workers Comp Coverage',   11),
    ('00000000-0000-0000-0000-000000000a01', 'lwop_coverage',        'LWOP Coverage',           12),
    ('00000000-0000-0000-0000-000000000a01', 'covid_coverage',       'COVID Coverage',          13),
    ('00000000-0000-0000-0000-000000000a01', 'suspension_cov',       'Suspension Coverage',     14),
    ('00000000-0000-0000-0000-000000000a01', 'vacancy',              'Vacancy',                 15),
    ('00000000-0000-0000-0000-000000000a01', 'special_event',        'Special Event',           16),
    ('00000000-0000-0000-0000-000000000a01', 'high_call_volume',     'High Call Volume',        17),
    ('00000000-0000-0000-0000-000000000a01', 'natural_disaster',     'Natural Disaster',        18),
    ('00000000-0000-0000-0000-000000000a01', 'major_incident',       'Major Incident',          19),
    ('00000000-0000-0000-0000-000000000a01', 'staffing_minimum',     'Staffing Minimum',        20),
    ('00000000-0000-0000-0000-000000000a01', 'holdover',             'Holdover',                21),
    ('00000000-0000-0000-0000-000000000a01', 'early_report',         'Early Report',            22),
    ('00000000-0000-0000-0000-000000000a01', 'shift_extension',      'Shift Extension',         23),
    ('00000000-0000-0000-0000-000000000a01', 'court_time',           'Court Time',              24),
    ('00000000-0000-0000-0000-000000000a01', 'callback',             'Callback',                25),
    ('00000000-0000-0000-0000-000000000a01', 'meeting',              'Meeting',                 26),
    ('00000000-0000-0000-0000-000000000a01', 'project_work',         'Project Work',            27),
    ('00000000-0000-0000-0000-000000000a01', 'comp_time_earn',       'Comp Time Earning',       28),
    ('00000000-0000-0000-0000-000000000a01', 'other',                'Other',                   29);

-- ── Teams ───────────────────────────────────────────────────────────────────
-- Teams 1-10

INSERT INTO teams (id, org_id, name) VALUES
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000a01', 'Team 1'),
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000a01', 'Team 2'),
    ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000a01', 'Team 3'),
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-000000000a01', 'Team 4'),
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-000000000a01', 'Team 5'),
    ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-000000000a01', 'Team 6'),
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-000000000a01', 'Team 7'),
    ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-000000000a01', 'Team 8'),
    ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-000000000a01', 'Team 9'),
    ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-000000000a01', 'Team 10');

-- ── Shift Slots ─────────────────────────────────────────────────────────────
-- One slot per person with explicit UUID (handles duplicate shift+days within teams)

-- Team 1 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000c03', '{0,1,5,6}', 'T1 SUP 06-1800 FSSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T1 COII 04-1400 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c01', '{0,5,6}', 'T1 COI 04-1400 FSS');

-- Team 2 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{0,1,6}', 'T2 COII 12-2200 SSM');

-- Team 1 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{0,1,6}', 'T1 COII 04-1400 SSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T1 COII 08-1800 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{0,1,6}', 'T1 COII 08-1800 SSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000008', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{4,5,6}', 'T1 COII 12-2200 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000009', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c01', '{4,5,6}', 'T1 COI 04-1400 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000000a', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c01', '{0,1,6}', 'T1 COI 04-1400 SSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000000b', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{0,1,6}', 'T1 COI 08-1800 SSM');

-- Team 2 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000000c', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-000000000c03', '{0,4,5,6}', 'T2 SUP 12-2400 TFSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000000d', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T2 COII 14-2400 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000000e', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{4,5,6}', 'T2 COII 14-2400 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000000f', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T2 COII 18-0400 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000010', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{0,1,6}', 'T2 COII 18-0400 SSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000011', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{0,5,6}', 'T2 COI 08-1800 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000012', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c01', '{0,5,6}', 'T2 COI 12-2200 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000013', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c01', '{0,5,6}', 'T2 COI 14-2400 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000014', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c01', '{3,4,5}', 'T2 COI 14-2400 WTF');

-- Team 3 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000015', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{0,1,2}', 'T3 SUP 08-1800 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000016', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{0,1,2}', 'T3 COII 08-1800 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000017', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{0,1,2}', 'T3 COII 08-1800 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000018', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T3 COII 08-1800 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000019', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{0,1,2}', 'T3 COII 12-2200 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000001a', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{0,1,6}', 'T3 COII 14-2400 SSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000001b', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{0,1,2}', 'T3 COI 08-1800 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000001c', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{0,1,6}', 'T3 COI 08-1800 SSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000001d', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{1,2,3}', 'T3 COI 08-1800 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000001e', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c01', '{0,1,2}', 'T3 COI 12-2200 SMT');

-- Team 4 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000001f', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-000000000c03', '{0,1,2,3}', 'T4 SUP 04-1600 SMTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000020', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T4 COII 04-1400 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000021', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{0,1,2}', 'T4 COII 04-1400 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000022', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{2,3,4}', 'T4 COII 04-1400 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000023', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T4 COII 12-2200 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000024', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{2,3,4}', 'T4 COII 12-2200 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000025', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c01', '{2,3,4}', 'T4 COI 04-1400 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000026', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c01', '{1,2,3}', 'T4 COI 04-1400 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000027', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{2,3,4}', 'T4 COI 08-1800 TWT');

-- Team 5 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000028', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c03', '{4,5,6}', 'T5 SUP 04-1400 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000029', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{4,5,6}', 'T5 COII 04-1400 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000002a', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{4,5,6}', 'T5 COII 04-1400 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000002b', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T5 COII 04-1400 WTF');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000002c', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{4,5,6}', 'T5 COII 08-1800 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000002d', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T5 COII 08-1800 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000002e', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c01', '{2,3,4}', 'T5 COI 04-1400 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000002f', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{0,5,6}', 'T5 COI 08-1800 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000030', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{3,4,5}', 'T5 COI 08-1800 WTF');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000031', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c01', '{3,4,5}', 'T5 COI 12-2200 WTF');

-- Team 6 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000032', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-000000000c03', '{0,1,2,3}', 'T6 SUP 16-0400 SMTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000033', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{2,3,4}', 'T6 COII 18-0400 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000034', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{0,1,2}', 'T6 COII 18-0400 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000035', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T6 COII 14-2400 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000036', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T6 COII 22-0800 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000037', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{2,3,4}', 'T6 COII 22-0800 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000038', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c01', '{0,1,6}', 'T6 COI 12-2200 SSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000039', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c01', '{0,1,6}', 'T6 COI 14-2400 SSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000003a', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c01', '{0,1,2}', 'T6 COI 14-2400 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000003b', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c01', '{0,1,2}', 'T6 COI 18-0400 SMT');

-- Team 7 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000003c', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c03', '{4,5,6}', 'T7 SUP 18-0400 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000003d', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T7 COII 14-2400 WTF');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000003e', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T7 COII 18-0400 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000003f', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{4,5,6}', 'T7 COII 18-0400 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000040', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{4,5,6}', 'T7 COII 22-0800 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000041', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T7 COII 22-0800 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000042', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c01', '{0,5,6}', 'T7 COI 18-0400 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000043', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c01', '{0,1,2}', 'T7 COI 18-0400 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000044', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c01', '{0,5,6}', 'T7 COI 22-0800 FSS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000045', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c01', '{2,3,4}', 'T7 COI 22-0800 TWT');

-- Team 8 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000046', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-000000000c03', '{3,4,5,6}', 'T8 SUP 16-0400 WTFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000047', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{2,3,4}', 'T8 COII 14-2400 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000048', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T8 COII 18-0400 WTF');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000049', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T8 COII 18-0400 WTF');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000004a', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T8 COII 22-0800 WTF');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000004b', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{4,5,6}', 'T8 COII 22-0800 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000004c', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c01', '{3,4,5}', 'T8 COI 14-2400 WTF');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000004d', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c01', '{3,4,5}', 'T8 COI 18-0400 WTF');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000004e', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c01', '{4,5,6}', 'T8 COI 18-0400 TFS');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000004f', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c01', '{2,3,4}', 'T8 COI 22-0800 TWT');

-- Team 9 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000050', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c03', '{0,1,2}', 'T9 SUP 18-0400 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000051', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{0,1,2}', 'T9 COII 18-0400 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000052', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T9 COII 18-0400 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000053', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{0,1,2}', 'T9 COII 22-0800 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000054', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{0,1,2}', 'T9 COII 22-0800 SMT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000055', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{0,1,6}', 'T9 COII 22-0800 SSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000056', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c01', '{1,2,3}', 'T9 COI 18-0400 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000057', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c01', '{1,2,3}', 'T9 COI 18-0400 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000058', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c01', '{0,1,6}', 'T9 COI 18-0400 SSM');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000059', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c01', '{0,1,6}', 'T9 COI 22-0800 SSM');

-- Team 10 slots
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000005a', '00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c03', '{2,3,4}', 'T10 SUP 06-1600 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000005b', '00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{2,3,4}', 'T10 COII 08-1800 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000005c', '00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T10 COII 08-1800 MTW');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000005d', '00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T10 COII 08-1800 WTF');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000005e', '00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T10 COII 08-1800 WTF');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-00000000005f', '00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c01', '{2,3,4}', 'T10 COI 12-2200 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000060', '00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c01', '{2,3,4}', 'T10 COI 12-2200 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000061', '00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c01', '{2,3,4}', 'T10 COI 14-2400 TWT');
INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0001-000000000062', '00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c01', '{3,4,5}', 'T10 COI 14-2400 WTF');

-- ── Accrual Schedules ─────────────────────────────────────────────────────
-- Vacation accrual per VCCEA contract: YOS-tiered, biweekly (26 pay periods/year)

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vccea', 0, 5, 3.08, 240, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vccea', 5, 10, 4.62, 360, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vccea', 10, 20, 6.15, 480, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vccea', 20, NULL, 7.69, 600, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vcsg', 0, 5, 3.08, 240, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vcsg', 5, 10, 4.62, 360, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vcsg', 10, 20, 6.15, 480, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vcsg', 20, NULL, 7.69, 600, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vccea', 0, NULL, 3.69, NULL, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'sick';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vcsg', 0, NULL, 3.69, NULL, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'sick';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vccea', 0, NULL, 3.69, 96, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'holiday';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vcsg', 0, NULL, 3.69, 96, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'holiday';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vccea', 0, NULL, 1.54, 40, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'comp_time';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vcsg', 0, NULL, 1.54, 40, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'comp_time';

-- ── Schedule Period ───────────────────────────────────────────────────────

INSERT INTO schedule_periods (id, org_id, name, start_date, end_date, is_active, status) VALUES
    ('00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000a01', '2026 Q1 Bid Schedule', '2026-01-01', '2026-03-31', true, 'completed');

-- ── Slot Assignments ──────────────────────────────────────────────────────
-- Direct UUID slot references (no ambiguous joins needed)

-- Team 1
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000f01');

-- Team 2
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000f01');

-- Team 1
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000008', '00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000009', '00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000000a', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000000b', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000f01');

-- Team 2
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-00000000000c', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000000d', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000000e', '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000000f', '00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000010', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000011', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000012', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000013', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000014', '00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000f01');

-- Team 3
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-000000000015', '00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000016', '00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000017', '00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000018', '00000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000019', '00000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000001a', '00000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000001b', '00000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000001c', '00000000-0000-0000-0000-00000000001c', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000001d', '00000000-0000-0000-0000-00000000001d', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000001e', '00000000-0000-0000-0000-00000000001e', '00000000-0000-0000-0000-000000000f01');

-- Team 4
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-00000000001f', '00000000-0000-0000-0000-00000000001f', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000020', '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000021', '00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000022', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000023', '00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000024', '00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000025', '00000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000026', '00000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000027', '00000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000f01');

-- Team 5
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-000000000028', '00000000-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000029', '00000000-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000002a', '00000000-0000-0000-0000-00000000002a', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000002b', '00000000-0000-0000-0000-00000000002b', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000002c', '00000000-0000-0000-0000-00000000002c', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000002d', '00000000-0000-0000-0000-00000000002d', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000002e', '00000000-0000-0000-0000-00000000002e', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000002f', '00000000-0000-0000-0000-00000000002f', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000030', '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000031', '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000f01');

-- Team 6
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-000000000032', '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000033', '00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000034', '00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000035', '00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000036', '00000000-0000-0000-0000-000000000036', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000037', '00000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000038', '00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000039', '00000000-0000-0000-0000-000000000039', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000003a', '00000000-0000-0000-0000-00000000003a', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000003b', '00000000-0000-0000-0000-00000000003b', '00000000-0000-0000-0000-000000000f01');

-- Team 7
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-00000000003c', '00000000-0000-0000-0000-00000000003c', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000003d', '00000000-0000-0000-0000-00000000003d', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000003e', '00000000-0000-0000-0000-00000000003e', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000003f', '00000000-0000-0000-0000-00000000003f', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000040', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000041', '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000042', '00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000043', '00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000044', '00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000045', '00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000f01');

-- Team 8
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-000000000046', '00000000-0000-0000-0000-000000000046', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000047', '00000000-0000-0000-0000-000000000047', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000048', '00000000-0000-0000-0000-000000000048', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000049', '00000000-0000-0000-0000-000000000049', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000004a', '00000000-0000-0000-0000-00000000004a', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000004b', '00000000-0000-0000-0000-00000000004b', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000004c', '00000000-0000-0000-0000-00000000004c', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000004d', '00000000-0000-0000-0000-00000000004d', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000004e', '00000000-0000-0000-0000-00000000004e', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000004f', '00000000-0000-0000-0000-00000000004f', '00000000-0000-0000-0000-000000000f01');

-- Team 9
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-000000000050', '00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000051', '00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000052', '00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000053', '00000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000054', '00000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000055', '00000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000056', '00000000-0000-0000-0000-000000000056', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000057', '00000000-0000-0000-0000-000000000057', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000058', '00000000-0000-0000-0000-000000000058', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000059', '00000000-0000-0000-0000-000000000059', '00000000-0000-0000-0000-000000000f01');

-- Team 10
INSERT INTO slot_assignments (slot_id, user_id, period_id) VALUES
    ('00000000-0000-0000-0001-00000000005a', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000005b', '00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000005c', '00000000-0000-0000-0000-00000000005c', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000005d', '00000000-0000-0000-0000-00000000005d', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000005e', '00000000-0000-0000-0000-00000000005e', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-00000000005f', '00000000-0000-0000-0000-00000000005f', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000060', '00000000-0000-0000-0000-000000000060', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000061', '00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000f01'),
    ('00000000-0000-0000-0001-000000000062', '00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000f01');

-- ── Leave Balances ────────────────────────────────────────────────────────
-- Give all non-admin employees realistic balances based on tenure

INSERT INTO leave_balances (id, org_id, user_id, leave_type_id, balance_hours, as_of_date)
SELECT gen_random_uuid(),
       '00000000-0000-0000-0000-000000000a01',
       u.id,
       lt.id,
       CASE lt.code
         WHEN 'bid_vacation' THEN LEAST(240, GREATEST(20,
           EXTRACT(YEAR FROM AGE('2026-02-26'::DATE, u.hire_date))::NUMERIC * 30 + 40))
         WHEN 'sick' THEN LEAST(960, GREATEST(40,
           EXTRACT(YEAR FROM AGE('2026-02-26'::DATE, u.hire_date))::NUMERIC * 80 + 40))
         WHEN 'holiday' THEN 48.0
         WHEN 'comp_time' THEN 15.0
       END,
       '2026-02-26'
FROM users u
CROSS JOIN leave_types lt
WHERE u.org_id = '00000000-0000-0000-0000-000000000a01'
  AND u.is_active = true
  AND u.role != 'admin'
  AND lt.org_id = '00000000-0000-0000-0000-000000000a01'
  AND lt.code IN ('bid_vacation', 'sick', 'holiday', 'comp_time');

-- ── Scheduled Shifts ─────────────────────────────────────────────────────
-- Generate concrete shift instances for all 10 teams, Feb-Mar 2026

INSERT INTO scheduled_shifts (org_id, shift_template_id, date, required_headcount, slot_id)
SELECT
    '00000000-0000-0000-0000-000000000a01',
    ss.shift_template_id,
    d.date,
    1,
    ss.id
FROM shift_slots ss
CROSS JOIN generate_series('2026-02-01'::DATE, '2026-03-31'::DATE, '1 day') AS d(date)
WHERE ss.team_id IN (
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000d5',
    '00000000-0000-0000-0000-0000000000d6',
    '00000000-0000-0000-0000-0000000000d7',
    '00000000-0000-0000-0000-0000000000d8',
    '00000000-0000-0000-0000-0000000000d9',
    '00000000-0000-0000-0000-0000000000da'
)
AND EXTRACT(DOW FROM d.date)::INT = ANY(ss.days_of_week);

-- ── Assignments ──────────────────────────────────────────────────────────
-- Link users to their scheduled shifts based on slot_assignments

INSERT INTO assignments (scheduled_shift_id, user_id, created_by)
SELECT
    sched.id,
    sa.user_id,
    '00000000-0000-0000-0000-0000000000a1'
FROM scheduled_shifts sched
JOIN shift_slots ss ON sched.slot_id = ss.id
JOIN slot_assignments sa ON sa.slot_id = ss.id
    AND sa.period_id = '00000000-0000-0000-0000-000000000f01'
WHERE ss.team_id IN (
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000d5',
    '00000000-0000-0000-0000-0000000000d6',
    '00000000-0000-0000-0000-0000000000d7',
    '00000000-0000-0000-0000-0000000000d8',
    '00000000-0000-0000-0000-0000000000d9',
    '00000000-0000-0000-0000-0000000000da'
);

-- ── Coverage Plan ────────────────────────────────────────────────────────

INSERT INTO coverage_plans (id, org_id, name, description, is_default, is_active, created_by)
VALUES (
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000000a01',
    'Standard 24/7 Coverage',
    'Default staffing requirements for 24-hour dispatch operations',
    true, true,
    '00000000-0000-0000-0000-0000000000a1'
);

-- COII (B Dispatcher) coverage — SE: Min 10, Max 13
-- Overnight (00:00-05:59 = slots 0-11): slightly lower staffing
-- Day/swing (06:00-21:59 = slots 12-43): full staffing
-- Late night (22:00-23:59 = slots 44-47): same as overnight
INSERT INTO coverage_plan_slots (plan_id, classification_id, day_of_week, slot_index, min_headcount, target_headcount, max_headcount)
SELECT
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000000c02',
    dow.d, slot.s,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 10 ELSE 9 END,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 12 ELSE 10 END,
    13
FROM generate_series(0, 6) AS dow(d)
CROSS JOIN generate_series(0, 47) AS slot(s);

-- COI (C Call Receiver) coverage — SE: Min 8, Max 11
INSERT INTO coverage_plan_slots (plan_id, classification_id, day_of_week, slot_index, min_headcount, target_headcount, max_headcount)
SELECT
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000000c01',
    dow.d, slot.s,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 8 ELSE 6 END,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 10 ELSE 8 END,
    11
FROM generate_series(0, 6) AS dow(d)
CROSS JOIN generate_series(0, 47) AS slot(s);

-- Supervisor (A Supervisor) coverage — SE: Min 1, Max 4
INSERT INTO coverage_plan_slots (plan_id, classification_id, day_of_week, slot_index, min_headcount, target_headcount, max_headcount)
SELECT
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000000c03',
    dow.d, slot.s,
    1,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 2 ELSE 1 END,
    4
FROM generate_series(0, 6) AS dow(d)
CROSS JOIN generate_series(0, 47) AS slot(s);

-- Assign coverage plan for Q1 2026
INSERT INTO coverage_plan_assignments (org_id, plan_id, start_date, end_date, notes, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000a01',
    '00000000-0000-0000-0000-000000001001',
    '2026-01-01', '2026-03-31',
    'Q1 2026 standard coverage',
    '00000000-0000-0000-0000-0000000000a1'
);

-- ── Holiday Calendar ─────────────────────────────────────────────────────

INSERT INTO holiday_calendar (org_id, date, name, is_premium_pay) VALUES
    ('00000000-0000-0000-0000-000000000a01', '2026-01-01', 'New Year''s Day',           true),
    ('00000000-0000-0000-0000-000000000a01', '2026-01-19', 'Martin Luther King Jr Day', true),
    ('00000000-0000-0000-0000-000000000a01', '2026-02-16', 'Presidents'' Day',          true),
    ('00000000-0000-0000-0000-000000000a01', '2026-05-25', 'Memorial Day',              true),
    ('00000000-0000-0000-0000-000000000a01', '2026-07-04', 'Independence Day',          true),
    ('00000000-0000-0000-0000-000000000a01', '2026-09-07', 'Labor Day',                 true),
    ('00000000-0000-0000-0000-000000000a01', '2026-11-11', 'Veterans Day',              true),
    ('00000000-0000-0000-0000-000000000a01', '2026-11-26', 'Thanksgiving',              true),
    ('00000000-0000-0000-0000-000000000a01', '2026-11-27', 'Day After Thanksgiving',    false),
    ('00000000-0000-0000-0000-000000000a01', '2026-12-24', 'Christmas Eve',             false),
    ('00000000-0000-0000-0000-000000000a01', '2026-12-25', 'Christmas Day',             true);

-- ── Leave Requests ───────────────────────────────────────────────────────
-- Sample requests in various statuses

-- Mike Johnson: approved vacation (Feb 15-17)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, reason, status, reviewed_by)
SELECT '00000000-0000-0000-0000-000000001101',
       '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000002',
       lt.id, '2026-02-15', '2026-02-17', 30.0,
       'Family trip to Portland', 'approved', '00000000-0000-0000-0000-000000000001'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001101', '2026-02-15', 10.0),
    ('00000000-0000-0000-0000-000000001101', '2026-02-16', 10.0),
    ('00000000-0000-0000-0000-000000001101', '2026-02-17', 10.0);

-- Marcus Torres: pending vacation (Mar 10-12)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, reason, status)
SELECT '00000000-0000-0000-0000-000000001102',
       '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000005',
       lt.id, '2026-03-10', '2026-03-12', 30.0,
       'Spring break with kids', 'pending'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'posted_vacation';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001102', '2026-03-10', 10.0),
    ('00000000-0000-0000-0000-000000001102', '2026-03-11', 10.0),
    ('00000000-0000-0000-0000-000000001102', '2026-03-12', 10.0);

-- Nathan Cooper: approved holiday (Feb 16)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, status, reviewed_by)
SELECT '00000000-0000-0000-0000-000000001103',
       '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-00000000000d',
       lt.id, '2026-02-16', '2026-02-16', 10.0,
       'approved', '00000000-0000-0000-0000-00000000000c'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'holiday';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001103', '2026-02-16', 10.0);

-- Anika Edwards: approved sick (Feb 5)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, status, reviewed_by)
SELECT '00000000-0000-0000-0000-000000001104',
       '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000016',
       lt.id, '2026-02-05', '2026-02-05', 10.0,
       'approved', '00000000-0000-0000-0000-000000000015'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'sick';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001104', '2026-02-05', 10.0);

-- Colton Kim: denied vacation (Feb 20-22)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, reason, status, reviewed_by, reviewer_notes)
SELECT '00000000-0000-0000-0000-000000001105',
       '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000017',
       lt.id, '2026-02-20', '2026-02-22', 30.0,
       'Weekend getaway', 'denied', '00000000-0000-0000-0000-000000000015',
       'Insufficient coverage — two others already approved off this weekend'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001105', '2026-02-20', 10.0),
    ('00000000-0000-0000-0000-000000001105', '2026-02-21', 10.0),
    ('00000000-0000-0000-0000-000000001105', '2026-02-22', 10.0);

-- Elena Nakamura: pending comp time (Mar 2)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, reason, status)
SELECT '00000000-0000-0000-0000-000000001106',
       '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000006',
       lt.id, '2026-03-02', '2026-03-02', 10.0,
       'Personal appointment', 'pending'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'comp_time';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001106', '2026-03-02', 10.0);

-- James Rivera: approved FMLA (Feb 24-28)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, reason, status, reviewed_by)
SELECT '00000000-0000-0000-0000-000000001107',
       '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000004',
       lt.id, '2026-02-24', '2026-02-28', 50.0,
       'Medical procedure recovery', 'approved',
       '00000000-0000-0000-0000-00000000000c'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'fmla_sick';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001107', '2026-02-24', 10.0),
    ('00000000-0000-0000-0000-000000001107', '2026-02-25', 10.0),
    ('00000000-0000-0000-0000-000000001107', '2026-02-26', 10.0),
    ('00000000-0000-0000-0000-000000001107', '2026-02-27', 10.0),
    ('00000000-0000-0000-0000-000000001107', '2026-02-28', 10.0);

-- ── OT Queue Positions ───────────────────────────────────────────────────

INSERT INTO ot_queue_positions (org_id, classification_id, user_id, fiscal_year, last_ot_event_at)
SELECT
    '00000000-0000-0000-0000-000000000a01',
    u.classification_id,
    u.id,
    2026,
    CASE
        WHEN u.hire_date < '2018-01-01' THEN '2026-01-15 08:00:00-08'::TIMESTAMPTZ + (ROW_NUMBER() OVER (ORDER BY u.hire_date) * INTERVAL '2 hours')
        WHEN u.hire_date < '2021-01-01' THEN '2026-02-01 08:00:00-08'::TIMESTAMPTZ + (ROW_NUMBER() OVER (ORDER BY u.hire_date) * INTERVAL '3 hours')
        ELSE NULL
    END
FROM users u
WHERE u.org_id = '00000000-0000-0000-0000-000000000a01'
  AND u.is_active = true
  AND u.classification_id IN ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02');

-- ── Schedule Annotations ─────────────────────────────────────────────────

INSERT INTO schedule_annotations (org_id, date, content, annotation_type, created_by) VALUES
    ('00000000-0000-0000-0000-000000000a01', '2026-02-16', 'Presidents'' Day — premium pay in effect', 'holiday', '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-000000000a01', '2026-02-20', 'Minimum staffing alert: 2 approved off on Team 3', 'alert', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000a01', '2026-03-03', 'Annual CPR/first-aid recertification — Team 1 & 2 morning', 'note', '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-000000000a01', '2026-03-10', 'New CAD system training — all teams, staggered shifts', 'note', '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-000000000a01', '2026-03-17', 'St. Patrick''s Day — expect increased call volume downtown', 'alert', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000a01', '2026-02-24', 'James Rivera on FMLA — OT coverage needed', 'alert', '00000000-0000-0000-0000-000000000001');

-- ── OT Requests ──────────────────────────────────────────────────────────

-- Team 4 understaffed: example vacancy OT requests
INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE, '12:00', '22:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 4', true,
       'Need COII coverage 12-22 slot', 'open'::ot_request_status,
       '00000000-0000-0000-0000-00000000001f'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'vacancy';

INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE, '14:00', '00:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 4', true,
       'Need COII coverage 14-24 slot', 'open'::ot_request_status,
       '00000000-0000-0000-0000-00000000001f'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'vacancy';

INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001203', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE, '18:00', '04:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 4', true,
       'Need COII coverage 18-04 slot', 'open'::ot_request_status,
       '00000000-0000-0000-0000-00000000001f'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'vacancy';

INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001204', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE, '22:00', '08:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 4', true,
       'Need COII coverage 22-08 slot', 'open'::ot_request_status,
       '00000000-0000-0000-0000-00000000001f'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'vacancy';

-- FMLA coverage OT (Team 2, tomorrow + day after)
INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001205', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE + 1, '12:00', '22:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 2', true,
       'Covering James Rivera FMLA — 12-22 slot', 'open'::ot_request_status,
       '00000000-0000-0000-0000-00000000000c'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'fmla_coverage';

INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001206', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE + 2, '12:00', '22:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 2', true,
       'Covering James Rivera FMLA — 12-22 slot', 'open'::ot_request_status,
       '00000000-0000-0000-0000-00000000000c'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'fmla_coverage';

-- Extra staffing for high call volume (next Saturday)
INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001207', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INT + 7)::INT % 7,
       '12:00', '22:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Any team',
       'Extra staffing for anticipated high call volume this weekend', 'open'::ot_request_status,
       '00000000-0000-0000-0000-0000000000a1'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'high_call_volume';

-- Volunteers
INSERT INTO ot_request_volunteers (ot_request_id, user_id) VALUES
    ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000001205', '00000000-0000-0000-0000-000000000005'),
    ('00000000-0000-0000-0000-000000001205', '00000000-0000-0000-0000-000000000006');

-- ── OT Hours Tracking ────────────────────────────────────────────────────

INSERT INTO ot_hours (user_id, classification_id, fiscal_year, hours_worked, hours_declined, updated_at)
SELECT
    u.id,
    u.classification_id,
    2026,
    CASE
        WHEN u.hire_date < '2016-01-01' THEN 24.0 + (RANDOM() * 16)::NUMERIC(8,2)
        WHEN u.hire_date < '2020-01-01' THEN 12.0 + (RANDOM() * 12)::NUMERIC(8,2)
        WHEN u.hire_date < '2023-01-01' THEN 4.0 + (RANDOM() * 8)::NUMERIC(8,2)
        ELSE 0.0
    END,
    CASE
        WHEN u.hire_date < '2018-01-01' THEN (RANDOM() * 10)::NUMERIC(8,2)
        ELSE 0.0
    END,
    NOW()
FROM users u
WHERE u.org_id = '00000000-0000-0000-0000-000000000a01'
  AND u.is_active = true
  AND u.classification_id IN ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02');

COMMIT;
