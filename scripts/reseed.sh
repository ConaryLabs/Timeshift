#!/bin/bash
# scripts/reseed.sh — Wipe all seed data and reload from demo.sql
#
# On production: uses sudo -u postgres (peer auth)
# On dev: uses PGPASSWORD=timeshift_dev (password auth)
#
# Usage: ./scripts/reseed.sh          (or: make reseed)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SEED_FILE="$PROJECT_DIR/backend/seeds/demo.sql"

if [ ! -f "$SEED_FILE" ]; then
    echo "ERROR: Seed file not found: $SEED_FILE"
    exit 1
fi

# Detect environment and set psql command
if systemctl is-active --quiet timeshift-backend 2>/dev/null; then
    echo "==> Production detected (using postgres peer auth)"
    PSQL="sudo -u postgres psql -d timeshift"
else
    echo "==> Dev environment (using password auth)"
    export PGPASSWORD="${PGPASSWORD:-timeshift_dev}"
    PSQL="psql -U timeshift -h 127.0.0.1 -d timeshift"
fi

echo "==> Wiping all org data (TRUNCATE organizations CASCADE)..."
$PSQL -c "TRUNCATE organizations CASCADE;"

echo "==> Loading seed data from demo.sql..."
$PSQL < "$SEED_FILE"

echo "==> Verifying..."
$PSQL -c "SELECT
    (SELECT COUNT(*) FROM organizations) AS orgs,
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM teams) AS teams,
    (SELECT COUNT(*) FROM shift_slots) AS slots,
    (SELECT COUNT(*) FROM scheduled_shifts) AS sched_shifts,
    (SELECT COUNT(*) FROM assignments) AS assignments,
    (SELECT COUNT(*) FROM coverage_plan_slots) AS cov_slots,
    (SELECT COUNT(*) FROM holiday_calendar) AS holidays,
    (SELECT COUNT(*) FROM leave_requests) AS leave_reqs,
    (SELECT COUNT(*) FROM ot_queue_positions) AS ot_queue,
    (SELECT COUNT(*) FROM leave_balances) AS balances;"

echo "==> Done!"
