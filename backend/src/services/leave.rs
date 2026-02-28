//! Leave balance operations: adjustments, deductions, refunds, FMLA segmentation.

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, Result};

/// Core balance adjustment: positive delta adds hours, negative deducts.
/// Atomically records an accrual_transaction and upserts the leave_balances row.
/// `reference_id` is the UUID of the related entity (leave request, donation, etc.); pass `None`
/// for administrative adjustments that have no associated workflow entity.
#[allow(clippy::too_many_arguments)]
pub async fn adjust_leave_balance(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    org_id: Uuid,
    user_id: Uuid,
    leave_type_id: Uuid,
    delta: f64,
    reason: &str,
    note: Option<&str>,
    reference_id: Option<Uuid>,
    actor_id: Uuid,
    org_timezone: &str,
) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO accrual_transactions (id, org_id, user_id, leave_type_id, hours, reason, reference_id, note, created_by)
        VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, $6, $7, $8, $9)
        "#,
        Uuid::new_v4(),
        org_id,
        user_id,
        leave_type_id,
        delta,
        reason,
        reference_id,
        note,
        actor_id,
    )
    .execute(&mut **tx)
    .await?;

    let today = crate::services::timezone::org_today(org_timezone);
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
        user_id,
        leave_type_id,
        delta,
        today,
    )
    .execute(&mut **tx)
    .await?;

    Ok(())
}

/// Deduct hours from leave balance when a leave request is approved.
#[allow(clippy::too_many_arguments)]
pub async fn deduct_leave_balance(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    org_id: Uuid,
    user_id: Uuid,
    leave_type_id: Uuid,
    hours: f64,
    leave_request_id: Uuid,
    reviewer_id: Uuid,
    org_timezone: &str,
) -> Result<()> {
    adjust_leave_balance(
        tx,
        org_id,
        user_id,
        leave_type_id,
        -hours.abs(),
        "usage",
        None,
        Some(leave_request_id),
        reviewer_id,
        org_timezone,
    )
    .await
}

/// Refund hours to leave balance when a previously approved leave request is cancelled.
#[allow(clippy::too_many_arguments)]
pub async fn refund_leave_balance(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    org_id: Uuid,
    user_id: Uuid,
    leave_type_id: Uuid,
    hours: f64,
    leave_request_id: Uuid,
    canceller_id: Uuid,
    org_timezone: &str,
) -> Result<()> {
    adjust_leave_balance(
        tx,
        org_id,
        user_id,
        leave_type_id,
        hours.abs(),
        "adjustment",
        Some("Refund: approved leave cancelled"),
        Some(leave_request_id),
        canceller_id,
        org_timezone,
    )
    .await
}

/// Default FMLA exhaustion order — used when org has no custom setting.
const DEFAULT_FMLA_EXHAUSTION_ORDER: &[&str] = &["sick", "comp", "holiday", "vacation"];

/// Auto-create FMLA priority segments inside an open transaction.
///
/// CBA compliance: FMLA hours are drawn from leave pools in contractual priority order.
/// Default order: sick → comp → holiday → vacation → LWOP.
/// The order is configurable per org via the `fmla_exhaustion_order` org_setting
/// (comma-separated category names, e.g. "vacation,sick,comp,holiday").
/// LWOP always covers any remainder regardless of ordering.
pub async fn create_fmla_segments(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    leave_request_id: Uuid,
    org_id: Uuid,
    user_id: Uuid,
    total_hours: f64,
) -> Result<()> {
    // Read configurable exhaustion order from org_settings.
    // Query within the transaction so it's consistent with balance reads.
    let custom_order_row = sqlx::query!(
        "SELECT value::TEXT AS \"val?\" FROM org_settings WHERE org_id = $1 AND key = 'fmla_exhaustion_order'",
        org_id,
    )
    .fetch_optional(&mut **tx)
    .await?;
    let custom_order: Option<String> = custom_order_row.and_then(|r| r.val);

    let fmla_pools: Vec<&str> = match custom_order {
        Some(ref csv) => csv.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect(),
        None => DEFAULT_FMLA_EXHAUSTION_ORDER.to_vec(),
    };

    let mut remaining = total_hours;
    let mut sort_order = 0i32;

    for pool_name in &fmla_pools {
        if remaining <= 0.0 {
            break;
        }

        let pool_types = sqlx::query!(
            r#"
            SELECT lt.id AS leave_type_id,
                   CAST(COALESCE(lb.balance_hours, 0) AS FLOAT8) AS "balance_hours!"
            FROM leave_types lt
            LEFT JOIN leave_balances lb
                   ON lb.leave_type_id = lt.id AND lb.user_id = $2 AND lb.org_id = $3
            WHERE lt.org_id = $1 AND lt.category = $4 AND lt.is_active = true
              AND COALESCE(lb.balance_hours, 0) > 0
            ORDER BY COALESCE(lb.balance_hours, 0) DESC
            "#,
            org_id,
            user_id,
            org_id,
            *pool_name,
        )
        .fetch_all(&mut **tx)
        .await?;

        for pt in pool_types {
            if remaining <= 0.0 {
                break;
            }
            let use_hours = remaining.min(pt.balance_hours);
            sqlx::query!(
                r#"
                INSERT INTO leave_request_segments (leave_request_id, leave_type_id, hours, sort_order)
                VALUES ($1, $2, $3::FLOAT8::NUMERIC, $4)
                "#,
                leave_request_id,
                pt.leave_type_id,
                use_hours,
                sort_order,
            )
            .execute(&mut **tx)
            .await?;
            remaining -= use_hours;
            sort_order += 1;
        }
    }

    // LWOP segment covers any hours not covered by existing balances
    if remaining > 0.01 {
        let lwop_id = sqlx::query_scalar!(
            "SELECT id FROM leave_types WHERE org_id = $1 AND category = 'lwop' AND is_active = true LIMIT 1",
            org_id,
        )
        .fetch_optional(&mut **tx)
        .await?;

        if let Some(lwop_id) = lwop_id {
            sqlx::query!(
                r#"
                INSERT INTO leave_request_segments (leave_request_id, leave_type_id, hours, sort_order)
                VALUES ($1, $2, $3::FLOAT8::NUMERIC, $4)
                "#,
                leave_request_id,
                lwop_id,
                remaining,
                sort_order,
            )
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(())
}

/// CBA compliance: validate combined carryover cap across leave types.
///
/// When processing end-of-year carryover, the CBA may cap the total hours carried
/// over across all eligible leave categories. This function checks whether the
/// proposed carryover for a user would exceed the org's combined cap.
///
/// Reads `leave_carryover_cap_hours` from org_settings. Returns Ok(()) if no cap
/// is configured or if the total is within the cap. Returns Err if exceeded.
///
/// `carryover_categories`: which leave categories are subject to the combined cap
/// (e.g., ["vacation", "comp", "holiday"]).
pub async fn validate_carryover_cap(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    carryover_categories: &[&str],
) -> Result<()> {
    let cap_str = crate::services::org_settings::get_str(
        pool,
        org_id,
        "leave_carryover_cap_hours",
        "0",
    )
    .await;
    let cap: f64 = cap_str.parse().unwrap_or(0.0);
    if cap <= 0.0 {
        return Ok(()); // No cap configured
    }

    // Sum current balances across all leave types in the specified categories
    let cats: Vec<String> = carryover_categories.iter().map(|s| s.to_string()).collect();
    let total: f64 = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(CAST(lb.balance_hours AS FLOAT8)), 0.0) AS "total!"
        FROM leave_balances lb
        JOIN leave_types lt ON lt.id = lb.leave_type_id AND lt.org_id = lb.org_id
        WHERE lb.org_id = $1
          AND lb.user_id = $2
          AND lt.is_active = true
          AND lt.category = ANY($3)
        "#,
        org_id,
        user_id,
        &cats,
    )
    .fetch_one(pool)
    .await?;

    if total > cap {
        return Err(AppError::BadRequest(format!(
            "Combined leave carryover ({:.1} hours) exceeds the maximum of {:.0} hours. \
             Excess hours must be used or forfeited before carryover.",
            total, cap,
        )));
    }

    Ok(())
}
