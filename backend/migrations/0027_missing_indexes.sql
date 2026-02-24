-- Performance indexes for hot query paths
CREATE INDEX idx_callout_events_shift ON callout_events (scheduled_shift_id);
CREATE INDEX idx_callout_events_status ON callout_events (status);
CREATE INDEX idx_coverage_requirements_org ON coverage_requirements (org_id);
CREATE INDEX idx_leave_requests_type ON leave_requests (leave_type_id);
