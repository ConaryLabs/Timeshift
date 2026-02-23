-- Seed the default OT cross-classification eligibility window.
-- Per LOU 25-10 the window is 10 days before shift date; orgs can override via org_settings.
-- Stored as a JSONB integer under key 'ot_cross_class_window_days'.

INSERT INTO org_settings (id, org_id, key, value)
SELECT gen_random_uuid(), o.id, 'ot_cross_class_window_days', '10'::JSONB
FROM organizations o
ON CONFLICT (org_id, key) DO NOTHING;
