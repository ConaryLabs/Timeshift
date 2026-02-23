-- Leave balances: current balance per user per leave type
CREATE TABLE leave_balances (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id),
    user_id       UUID NOT NULL REFERENCES users(id),
    leave_type_id UUID NOT NULL REFERENCES leave_types(id),
    balance_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
    as_of_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_leave_balances_unique ON leave_balances (org_id, user_id, leave_type_id);

-- Accrual schedules: how much leave accrues per pay period based on employee type & tenure
CREATE TABLE accrual_schedules (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                UUID NOT NULL REFERENCES organizations(id),
    leave_type_id         UUID NOT NULL REFERENCES leave_types(id),
    employee_type         employee_type_enum NOT NULL DEFAULT 'regular_full_time',
    years_of_service_min  INT NOT NULL DEFAULT 0,
    years_of_service_max  INT,
    hours_per_pay_period  NUMERIC(6,2) NOT NULL,
    max_balance_hours     NUMERIC(8,2),
    effective_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_accrual_schedules_org ON accrual_schedules (org_id, leave_type_id);

-- Accrual transactions: ledger of all balance changes
CREATE TABLE accrual_transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id),
    user_id       UUID NOT NULL REFERENCES users(id),
    leave_type_id UUID NOT NULL REFERENCES leave_types(id),
    hours         NUMERIC(8,2) NOT NULL,
    reason        TEXT NOT NULL CHECK (reason IN ('accrual', 'usage', 'adjustment', 'carryover')),
    reference_id  UUID,
    note          TEXT,
    created_by    UUID NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_accrual_transactions_user ON accrual_transactions (user_id, leave_type_id);

-- Leave request lines: split absences (hours per day within a leave request)
CREATE TABLE leave_request_lines (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    start_time       TIME,
    end_time         TIME,
    hours            NUMERIC(6,2) NOT NULL
);
CREATE INDEX idx_leave_request_lines ON leave_request_lines (leave_request_id);
