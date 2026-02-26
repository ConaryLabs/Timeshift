-- Valleycom seed data
-- Run after migrations: make seed

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

-- Supervisor
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit, phone) VALUES
    ('00000000-0000-0000-0000-0000000000a2',
     '00000000-0000-0000-0000-000000000a01',
     'SUP001', 'Sarah', 'Chen',
     'sarah.chen@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor',
     '00000000-0000-0000-0000-000000000c03',
     '2012-03-15', 'vcsg', '253-555-0102');

-- Employees
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit, phone) VALUES
    ('00000000-0000-0000-0000-0000000000a3',
     '00000000-0000-0000-0000-000000000a01',
     'EMP001', 'Mike', 'Johnson',
     'mike.johnson@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee',
     '00000000-0000-0000-0000-000000000c02',
     '2018-06-01', 'vccea', '253-555-0201'),
    ('00000000-0000-0000-0000-0000000000a4',
     '00000000-0000-0000-0000-000000000a01',
     'EMP002', 'Lisa', 'Park',
     'lisa.park@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee',
     '00000000-0000-0000-0000-000000000c01',
     '2021-09-12', 'vccea', '253-555-0202'),
    ('00000000-0000-0000-0000-0000000000a5',
     '00000000-0000-0000-0000-000000000a01',
     'EMP003', 'James', 'Rivera',
     'james.rivera@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee',
     '00000000-0000-0000-0000-000000000c02',
     '2015-11-20', 'vccea', '253-555-0203');

-- Seniority records for all users
INSERT INTO seniority_records (user_id, org_id, overall_seniority_date, bargaining_unit_seniority_date, classification_seniority_date) VALUES
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000a01', '2000-01-01', NULL, '2000-01-01'),
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000a01', '2012-03-15', '2012-03-15', '2016-08-01'),
    ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000a01', '2018-06-01', '2018-06-01', '2018-06-01'),
    ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000a01', '2021-09-12', '2021-09-12', '2021-09-12'),
    ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000a01', '2015-11-20', '2015-11-20', '2015-11-20');

-- ── Shift Templates ─────────────────────────────────────────────────────────
-- 10 Valleycom time patterns

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
    ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000a01', '22-0800', '22:00', '08:00', true,  600, '#00BCD4');

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
-- Representative slots for each team based on March 2026 schedule data.
-- Team 1: 9 slots (typical pattern)

-- Team 1 slots
INSERT INTO shift_slots (team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    -- COII dispatchers
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T1 COII 04-14 FSS'),
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T1 COII 06-16 FSS'),
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T1 COII 08-18 FSS'),
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T1 COII 12-22 FSS'),
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T1 COII 14-24 FSS'),
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T1 COII 18-04 FSS'),
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{0,5,6}', 'T1 COII 22-08 FSS'),
    -- COI slots
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{0,5,6}', 'T1 COI 08-18 FSS'),
    -- Supervisor slot
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{0,5,6}', 'T1 SUP 08-18 FSS');

-- Team 2 slots (different day pattern)
INSERT INTO shift_slots (team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T2 COII 04-14 MTW'),
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T2 COII 06-16 MTW'),
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T2 COII 08-18 MTW'),
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T2 COII 12-22 MTW'),
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T2 COII 14-24 MTW'),
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T2 COII 18-04 MTW'),
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{1,2,3}', 'T2 COII 22-08 MTW'),
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{1,2,3}', 'T2 COI 08-18 MTW'),
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{1,2,3}', 'T2 SUP 08-18 MTW');

-- Team 3 slots
INSERT INTO shift_slots (team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T3 COII 04-14 WTF'),
    ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T3 COII 06-16 WTF'),
    ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T3 COII 08-18 WTF'),
    ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T3 COII 12-22 WTF'),
    ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T3 COII 14-24 WTF'),
    ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T3 COII 18-04 WTF'),
    ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{3,4,5}', 'T3 COII 22-08 WTF'),
    ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{3,4,5}', 'T3 COI 08-18 WTF'),
    ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{3,4,5}', 'T3 SUP 08-18 WTF');

-- Teams 4-10 follow similar patterns (abbreviated — 9 slots each with rotating day patterns)
-- Team 4
INSERT INTO shift_slots (team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{0,1,4}', 'T4 COII 04-14 SMF'),
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c02', '{0,1,4}', 'T4 COII 06-16 SMF'),
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{0,1,4}', 'T4 COII 08-18 SMF'),
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{0,1,4}', 'T4 COII 12-22 SMF'),
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{0,1,4}', 'T4 COII 14-24 SMF'),
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{0,1,4}', 'T4 COII 18-04 SMF'),
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{0,1,4}', 'T4 COII 22-08 SMF'),
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{0,1,4}', 'T4 COI 08-18 SMF'),
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{0,1,4}', 'T4 SUP 08-18 SMF');

-- Team 5
INSERT INTO shift_slots (team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{2,3,6}', 'T5 COII 04-14 TWS'),
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c02', '{2,3,6}', 'T5 COII 06-16 TWS'),
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{2,3,6}', 'T5 COII 08-18 TWS'),
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{2,3,6}', 'T5 COII 12-22 TWS'),
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{2,3,6}', 'T5 COII 14-24 TWS'),
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{2,3,6}', 'T5 COII 18-04 TWS'),
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{2,3,6}', 'T5 COII 22-08 TWS'),
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{2,3,6}', 'T5 COI 08-18 TWS'),
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{2,3,6}', 'T5 SUP 08-18 TWS');

-- Team 6
INSERT INTO shift_slots (team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{0,4,5}', 'T6 COII 04-14 SFS'),
    ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c02', '{0,4,5}', 'T6 COII 06-16 SFS'),
    ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{0,4,5}', 'T6 COII 08-18 SFS'),
    ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{0,4,5}', 'T6 COII 12-22 SFS'),
    ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{0,4,5}', 'T6 COII 14-24 SFS'),
    ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{0,4,5}', 'T6 COII 18-04 SFS'),
    ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{0,4,5}', 'T6 COII 22-08 SFS'),
    ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{0,4,5}', 'T6 COI 08-18 SFS'),
    ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{0,4,5}', 'T6 SUP 08-18 SFS');

-- Team 7
INSERT INTO shift_slots (team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{1,2,6}', 'T7 COII 04-14 MTS'),
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c02', '{1,2,6}', 'T7 COII 06-16 MTS'),
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{1,2,6}', 'T7 COII 08-18 MTS'),
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{1,2,6}', 'T7 COII 12-22 MTS'),
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{1,2,6}', 'T7 COII 14-24 MTS'),
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{1,2,6}', 'T7 COII 18-04 MTS'),
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{1,2,6}', 'T7 COII 22-08 MTS'),
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{1,2,6}', 'T7 COI 08-18 MTS'),
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{1,2,6}', 'T7 SUP 08-18 MTS');

-- Team 8
INSERT INTO shift_slots (team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{0,3,4}', 'T8 COII 04-14 SWT'),
    ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c02', '{0,3,4}', 'T8 COII 06-16 SWT'),
    ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{0,3,4}', 'T8 COII 08-18 SWT'),
    ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{0,3,4}', 'T8 COII 12-22 SWT'),
    ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{0,3,4}', 'T8 COII 14-24 SWT'),
    ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{0,3,4}', 'T8 COII 18-04 SWT'),
    ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{0,3,4}', 'T8 COII 22-08 SWT'),
    ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{0,3,4}', 'T8 COI 08-18 SWT'),
    ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{0,3,4}', 'T8 SUP 08-18 SWT');

-- Team 9
INSERT INTO shift_slots (team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{1,5,6}', 'T9 COII 04-14 MFS'),
    ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c02', '{1,5,6}', 'T9 COII 06-16 MFS'),
    ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{1,5,6}', 'T9 COII 08-18 MFS'),
    ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{1,5,6}', 'T9 COII 12-22 MFS'),
    ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{1,5,6}', 'T9 COII 14-24 MFS'),
    ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{1,5,6}', 'T9 COII 18-04 MFS'),
    ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{1,5,6}', 'T9 COII 22-08 MFS'),
    ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{1,5,6}', 'T9 COI 08-18 MFS'),
    ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{1,5,6}', 'T9 SUP 08-18 MFS');

-- Team 10
INSERT INTO shift_slots (team_id, shift_template_id, classification_id, days_of_week, label) VALUES
    ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c02', '{2,4,6}', 'T10 COII 04-14 WFS'),
    ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c02', '{2,4,6}', 'T10 COII 06-16 WFS'),
    ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c02', '{2,4,6}', 'T10 COII 08-18 WFS'),
    ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000c02', '{2,4,6}', 'T10 COII 12-22 WFS'),
    ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000c02', '{2,4,6}', 'T10 COII 14-24 WFS'),
    ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000c02', '{2,4,6}', 'T10 COII 18-04 WFS'),
    ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000c02', '{2,4,6}', 'T10 COII 22-08 WFS'),
    ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c01', '{2,4,6}', 'T10 COI 08-18 WFS'),
    ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000c03', '{2,4,6}', 'T10 SUP 08-18 WFS');

-- ── Accrual Schedules ─────────────────────────────────────────────────────
-- Vacation accrual per VCCEA contract: YOS-tiered, biweekly (26 pay periods/year)
-- VCCEA regular full-time employees
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

-- VCSG vacation (supervisors)
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

-- Sick leave accrual: same for all BUs, 3.69 hrs/period (96 hrs/year), no max
INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vccea', 0, NULL, 3.69, NULL, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'sick';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vcsg', 0, NULL, 3.69, NULL, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'sick';

-- Holiday accrual: 3.69 hrs/period (96 hrs/year) for VCCEA, same for VCSG
INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vccea', 0, NULL, 3.69, 96, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'holiday';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vcsg', 0, NULL, 3.69, 96, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'holiday';

-- Comp time accrual: 1.54 hrs/period (40 hrs/year), 40 hr max
INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vccea', 0, NULL, 1.54, 40, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'comp_time';

INSERT INTO accrual_schedules (org_id, leave_type_id, employee_type, bargaining_unit, years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
SELECT '00000000-0000-0000-0000-000000000a01', lt.id, 'regular_full_time', 'vcsg', 0, NULL, 1.54, 40, '2025-01-01'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'comp_time';

-- ── Additional Employees ──────────────────────────────────────────────────
-- 28 more employees to realistically staff Teams 1-4
-- All passwords: "admin123" (same argon2 hash)

-- Team 1: 5 more COII (joining Sarah Chen SUP, Mike Johnson COII, Lisa Park COI, James Rivera COII)
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000e01',
     '00000000-0000-0000-0000-000000000a01',
     'EMP004', 'Tom', 'Baker',
     'tom.baker@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2019-03-15', 'vccea'),
    ('00000000-0000-0000-0000-000000000e02',
     '00000000-0000-0000-0000-000000000a01',
     'EMP005', 'Rachel', 'Kim',
     'rachel.kim@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2020-07-01', 'vccea'),
    ('00000000-0000-0000-0000-000000000e03',
     '00000000-0000-0000-0000-000000000a01',
     'EMP006', 'David', 'Okonkwo',
     'david.okonkwo@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2022-01-10', 'vccea'),
    ('00000000-0000-0000-0000-000000000e04',
     '00000000-0000-0000-0000-000000000a01',
     'EMP007', 'Maria', 'Santos',
     'maria.santos@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2017-05-22', 'vccea'),
    ('00000000-0000-0000-0000-000000000e05',
     '00000000-0000-0000-0000-000000000a01',
     'EMP008', 'Kevin', 'Wright',
     'kevin.wright@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2023-06-15', 'vccea');

-- Team 2: 1 supervisor + 7 COII + 1 COI
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000e06',
     '00000000-0000-0000-0000-000000000a01',
     'SUP002', 'Brian', 'Torres',
     'brian.torres@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2014-08-01', 'vcsg'),
    ('00000000-0000-0000-0000-000000000e07',
     '00000000-0000-0000-0000-000000000a01',
     'EMP009', 'Amy', 'Patel',
     'amy.patel@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2016-02-14', 'vccea'),
    ('00000000-0000-0000-0000-000000000e08',
     '00000000-0000-0000-0000-000000000a01',
     'EMP010', 'Nathan', 'Cooper',
     'nathan.cooper@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2019-09-01', 'vccea'),
    ('00000000-0000-0000-0000-000000000e09',
     '00000000-0000-0000-0000-000000000a01',
     'EMP011', 'Jennifer', 'Morales',
     'jennifer.morales@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2020-04-15', 'vccea'),
    ('00000000-0000-0000-0000-000000000e0a',
     '00000000-0000-0000-0000-000000000a01',
     'EMP012', 'Chris', 'Nakamura',
     'chris.nakamura@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2021-01-05', 'vccea'),
    ('00000000-0000-0000-0000-000000000e0b',
     '00000000-0000-0000-0000-000000000a01',
     'EMP013', 'Diana', 'Reed',
     'diana.reed@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2018-06-20', 'vccea'),
    ('00000000-0000-0000-0000-000000000e0c',
     '00000000-0000-0000-0000-000000000a01',
     'EMP014', 'Marcus', 'Bell',
     'marcus.bell@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2022-03-01', 'vccea'),
    ('00000000-0000-0000-0000-000000000e0d',
     '00000000-0000-0000-0000-000000000a01',
     'EMP015', 'Olivia', 'Green',
     'olivia.green@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2023-08-12', 'vccea'),
    ('00000000-0000-0000-0000-000000000e0e',
     '00000000-0000-0000-0000-000000000a01',
     'EMP016', 'Priya', 'Sharma',
     'priya.sharma@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2024-01-15', 'vccea');

-- Team 3: 1 supervisor + 7 COII + 1 COI
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000e0f',
     '00000000-0000-0000-0000-000000000a01',
     'SUP003', 'Robert', 'Huang',
     'robert.huang@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2011-04-01', 'vcsg'),
    ('00000000-0000-0000-0000-000000000e10',
     '00000000-0000-0000-0000-000000000a01',
     'EMP017', 'Stephanie', 'Walsh',
     'stephanie.walsh@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2015-10-05', 'vccea'),
    ('00000000-0000-0000-0000-000000000e11',
     '00000000-0000-0000-0000-000000000a01',
     'EMP018', 'Brandon', 'Lee',
     'brandon.lee@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2017-02-20', 'vccea'),
    ('00000000-0000-0000-0000-000000000e12',
     '00000000-0000-0000-0000-000000000a01',
     'EMP019', 'Michelle', 'Foster',
     'michelle.foster@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2019-11-01', 'vccea'),
    ('00000000-0000-0000-0000-000000000e13',
     '00000000-0000-0000-0000-000000000a01',
     'EMP020', 'Tyler', 'Brooks',
     'tyler.brooks@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2020-08-15', 'vccea'),
    ('00000000-0000-0000-0000-000000000e14',
     '00000000-0000-0000-0000-000000000a01',
     'EMP021', 'Aisha', 'Williams',
     'aisha.williams@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2021-03-22', 'vccea'),
    ('00000000-0000-0000-0000-000000000e15',
     '00000000-0000-0000-0000-000000000a01',
     'EMP022', 'Jordan', 'Hayes',
     'jordan.hayes@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2022-07-10', 'vccea'),
    ('00000000-0000-0000-0000-000000000e16',
     '00000000-0000-0000-0000-000000000a01',
     'EMP023', 'Vanessa', 'Cruz',
     'vanessa.cruz@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2024-02-01', 'vccea'),
    ('00000000-0000-0000-0000-000000000e17',
     '00000000-0000-0000-0000-000000000a01',
     'EMP024', 'Derek', 'Nguyen',
     'derek.nguyen@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2023-05-15', 'vccea');

-- Team 4: 1 supervisor + 3 COII + 1 COI (partial staff)
INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, password_hash, role, classification_id, hire_date, bargaining_unit) VALUES
    ('00000000-0000-0000-0000-000000000e18',
     '00000000-0000-0000-0000-000000000a01',
     'SUP004', 'Karen', 'Mitchell',
     'karen.mitchell@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'supervisor', '00000000-0000-0000-0000-000000000c03', '2013-09-01', 'vcsg'),
    ('00000000-0000-0000-0000-000000000e19',
     '00000000-0000-0000-0000-000000000a01',
     'EMP025', 'Ryan', 'Hoffman',
     'ryan.hoffman@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2016-06-01', 'vccea'),
    ('00000000-0000-0000-0000-000000000e1a',
     '00000000-0000-0000-0000-000000000a01',
     'EMP026', 'Tanya', 'Edwards',
     'tanya.edwards@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2020-03-15', 'vccea'),
    ('00000000-0000-0000-0000-000000000e1b',
     '00000000-0000-0000-0000-000000000a01',
     'EMP027', 'Alex', 'Petrov',
     'alex.petrov@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c02', '2021-09-01', 'vccea'),
    ('00000000-0000-0000-0000-000000000e1c',
     '00000000-0000-0000-0000-000000000a01',
     'EMP028', 'Nicole', 'Chang',
     'nicole.chang@valleycom.org',
     '$argon2id$v=19$m=16384,t=2,p=1$Tjhna0VCVjZiZlgzU093enNHeUd6dz09$ddNxIoJtYXDHVy2x+ySbZwoZwUCYOwNovyZZn6c0l7g',
     'employee', '00000000-0000-0000-0000-000000000c01', '2024-05-01', 'vccea');

-- Seniority records for all new employees
INSERT INTO seniority_records (user_id, org_id, overall_seniority_date, bargaining_unit_seniority_date, classification_seniority_date) VALUES
    -- Team 1
    ('00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-000000000a01', '2019-03-15', '2019-03-15', '2019-03-15'),
    ('00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-000000000a01', '2020-07-01', '2020-07-01', '2020-07-01'),
    ('00000000-0000-0000-0000-000000000e03', '00000000-0000-0000-0000-000000000a01', '2022-01-10', '2022-01-10', '2022-01-10'),
    ('00000000-0000-0000-0000-000000000e04', '00000000-0000-0000-0000-000000000a01', '2017-05-22', '2017-05-22', '2017-05-22'),
    ('00000000-0000-0000-0000-000000000e05', '00000000-0000-0000-0000-000000000a01', '2023-06-15', '2023-06-15', '2023-06-15'),
    -- Team 2
    ('00000000-0000-0000-0000-000000000e06', '00000000-0000-0000-0000-000000000a01', '2014-08-01', '2014-08-01', '2018-01-01'),
    ('00000000-0000-0000-0000-000000000e07', '00000000-0000-0000-0000-000000000a01', '2016-02-14', '2016-02-14', '2016-02-14'),
    ('00000000-0000-0000-0000-000000000e08', '00000000-0000-0000-0000-000000000a01', '2019-09-01', '2019-09-01', '2019-09-01'),
    ('00000000-0000-0000-0000-000000000e09', '00000000-0000-0000-0000-000000000a01', '2020-04-15', '2020-04-15', '2020-04-15'),
    ('00000000-0000-0000-0000-000000000e0a', '00000000-0000-0000-0000-000000000a01', '2021-01-05', '2021-01-05', '2021-01-05'),
    ('00000000-0000-0000-0000-000000000e0b', '00000000-0000-0000-0000-000000000a01', '2018-06-20', '2018-06-20', '2018-06-20'),
    ('00000000-0000-0000-0000-000000000e0c', '00000000-0000-0000-0000-000000000a01', '2022-03-01', '2022-03-01', '2022-03-01'),
    ('00000000-0000-0000-0000-000000000e0d', '00000000-0000-0000-0000-000000000a01', '2023-08-12', '2023-08-12', '2023-08-12'),
    ('00000000-0000-0000-0000-000000000e0e', '00000000-0000-0000-0000-000000000a01', '2024-01-15', '2024-01-15', '2024-01-15'),
    -- Team 3
    ('00000000-0000-0000-0000-000000000e0f', '00000000-0000-0000-0000-000000000a01', '2011-04-01', '2011-04-01', '2015-06-01'),
    ('00000000-0000-0000-0000-000000000e10', '00000000-0000-0000-0000-000000000a01', '2015-10-05', '2015-10-05', '2015-10-05'),
    ('00000000-0000-0000-0000-000000000e11', '00000000-0000-0000-0000-000000000a01', '2017-02-20', '2017-02-20', '2017-02-20'),
    ('00000000-0000-0000-0000-000000000e12', '00000000-0000-0000-0000-000000000a01', '2019-11-01', '2019-11-01', '2019-11-01'),
    ('00000000-0000-0000-0000-000000000e13', '00000000-0000-0000-0000-000000000a01', '2020-08-15', '2020-08-15', '2020-08-15'),
    ('00000000-0000-0000-0000-000000000e14', '00000000-0000-0000-0000-000000000a01', '2021-03-22', '2021-03-22', '2021-03-22'),
    ('00000000-0000-0000-0000-000000000e15', '00000000-0000-0000-0000-000000000a01', '2022-07-10', '2022-07-10', '2022-07-10'),
    ('00000000-0000-0000-0000-000000000e16', '00000000-0000-0000-0000-000000000a01', '2024-02-01', '2024-02-01', '2024-02-01'),
    ('00000000-0000-0000-0000-000000000e17', '00000000-0000-0000-0000-000000000a01', '2023-05-15', '2023-05-15', '2023-05-15'),
    -- Team 4
    ('00000000-0000-0000-0000-000000000e18', '00000000-0000-0000-0000-000000000a01', '2013-09-01', '2013-09-01', '2017-03-01'),
    ('00000000-0000-0000-0000-000000000e19', '00000000-0000-0000-0000-000000000a01', '2016-06-01', '2016-06-01', '2016-06-01'),
    ('00000000-0000-0000-0000-000000000e1a', '00000000-0000-0000-0000-000000000a01', '2020-03-15', '2020-03-15', '2020-03-15'),
    ('00000000-0000-0000-0000-000000000e1b', '00000000-0000-0000-0000-000000000a01', '2021-09-01', '2021-09-01', '2021-09-01'),
    ('00000000-0000-0000-0000-000000000e1c', '00000000-0000-0000-0000-000000000a01', '2024-05-01', '2024-05-01', '2024-05-01');

-- ── Schedule Period ───────────────────────────────────────────────────────
-- Current active schedule (Q1 2026, bidding completed)

INSERT INTO schedule_periods (id, org_id, name, start_date, end_date, is_active, status) VALUES
    ('00000000-0000-0000-0000-000000000f01',
     '00000000-0000-0000-0000-000000000a01',
     '2026 Q1 Bid Schedule', '2026-01-01', '2026-03-31', true, 'completed');

-- ── Slot Assignments ──────────────────────────────────────────────────────
-- Assign employees to their team shift slots for the current schedule period
-- Uses subquery joins since shift_slots have auto-generated IDs

-- Team 1: full staff (9 people → 9 slots)
INSERT INTO slot_assignments (slot_id, user_id, period_id)
SELECT ss.id, v.user_id::UUID, '00000000-0000-0000-0000-000000000f01'
FROM (VALUES
    ('00000000-0000-0000-0000-0000000000b1'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-0000000000a3'),  -- Mike Johnson → COII 04-14
    ('00000000-0000-0000-0000-0000000000b2'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-0000000000a5'),  -- James Rivera → COII 06-16
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e01'),  -- Tom Baker → COII 08-18
    ('00000000-0000-0000-0000-0000000000b5'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e02'),  -- Rachel Kim → COII 12-22
    ('00000000-0000-0000-0000-0000000000b7'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e03'),  -- David Okonkwo → COII 14-24
    ('00000000-0000-0000-0000-0000000000b9'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e04'),  -- Maria Santos → COII 18-04
    ('00000000-0000-0000-0000-0000000000ba'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e05'),  -- Kevin Wright → COII 22-08
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c01'::UUID, '00000000-0000-0000-0000-0000000000a4'),  -- Lisa Park → COI 08-18
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c03'::UUID, '00000000-0000-0000-0000-0000000000a2')   -- Sarah Chen → SUP 08-18
) AS v(template_id, class_id, user_id)
JOIN shift_slots ss ON ss.team_id = '00000000-0000-0000-0000-0000000000d1'
    AND ss.shift_template_id = v.template_id
    AND ss.classification_id = v.class_id;

-- Team 2: full staff
INSERT INTO slot_assignments (slot_id, user_id, period_id)
SELECT ss.id, v.user_id::UUID, '00000000-0000-0000-0000-000000000f01'
FROM (VALUES
    ('00000000-0000-0000-0000-0000000000b1'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e07'),  -- Amy Patel → COII 04-14
    ('00000000-0000-0000-0000-0000000000b2'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e08'),  -- Nathan Cooper → COII 06-16
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e09'),  -- Jennifer Morales → COII 08-18
    ('00000000-0000-0000-0000-0000000000b5'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e0a'),  -- Chris Nakamura → COII 12-22
    ('00000000-0000-0000-0000-0000000000b7'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e0b'),  -- Diana Reed → COII 14-24
    ('00000000-0000-0000-0000-0000000000b9'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e0c'),  -- Marcus Bell → COII 18-04
    ('00000000-0000-0000-0000-0000000000ba'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e0d'),  -- Olivia Green → COII 22-08
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c01'::UUID, '00000000-0000-0000-0000-000000000e0e'),  -- Priya Sharma → COI 08-18
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c03'::UUID, '00000000-0000-0000-0000-000000000e06')   -- Brian Torres → SUP 08-18
) AS v(template_id, class_id, user_id)
JOIN shift_slots ss ON ss.team_id = '00000000-0000-0000-0000-0000000000d2'
    AND ss.shift_template_id = v.template_id
    AND ss.classification_id = v.class_id;

-- Team 3: full staff
INSERT INTO slot_assignments (slot_id, user_id, period_id)
SELECT ss.id, v.user_id::UUID, '00000000-0000-0000-0000-000000000f01'
FROM (VALUES
    ('00000000-0000-0000-0000-0000000000b1'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e10'),  -- Stephanie Walsh → COII 04-14
    ('00000000-0000-0000-0000-0000000000b2'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e11'),  -- Brandon Lee → COII 06-16
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e12'),  -- Michelle Foster → COII 08-18
    ('00000000-0000-0000-0000-0000000000b5'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e13'),  -- Tyler Brooks → COII 12-22
    ('00000000-0000-0000-0000-0000000000b7'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e14'),  -- Aisha Williams → COII 14-24
    ('00000000-0000-0000-0000-0000000000b9'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e15'),  -- Jordan Hayes → COII 18-04
    ('00000000-0000-0000-0000-0000000000ba'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e16'),  -- Vanessa Cruz → COII 22-08
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c01'::UUID, '00000000-0000-0000-0000-000000000e17'),  -- Derek Nguyen → COI 08-18
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c03'::UUID, '00000000-0000-0000-0000-000000000e0f')   -- Robert Huang → SUP 08-18
) AS v(template_id, class_id, user_id)
JOIN shift_slots ss ON ss.team_id = '00000000-0000-0000-0000-0000000000d3'
    AND ss.shift_template_id = v.template_id
    AND ss.classification_id = v.class_id;

-- Team 4: partial staff (5 of 9 slots)
INSERT INTO slot_assignments (slot_id, user_id, period_id)
SELECT ss.id, v.user_id::UUID, '00000000-0000-0000-0000-000000000f01'
FROM (VALUES
    ('00000000-0000-0000-0000-0000000000b1'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e19'),  -- Ryan Hoffman → COII 04-14
    ('00000000-0000-0000-0000-0000000000b2'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e1a'),  -- Tanya Edwards → COII 06-16
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c02'::UUID, '00000000-0000-0000-0000-000000000e1b'),  -- Alex Petrov → COII 08-18
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c01'::UUID, '00000000-0000-0000-0000-000000000e1c'),  -- Nicole Chang → COI 08-18
    ('00000000-0000-0000-0000-0000000000b4'::UUID, '00000000-0000-0000-0000-000000000c03'::UUID, '00000000-0000-0000-0000-000000000e18')   -- Karen Mitchell → SUP 08-18
) AS v(template_id, class_id, user_id)
JOIN shift_slots ss ON ss.team_id = '00000000-0000-0000-0000-0000000000d4'
    AND ss.shift_template_id = v.template_id
    AND ss.classification_id = v.class_id;

-- ── Leave Balances ────────────────────────────────────────────────────────
-- Give all non-admin employees realistic balances based on tenure
-- Vacation: ~30 hrs/year of service + 40 baseline, capped at 240
-- Sick: ~80 hrs/year of service + 40, capped at 960
-- Holiday: 48 hrs (mid-year accrual)
-- Comp: 15 hrs

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
-- Generate concrete shift instances for Teams 1-4 across Feb-Mar 2026
-- Each shift_slot becomes a scheduled_shift on every matching day-of-week

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
    '00000000-0000-0000-0000-0000000000d4'
)
AND EXTRACT(DOW FROM d.date)::INT = ANY(ss.days_of_week);

-- ── Assignments ──────────────────────────────────────────────────────────
-- Link users to their scheduled shifts based on slot_assignments
-- This gives every employee their regular shift on every working day

INSERT INTO assignments (scheduled_shift_id, user_id, created_by)
SELECT
    sched.id,
    sa.user_id,
    '00000000-0000-0000-0000-0000000000a1'   -- admin as created_by
FROM scheduled_shifts sched
JOIN shift_slots ss ON sched.slot_id = ss.id
JOIN slot_assignments sa ON sa.slot_id = ss.id
    AND sa.period_id = '00000000-0000-0000-0000-000000000f01'
WHERE ss.team_id IN (
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d4'
);

-- ── Coverage Plan ────────────────────────────────────────────────────────
-- Default 24/7 coverage plan for a 911 center

INSERT INTO coverage_plans (id, org_id, name, description, is_default, is_active, created_by)
VALUES (
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000000a01',
    'Standard 24/7 Coverage',
    'Default staffing requirements for 24-hour dispatch operations',
    true, true,
    '00000000-0000-0000-0000-0000000000a1'
);

-- COII coverage: higher staffing during day (06:00-22:00), lower at night
-- Day slots (indices 12-43 = 06:00-21:30): min=3, target=5, max=7
-- Night slots (indices 0-11, 44-47 = 00:00-05:30, 22:00-23:30): min=2, target=3, max=5
INSERT INTO coverage_plan_slots (plan_id, classification_id, day_of_week, slot_index, min_headcount, target_headcount, max_headcount)
SELECT
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000000c02',  -- COII
    dow.d,
    slot.s,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 3 ELSE 2 END,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 5 ELSE 3 END,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 7 ELSE 5 END
FROM generate_series(0, 6) AS dow(d)
CROSS JOIN generate_series(0, 47) AS slot(s);

-- COI coverage: 1 during day, optional at night
INSERT INTO coverage_plan_slots (plan_id, classification_id, day_of_week, slot_index, min_headcount, target_headcount, max_headcount)
SELECT
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000000c01',  -- COI
    dow.d,
    slot.s,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 1 ELSE 0 END,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 1 ELSE 1 END,
    2
FROM generate_series(0, 6) AS dow(d)
CROSS JOIN generate_series(0, 47) AS slot(s);

-- Supervisor coverage: 1 required during day
INSERT INTO coverage_plan_slots (plan_id, classification_id, day_of_week, slot_index, min_headcount, target_headcount, max_headcount)
SELECT
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000000c03',  -- SUP
    dow.d,
    slot.s,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 1 ELSE 0 END,
    CASE WHEN slot.s BETWEEN 12 AND 43 THEN 1 ELSE 1 END,
    2
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
-- 2026 federal holidays (911 centers work all holidays — premium pay applies)

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
-- Sample requests in various statuses to populate the leave management views

-- Mike Johnson: approved 3-day vacation (Feb 15-17)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, reason, status, reviewed_by)
SELECT '00000000-0000-0000-0000-000000001101',
       '00000000-0000-0000-0000-000000000a01',
       '00000000-0000-0000-0000-0000000000a3',
       lt.id, '2026-02-15', '2026-02-17', 30.0,
       'Family trip to Portland', 'approved',
       '00000000-0000-0000-0000-0000000000a2'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001101', '2026-02-15', 10.0),
    ('00000000-0000-0000-0000-000000001101', '2026-02-16', 10.0),
    ('00000000-0000-0000-0000-000000001101', '2026-02-17', 10.0);

-- Rachel Kim: pending vacation request (Mar 10-12)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, reason, status)
SELECT '00000000-0000-0000-0000-000000001102',
       '00000000-0000-0000-0000-000000000a01',
       '00000000-0000-0000-0000-000000000e02',
       lt.id, '2026-03-10', '2026-03-12', 30.0,
       'Spring break with kids', 'pending'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'posted_vacation';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001102', '2026-03-10', 10.0),
    ('00000000-0000-0000-0000-000000001102', '2026-03-11', 10.0),
    ('00000000-0000-0000-0000-000000001102', '2026-03-12', 10.0);

-- Amy Patel: approved holiday use on Presidents' Day
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, status, reviewed_by)
SELECT '00000000-0000-0000-0000-000000001103',
       '00000000-0000-0000-0000-000000000a01',
       '00000000-0000-0000-0000-000000000e07',
       lt.id, '2026-02-16', '2026-02-16', 10.0,
       'approved', '00000000-0000-0000-0000-000000000e06'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'holiday';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001103', '2026-02-16', 10.0);

-- Brandon Lee: approved sick day (Feb 5)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, status, reviewed_by)
SELECT '00000000-0000-0000-0000-000000001104',
       '00000000-0000-0000-0000-000000000a01',
       '00000000-0000-0000-0000-000000000e11',
       lt.id, '2026-02-05', '2026-02-05', 10.0,
       'approved', '00000000-0000-0000-0000-000000000e0f'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'sick';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001104', '2026-02-05', 10.0);

-- Stephanie Walsh: denied vacation (Feb 20-22, coverage shortage)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, reason, status, reviewed_by, reviewer_notes)
SELECT '00000000-0000-0000-0000-000000001105',
       '00000000-0000-0000-0000-000000000a01',
       '00000000-0000-0000-0000-000000000e10',
       lt.id, '2026-02-20', '2026-02-22', 30.0,
       'Weekend getaway', 'denied',
       '00000000-0000-0000-0000-000000000e0f',
       'Insufficient coverage — two others already approved off this weekend'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'bid_vacation';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001105', '2026-02-20', 10.0),
    ('00000000-0000-0000-0000-000000001105', '2026-02-21', 10.0),
    ('00000000-0000-0000-0000-000000001105', '2026-02-22', 10.0);

-- Tyler Brooks: pending comp time use (Mar 2)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, reason, status)
SELECT '00000000-0000-0000-0000-000000001106',
       '00000000-0000-0000-0000-000000000a01',
       '00000000-0000-0000-0000-000000000e13',
       lt.id, '2026-03-02', '2026-03-02', 10.0,
       'Personal appointment', 'pending'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'comp_time';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001106', '2026-03-02', 10.0);

-- Maria Santos: approved FMLA (Feb 24-28)
INSERT INTO leave_requests (id, org_id, user_id, leave_type_id, start_date, end_date, hours, reason, status, reviewed_by)
SELECT '00000000-0000-0000-0000-000000001107',
       '00000000-0000-0000-0000-000000000a01',
       '00000000-0000-0000-0000-000000000e04',
       lt.id, '2026-02-24', '2026-02-28', 50.0,
       'Medical procedure recovery', 'approved',
       '00000000-0000-0000-0000-0000000000a2'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000a01' AND lt.code = 'fmla_sick';

INSERT INTO leave_request_lines (leave_request_id, date, hours) VALUES
    ('00000000-0000-0000-0000-000000001107', '2026-02-24', 10.0),
    ('00000000-0000-0000-0000-000000001107', '2026-02-25', 10.0),
    ('00000000-0000-0000-0000-000000001107', '2026-02-26', 10.0),
    ('00000000-0000-0000-0000-000000001107', '2026-02-27', 10.0),
    ('00000000-0000-0000-0000-000000001107', '2026-02-28', 10.0);

-- ── OT Queue Positions ───────────────────────────────────────────────────
-- Initialize OT rotation queue for all COII and COI employees (FY 2026)
-- Stagger last_ot_event_at so the queue has a meaningful order
-- NULL = never called out for OT (front of queue)

INSERT INTO ot_queue_positions (org_id, classification_id, user_id, fiscal_year, last_ot_event_at)
SELECT
    '00000000-0000-0000-0000-000000000a01',
    u.classification_id,
    u.id,
    2026,
    -- Stagger: senior employees have older OT events, newer ones are NULL (front of queue)
    CASE
        WHEN u.hire_date < '2018-01-01' THEN '2026-01-15 08:00:00-08'::TIMESTAMPTZ + (ROW_NUMBER() OVER (ORDER BY u.hire_date) * INTERVAL '2 hours')
        WHEN u.hire_date < '2021-01-01' THEN '2026-02-01 08:00:00-08'::TIMESTAMPTZ + (ROW_NUMBER() OVER (ORDER BY u.hire_date) * INTERVAL '3 hours')
        ELSE NULL  -- newer employees haven't been called yet
    END
FROM users u
WHERE u.org_id = '00000000-0000-0000-0000-000000000a01'
  AND u.is_active = true
  AND u.classification_id IN (
      '00000000-0000-0000-0000-000000000c01',  -- COI
      '00000000-0000-0000-0000-000000000c02'   -- COII
  );

-- ── Schedule Annotations ─────────────────────────────────────────────────
-- Notes and alerts visible on the schedule views

INSERT INTO schedule_annotations (org_id, date, content, annotation_type, created_by) VALUES
    ('00000000-0000-0000-0000-000000000a01', '2026-02-16', 'Presidents'' Day — premium pay in effect', 'holiday',
     '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-000000000a01', '2026-02-20', 'Minimum staffing alert: 2 approved off on Team 3', 'alert',
     '00000000-0000-0000-0000-0000000000a2'),
    ('00000000-0000-0000-0000-000000000a01', '2026-03-03', 'Annual CPR/first-aid recertification — Team 1 & 2 morning', 'note',
     '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-000000000a01', '2026-03-10', 'New CAD system training — all teams, staggered shifts', 'note',
     '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-000000000a01', '2026-03-17', 'St. Patrick''s Day — expect increased call volume downtown', 'alert',
     '00000000-0000-0000-0000-0000000000a2'),
    ('00000000-0000-0000-0000-000000000a01', '2026-02-24', 'Maria Santos on FMLA — OT coverage needed 18-04 slot', 'alert',
     '00000000-0000-0000-0000-0000000000a2');

-- ── OT Requests ──────────────────────────────────────────────────────────
-- Open OT requests for understaffed shifts — supervisors have posted these

-- Team 4 understaffed: needs COII for 12-22, 14-24, 18-04, 22-08 slots (today)
INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE, '12:00', '22:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 4', true,
       'T4 COII 12-22 slot vacant — need coverage', 'open'::ot_request_status,
       '00000000-0000-0000-0000-000000000e18'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'vacancy';

INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE, '14:00', '00:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 4', true,
       'T4 COII 14-24 slot vacant — need coverage', 'open'::ot_request_status,
       '00000000-0000-0000-0000-000000000e18'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'vacancy';

INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001203', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE, '18:00', '04:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 4', true,
       'T4 COII 18-04 slot vacant — need coverage', 'open'::ot_request_status,
       '00000000-0000-0000-0000-000000000e18'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'vacancy';

INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001204', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE, '22:00', '08:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 4', true,
       'T4 COII 22-08 slot vacant — need coverage', 'open'::ot_request_status,
       '00000000-0000-0000-0000-000000000e18'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'vacancy';

-- FMLA coverage OT (Team 1, tomorrow + day after)
INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001205', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE + 1, '18:00', '04:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 1', true,
       'Covering Maria Santos FMLA — 18-04 slot', 'open'::ot_request_status,
       '00000000-0000-0000-0000-0000000000a2'
FROM ot_reasons r WHERE r.org_id = '00000000-0000-0000-0000-000000000a01' AND r.code = 'fmla_coverage';

INSERT INTO ot_requests (id, org_id, date, start_time, end_time, hours, classification_id, ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
SELECT '00000000-0000-0000-0000-000000001206', '00000000-0000-0000-0000-000000000a01',
       CURRENT_DATE + 2, '18:00', '04:00', 10.0,
       '00000000-0000-0000-0000-000000000c02', r.id, 'Team 1', true,
       'Covering Maria Santos FMLA — 18-04 slot', 'open'::ot_request_status,
       '00000000-0000-0000-0000-0000000000a2'
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

-- Some volunteers on a couple of these
INSERT INTO ot_request_volunteers (ot_request_id, user_id)
VALUES
    ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-0000000000a3'),  -- Mike Johnson volunteered for 12-22
    ('00000000-0000-0000-0000-000000001205', '00000000-0000-0000-0000-000000000e01'),  -- Tom Baker volunteered for FMLA coverage
    ('00000000-0000-0000-0000-000000001205', '00000000-0000-0000-0000-000000000e02');  -- Rachel Kim also volunteered

-- ── OT Hours Tracking ────────────────────────────────────────────────────
-- Seed some OT hours so the OT queue and reports have data

INSERT INTO ot_hours (user_id, classification_id, fiscal_year, hours_worked, hours_declined, updated_at)
SELECT
    u.id,
    u.classification_id,
    2026,
    -- Senior employees have accumulated more OT worked
    CASE
        WHEN u.hire_date < '2016-01-01' THEN 24.0 + (RANDOM() * 16)::NUMERIC(8,2)
        WHEN u.hire_date < '2020-01-01' THEN 12.0 + (RANDOM() * 12)::NUMERIC(8,2)
        WHEN u.hire_date < '2023-01-01' THEN 4.0 + (RANDOM() * 8)::NUMERIC(8,2)
        ELSE 0.0
    END,
    -- Some declined hours too
    CASE
        WHEN u.hire_date < '2018-01-01' THEN (RANDOM() * 10)::NUMERIC(8,2)
        ELSE 0.0
    END,
    NOW()
FROM users u
WHERE u.org_id = '00000000-0000-0000-0000-000000000a01'
  AND u.is_active = true
  AND u.classification_id IN (
      '00000000-0000-0000-0000-000000000c01',
      '00000000-0000-0000-0000-000000000c02'
  );

COMMIT;
