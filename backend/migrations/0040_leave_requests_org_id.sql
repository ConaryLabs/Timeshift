-- Add org_id directly to leave_requests for defense-in-depth tenant isolation.
-- Previously, org scoping required joining through users.

ALTER TABLE leave_requests ADD COLUMN org_id UUID;

UPDATE leave_requests SET org_id = (SELECT org_id FROM users WHERE id = leave_requests.user_id);

ALTER TABLE leave_requests ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE leave_requests
    ADD CONSTRAINT leave_requests_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id);

CREATE INDEX idx_leave_requests_org ON leave_requests (org_id);

-- Composite index for the callout availability check:
-- approved leave on a specific date for a specific org
CREATE INDEX idx_leave_requests_org_status_dates
    ON leave_requests (org_id, status, start_date, end_date)
    WHERE status = 'approved';
