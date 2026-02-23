use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::leave_balance::{
        AccrualSchedule, AccrualTransaction, AdjustBalanceRequest, BalanceHistoryQuery,
        CreateAccrualScheduleRequest, LeaveBalanceView, UpdateAccrualScheduleRequest,
    },
    org_guard,
};

// -- Leave Balances --

#[derive(Debug, serde::Deserialize)]
pub struct BalanceQuery {
    pub user_id: Option<Uuid>,
}

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<BalanceQuery>,
) -> Result<Json<Vec<LeaveBalanceView>>> {
    let target_user_id = params.user_id.unwrap_or(auth.id);

    // Employees can only see their own balances
    if target_user_id != auth.id && !auth.role.can_approve_leave() {
        return Err(AppError::Forbidden);
    }

    // Verify user belongs to same org
    if target_user_id != auth.id {
        org_guard::verify_user(&pool, target_user_id, auth.org_id).await?;
    }

    let rows = sqlx::query!(
        r#"
        SELECT lb.leave_type_id,
               lt.code AS leave_type_code,
               lt.name AS leave_type_name,
               CAST(lb.balance_hours AS FLOAT8) AS "balance_hours!",
               lb.as_of_date
        FROM leave_balances lb
        JOIN leave_types lt ON lt.id = lb.leave_type_id
        WHERE lb.user_id = $1 AND lb.org_id = $2
        ORDER BY lt.display_order, lt.name
        "#,
        target_user_id,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| LeaveBalanceView {
            leave_type_id: r.leave_type_id,
            leave_type_code: r.leave_type_code,
            leave_type_name: r.leave_type_name,
            balance_hours: r.balance_hours,
            as_of_date: r.as_of_date,
        })
        .collect();

    Ok(Json(result))
}

// -- Balance History (Transaction Ledger) --

pub async fn history(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(user_id): Path<Uuid>,
    Query(params): Query<BalanceHistoryQuery>,
) -> Result<Json<Vec<AccrualTransaction>>> {
    // Employees can only see their own history
    if user_id != auth.id && !auth.role.can_approve_leave() {
        return Err(AppError::Forbidden);
    }

    if user_id != auth.id {
        org_guard::verify_user(&pool, user_id, auth.org_id).await?;
    }

    let rows = sqlx::query!(
        r#"
        SELECT id, user_id, leave_type_id,
               CAST(hours AS FLOAT8) AS "hours!",
               reason, reference_id, note, created_by, created_at
        FROM accrual_transactions
        WHERE user_id = $1 AND org_id = $2
          AND ($3::UUID IS NULL OR leave_type_id = $3)
          AND ($4::DATE IS NULL OR created_at >= $4::DATE::TIMESTAMPTZ)
          AND ($5::DATE IS NULL OR created_at < ($5::DATE + INTERVAL '1 day')::TIMESTAMPTZ)
        ORDER BY created_at DESC
        LIMIT $6 OFFSET $7
        "#,
        user_id,
        auth.org_id,
        params.leave_type_id,
        params.start_date,
        params.end_date,
        params.limit(),
        params.offset(),
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| AccrualTransaction {
            id: r.id,
            user_id: r.user_id,
            leave_type_id: r.leave_type_id,
            hours: r.hours,
            reason: r.reason,
            reference_id: r.reference_id,
            note: r.note,
            created_by: r.created_by,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(result))
}

// -- Adjust Balance (Admin) --

pub async fn adjust(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<AdjustBalanceRequest>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_user(&pool, body.user_id, auth.org_id).await?;

    // Verify leave type belongs to org
    let lt_ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM leave_types WHERE id = $1 AND org_id = $2)",
        body.leave_type_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;
    if !lt_ok.unwrap_or(false) {
        return Err(AppError::NotFound("Leave type not found".into()));
    }

    let mut tx = pool.begin().await?;

    // Insert accrual transaction
    sqlx::query!(
        r#"
        INSERT INTO accrual_transactions (id, org_id, user_id, leave_type_id, hours, reason, note, created_by)
        VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, 'adjustment', $6, $7)
        "#,
        Uuid::new_v4(),
        auth.org_id,
        body.user_id,
        body.leave_type_id,
        body.hours,
        body.note,
        auth.id,
    )
    .execute(&mut *tx)
    .await?;

    // Upsert leave balance
    sqlx::query!(
        r#"
        INSERT INTO leave_balances (id, org_id, user_id, leave_type_id, balance_hours, as_of_date, updated_at)
        VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, CURRENT_DATE, NOW())
        ON CONFLICT (org_id, user_id, leave_type_id) DO UPDATE
        SET balance_hours = leave_balances.balance_hours + $5::FLOAT8::NUMERIC,
            as_of_date = CURRENT_DATE,
            updated_at = NOW()
        "#,
        Uuid::new_v4(),
        auth.org_id,
        body.user_id,
        body.leave_type_id,
        body.hours,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// -- Accrual Schedules --

pub async fn list_accrual_schedules(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<AccrualSchedule>>> {
    let rows = sqlx::query!(
        r#"
        SELECT id, org_id, leave_type_id,
               employee_type::TEXT AS "employee_type!",
               years_of_service_min,
               years_of_service_max,
               CAST(hours_per_pay_period AS FLOAT8) AS "hours_per_pay_period!",
               CAST(max_balance_hours AS FLOAT8) AS "max_balance_hours?",
               effective_date, created_at
        FROM accrual_schedules
        WHERE org_id = $1
        ORDER BY leave_type_id, employee_type, years_of_service_min
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| AccrualSchedule {
            id: r.id,
            org_id: r.org_id,
            leave_type_id: r.leave_type_id,
            employee_type: r.employee_type,
            years_of_service_min: r.years_of_service_min,
            years_of_service_max: r.years_of_service_max,
            hours_per_pay_period: r.hours_per_pay_period,
            max_balance_hours: r.max_balance_hours,
            effective_date: r.effective_date,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(result))
}

pub async fn create_accrual_schedule(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateAccrualScheduleRequest>,
) -> Result<Json<AccrualSchedule>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Verify leave type belongs to org
    let lt_ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM leave_types WHERE id = $1 AND org_id = $2)",
        body.leave_type_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;
    if !lt_ok.unwrap_or(false) {
        return Err(AppError::NotFound("Leave type not found".into()));
    }

    let employee_type = body.employee_type.unwrap_or_else(|| "regular_full_time".to_string());
    let years_min = body.years_of_service_min.unwrap_or(0);
    let effective = body.effective_date.unwrap_or_else(|| {
        time::OffsetDateTime::now_utc().date()
    });

    let r = sqlx::query!(
        r#"
        INSERT INTO accrual_schedules (id, org_id, leave_type_id, employee_type, years_of_service_min,
                                       years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date)
        VALUES ($1, $2, $3, $4::TEXT::employee_type_enum, $5, $6, $7::FLOAT8::NUMERIC, $8::FLOAT8::NUMERIC, $9)
        RETURNING id, org_id, leave_type_id,
                  employee_type::TEXT AS "employee_type!",
                  years_of_service_min,
                  years_of_service_max,
                  CAST(hours_per_pay_period AS FLOAT8) AS "hours_per_pay_period!",
                  CAST(max_balance_hours AS FLOAT8) AS "max_balance_hours?",
                  effective_date, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        body.leave_type_id,
        employee_type,
        years_min,
        body.years_of_service_max,
        body.hours_per_pay_period,
        body.max_balance_hours,
        effective,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(AccrualSchedule {
        id: r.id,
        org_id: r.org_id,
        leave_type_id: r.leave_type_id,
        employee_type: r.employee_type,
        years_of_service_min: r.years_of_service_min,
        years_of_service_max: r.years_of_service_max,
        hours_per_pay_period: r.hours_per_pay_period,
        max_balance_hours: r.max_balance_hours,
        effective_date: r.effective_date,
        created_at: r.created_at,
    }))
}

pub async fn update_accrual_schedule(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAccrualScheduleRequest>,
) -> Result<Json<AccrualSchedule>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Verify schedule belongs to org
    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM accrual_schedules WHERE id = $1 AND org_id = $2)",
        id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;
    if !exists.unwrap_or(false) {
        return Err(AppError::NotFound("Accrual schedule not found".into()));
    }

    let hpp_provided = body.hours_per_pay_period.is_some();
    let mbh_provided = body.max_balance_hours.is_some();
    let ymin_provided = body.years_of_service_min.is_some();
    let ymax_provided = body.years_of_service_max.is_some();

    let r = sqlx::query!(
        r#"
        UPDATE accrual_schedules
        SET hours_per_pay_period = CASE WHEN $2 THEN $3::FLOAT8::NUMERIC ELSE hours_per_pay_period END,
            max_balance_hours    = CASE WHEN $4 THEN $5::FLOAT8::NUMERIC ELSE max_balance_hours END,
            years_of_service_min = CASE WHEN $6 THEN $7 ELSE years_of_service_min END,
            years_of_service_max = CASE WHEN $8 THEN $9 ELSE years_of_service_max END
        WHERE id = $1 AND org_id = $10
        RETURNING id, org_id, leave_type_id,
                  employee_type::TEXT AS "employee_type!",
                  years_of_service_min,
                  years_of_service_max,
                  CAST(hours_per_pay_period AS FLOAT8) AS "hours_per_pay_period!",
                  CAST(max_balance_hours AS FLOAT8) AS "max_balance_hours?",
                  effective_date, created_at
        "#,
        id,
        hpp_provided,
        body.hours_per_pay_period,
        mbh_provided,
        body.max_balance_hours.flatten(),
        ymin_provided,
        body.years_of_service_min,
        ymax_provided,
        body.years_of_service_max.flatten(),
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(AccrualSchedule {
        id: r.id,
        org_id: r.org_id,
        leave_type_id: r.leave_type_id,
        employee_type: r.employee_type,
        years_of_service_min: r.years_of_service_min,
        years_of_service_max: r.years_of_service_max,
        hours_per_pay_period: r.hours_per_pay_period,
        max_balance_hours: r.max_balance_hours,
        effective_date: r.effective_date,
        created_at: r.created_at,
    }))
}

pub async fn delete_accrual_schedule(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "DELETE FROM accrual_schedules WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Accrual schedule not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
