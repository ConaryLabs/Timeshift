//! Automated leave accrual engine.
//!
//! Matches each active user to their applicable accrual schedules based on
//! employee_type, bargaining_unit, and years of service, then credits hours
//! to leave_balances and records accrual_transactions.

use sqlx::PgPool;
use time::Date;
use uuid::Uuid;

use crate::error::Result;
use crate::services::org_settings;

/// Summary of a single accrual run for one org.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AccrualRunResult {
    pub org_id: Uuid,
    pub org_name: String,
    pub users_processed: u32,
    pub credits_applied: u32,
    pub credits_skipped_paused: u32,
    pub credits_skipped_capped: u32,
    pub details: Vec<AccrualCredit>,
}

/// One credit applied (or that would be applied in dry-run mode).
#[derive(Debug, Clone, serde::Serialize)]
pub struct AccrualCredit {
    pub user_id: Uuid,
    pub user_name: String,
    pub leave_type_id: Uuid,
    pub leave_type_code: String,
    pub schedule_id: Uuid,
    pub hours_credited: f64,
    pub new_balance: f64,
    pub capped: bool,
}

/// Internal: a user row with fields needed for accrual matching.
struct AccrualUser {
    id: Uuid,
    full_name: String,
    employee_type: String,
    bargaining_unit: String,
    /// Years of service (from overall_seniority_date or hire_date).
    years_of_service: f64,
    leave_accrual_paused: bool,
}

/// Internal: an accrual schedule row.
struct Schedule {
    id: Uuid,
    leave_type_id: Uuid,
    leave_type_code: String,
    employee_type: String,
    bargaining_unit: Option<String>,
    years_of_service_min: i32,
    years_of_service_max: Option<i32>,
    hours_per_pay_period: f64,
    max_balance_hours: Option<f64>,
}

/// Run accruals for a single org. If `dry_run` is true, calculates but does not write.
/// Returns None if the org has already been run today.
pub async fn run_org_accrual(
    pool: &PgPool,
    org_id: Uuid,
    org_name: &str,
    org_timezone: &str,
    dry_run: bool,
) -> Result<AccrualRunResult> {
    let today = crate::services::timezone::org_today(org_timezone);

    // Fetch active users with accrual-relevant fields (seniority lives in seniority_records)
    let user_rows = sqlx::query!(
        r#"
        SELECT u.id, u.first_name, u.last_name,
               u.employee_type::TEXT AS "employee_type!",
               u.bargaining_unit AS "bargaining_unit!",
               sr.overall_seniority_date AS "overall_seniority_date?",
               u.hire_date AS "hire_date?",
               u.leave_accrual_paused_at AS "leave_accrual_paused_at?"
        FROM users u
        LEFT JOIN seniority_records sr ON sr.user_id = u.id
        WHERE u.org_id = $1 AND u.is_active = true
        ORDER BY u.last_name, u.first_name
        "#,
        org_id,
    )
    .fetch_all(pool)
    .await?;

    let users: Vec<AccrualUser> = user_rows
        .into_iter()
        .map(|r| {
            let seniority_date = r.overall_seniority_date.or(r.hire_date);
            let yos = seniority_date
                .map(|d| years_between(d, today))
                .unwrap_or(0.0);
            AccrualUser {
                id: r.id,
                full_name: format!("{} {}", r.first_name, r.last_name),
                employee_type: r.employee_type,
                bargaining_unit: r.bargaining_unit,
                years_of_service: yos,
                leave_accrual_paused: r.leave_accrual_paused_at.is_some(),
            }
        })
        .collect();

    // Fetch all active accrual schedules for this org
    let sched_rows = sqlx::query!(
        r#"
        SELECT s.id, s.leave_type_id,
               lt.code AS leave_type_code,
               s.employee_type::TEXT AS "employee_type!",
               s.bargaining_unit AS "bargaining_unit?",
               s.years_of_service_min,
               s.years_of_service_max,
               CAST(s.hours_per_pay_period AS FLOAT8) AS "hours_per_pay_period!",
               CAST(s.max_balance_hours AS FLOAT8) AS "max_balance_hours?"
        FROM accrual_schedules s
        JOIN leave_types lt ON lt.id = s.leave_type_id
        WHERE s.org_id = $1 AND s.effective_date <= $2
        ORDER BY s.leave_type_id, s.employee_type, s.years_of_service_min
        "#,
        org_id,
        today,
    )
    .fetch_all(pool)
    .await?;

    let schedules: Vec<Schedule> = sched_rows
        .into_iter()
        .map(|r| Schedule {
            id: r.id,
            leave_type_id: r.leave_type_id,
            leave_type_code: r.leave_type_code,
            employee_type: r.employee_type,
            bargaining_unit: r.bargaining_unit,
            years_of_service_min: r.years_of_service_min,
            years_of_service_max: r.years_of_service_max,
            hours_per_pay_period: r.hours_per_pay_period,
            max_balance_hours: r.max_balance_hours,
        })
        .collect();

    // Pre-fetch current balances for all users in this org
    let balance_rows = sqlx::query!(
        r#"
        SELECT user_id, leave_type_id, CAST(balance_hours AS FLOAT8) AS "balance_hours!"
        FROM leave_balances
        WHERE org_id = $1
        "#,
        org_id,
    )
    .fetch_all(pool)
    .await?;

    let mut balances: std::collections::HashMap<(Uuid, Uuid), f64> = balance_rows
        .into_iter()
        .map(|r| ((r.user_id, r.leave_type_id), r.balance_hours))
        .collect();

    let mut result = AccrualRunResult {
        org_id,
        org_name: org_name.to_string(),
        users_processed: users.len() as u32,
        credits_applied: 0,
        credits_skipped_paused: 0,
        credits_skipped_capped: 0,
        details: Vec::new(),
    };

    // Use a system user ID for the created_by field (the org's first admin, or generate one)
    let system_actor_id = sqlx::query_scalar!(
        "SELECT id FROM users WHERE org_id = $1 AND role = 'admin' AND is_active = true ORDER BY created_at LIMIT 1",
        org_id,
    )
    .fetch_optional(pool)
    .await?;

    let actor_id = match system_actor_id {
        Some(id) => id,
        None => return Ok(result), // No admin in org, skip
    };

    // Begin transaction if not dry run
    let mut tx = if !dry_run {
        Some(pool.begin().await?)
    } else {
        None
    };

    for user in &users {
        if user.leave_accrual_paused {
            // Count how many schedules would have matched
            let matching = find_matching_schedules(&schedules, user);
            result.credits_skipped_paused += matching.len() as u32;
            continue;
        }

        let matching = find_matching_schedules(&schedules, user);

        for sched in matching {
            let current_balance = balances
                .get(&(user.id, sched.leave_type_id))
                .copied()
                .unwrap_or(0.0);

            let mut hours_to_credit = sched.hours_per_pay_period;
            let mut capped = false;

            // Enforce max balance cap
            if let Some(max) = sched.max_balance_hours {
                if current_balance >= max {
                    result.credits_skipped_capped += 1;
                    continue;
                }
                if current_balance + hours_to_credit > max {
                    hours_to_credit = max - current_balance;
                    capped = true;
                }
            }

            let new_balance = current_balance + hours_to_credit;

            // Update in-memory balance map for subsequent iterations
            balances.insert((user.id, sched.leave_type_id), new_balance);

            if let Some(ref mut tx) = tx {
                let txn_id = Uuid::new_v4();
                let note = format!(
                    "Auto-accrual: {} hrs/period (YOS {:.1}, schedule {})",
                    sched.hours_per_pay_period,
                    user.years_of_service,
                    sched.leave_type_code,
                );

                sqlx::query!(
                    r#"
                    INSERT INTO accrual_transactions (id, org_id, user_id, leave_type_id, hours, reason, reference_id, note, created_by)
                    VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, 'accrual', $6, $7, $8)
                    "#,
                    txn_id,
                    org_id,
                    user.id,
                    sched.leave_type_id,
                    hours_to_credit,
                    sched.id, // reference the schedule that generated this
                    note,
                    actor_id,
                )
                .execute(&mut **tx)
                .await?;

                sqlx::query!(
                    r#"
                    INSERT INTO leave_balances (id, org_id, user_id, leave_type_id, balance_hours, as_of_date, updated_at)
                    VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, $6, NOW())
                    ON CONFLICT (org_id, user_id, leave_type_id) DO UPDATE
                    SET balance_hours = leave_balances.balance_hours + $5::FLOAT8::NUMERIC,
                        as_of_date = $6,
                        updated_at = NOW()
                    "#,
                    Uuid::new_v4(),
                    org_id,
                    user.id,
                    sched.leave_type_id,
                    hours_to_credit,
                    today,
                )
                .execute(&mut **tx)
                .await?;
            }

            result.credits_applied += 1;
            result.details.push(AccrualCredit {
                user_id: user.id,
                user_name: user.full_name.clone(),
                leave_type_id: sched.leave_type_id,
                leave_type_code: sched.leave_type_code.clone(),
                schedule_id: sched.id,
                hours_credited: hours_to_credit,
                new_balance,
                capped,
            });
        }
    }

    if let Some(tx) = tx {
        tx.commit().await?;
    }

    Ok(result)
}

/// Run accruals for ALL orgs. Checks last-run date per org to avoid double-credit.
/// Returns results for each org that was processed (skips already-run orgs).
pub async fn run_all_orgs(pool: &PgPool, dry_run: bool) -> Result<Vec<AccrualRunResult>> {
    let orgs = sqlx::query!(
        "SELECT id, name, timezone FROM organizations"
    )
    .fetch_all(pool)
    .await?;

    let mut results = Vec::new();

    for org in orgs {
        let tz = &org.timezone;
        let today = crate::services::timezone::org_today(tz);
        let today_str = format!("{}", today);

        // Check last run date (JSONB ::TEXT includes quotes around strings, so trim them)
        let last_run = org_settings::get_str(pool, org.id, "accrual_last_run_date", "").await;
        let last_run_trimmed = last_run.trim_matches('"');
        if last_run_trimmed == today_str && !dry_run {
            tracing::debug!(org_id = %org.id, "Skipping accrual run — already ran today");
            continue;
        }

        match run_org_accrual(pool, org.id, &org.name, tz, dry_run).await {
            Ok(result) => {
                // Update last-run date (unless dry run)
                if !dry_run && result.credits_applied > 0 {
                    let today_json = serde_json::Value::String(today_str.clone());
                    sqlx::query!(
                        r#"
                        INSERT INTO org_settings (id, org_id, key, value, updated_at)
                        VALUES ($1, $2, 'accrual_last_run_date', $3, NOW())
                        ON CONFLICT (org_id, key) DO UPDATE
                        SET value = $3, updated_at = NOW()
                        "#,
                        Uuid::new_v4(),
                        org.id,
                        today_json,
                    )
                    .execute(pool)
                    .await?;

                    tracing::info!(
                        org = %org.name,
                        users = result.users_processed,
                        credits = result.credits_applied,
                        "Accrual run complete"
                    );
                }
                results.push(result);
            }
            Err(e) => {
                tracing::error!(org_id = %org.id, error = %e, "Accrual run failed for org");
            }
        }
    }

    Ok(results)
}

/// Find all accrual schedules that match a given user.
///
/// Matching rules:
/// 1. employee_type must match exactly
/// 2. years_of_service must be in [min, max) range (max=NULL means no upper bound)
/// 3. bargaining_unit: if a BU-specific schedule exists for this leave_type+employee_type,
///    it takes precedence over a NULL-BU (wildcard) schedule
fn find_matching_schedules<'a>(schedules: &'a [Schedule], user: &AccrualUser) -> Vec<&'a Schedule> {
    let yos = user.years_of_service as i32;

    // First pass: find all schedules that match type + YOS
    let candidates: Vec<&Schedule> = schedules
        .iter()
        .filter(|s| {
            s.employee_type == user.employee_type
                && yos >= s.years_of_service_min
                && s.years_of_service_max.is_none_or(|max| yos < max)
        })
        .collect();

    // Group by leave_type_id, apply BU precedence within each group
    let mut by_leave_type: std::collections::HashMap<Uuid, Vec<&Schedule>> =
        std::collections::HashMap::new();
    for s in candidates {
        by_leave_type
            .entry(s.leave_type_id)
            .or_default()
            .push(s);
    }

    let mut result = Vec::new();
    for (_lt_id, group) in by_leave_type {
        // Check if there's a BU-specific match
        if let Some(specific) = group
            .iter()
            .find(|s| s.bargaining_unit.as_deref() == Some(&user.bargaining_unit))
        {
            result.push(*specific);
        } else if let Some(wildcard) = group.iter().find(|s| s.bargaining_unit.is_none()) {
            // Fall back to wildcard (NULL BU) schedule
            result.push(*wildcard);
        }
        // If neither matches, user gets nothing for this leave type
    }

    result
}

/// Calculate fractional years between two dates.
fn years_between(from: Date, to: Date) -> f64 {
    let days = (to - from).whole_days();
    if days < 0 {
        return 0.0;
    }
    days as f64 / 365.25
}

/// Background task: runs accruals on a configurable interval.
pub async fn background_accrual_task(pool: PgPool) {
    // Check every hour; the per-org last-run-date check prevents double-credit
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));

    loop {
        interval.tick().await;

        tracing::debug!("Background accrual check starting");
        match run_all_orgs(&pool, false).await {
            Ok(results) => {
                let total_credits: u32 = results.iter().map(|r| r.credits_applied).sum();
                if total_credits > 0 {
                    tracing::info!(
                        orgs = results.len(),
                        total_credits,
                        "Background accrual run complete"
                    );
                }
            }
            Err(e) => {
                tracing::error!(error = %e, "Background accrual run failed");
            }
        }
    }
}
