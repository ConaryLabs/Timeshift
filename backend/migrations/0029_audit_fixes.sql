-- Migration 0029: Audit fixes — data integrity and contract compliance
--
-- 1. FK constraint on login_audit_log.org_id (missing from 0028)
-- 2. Trade request deadline column (VCCEA Article 14.3)

-- 1. Add FK on login_audit_log.org_id (was missing from 0028)
ALTER TABLE login_audit_log
    ADD CONSTRAINT fk_login_audit_org FOREIGN KEY (org_id) REFERENCES organizations(id);

-- 2. Trade request deadline (VCCEA Article 14.3 — both shifts within bid period)
ALTER TABLE trade_requests ADD COLUMN deadline_at TIMESTAMPTZ;
