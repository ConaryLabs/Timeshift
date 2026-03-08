use axum::{
    extract::{Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    api::helpers::validate_date_range,
    auth::AuthUser,
    error::{AppError, Result},
    models::employee::{
        EmployeePreferences, LeaveBalanceSummary, MyDashboardData, MyScheduleEntry,
        MyScheduleQuery, UpdatePreferencesRequest,
    },
};

/// Ensure employee_preferences row exists for user (upsert with defaults).
async fn ensure_preferences_exist(pool: &PgPool, user_id: Uuid) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO employee_preferences (id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO NOTHING
        "#,
        Uuid::new_v4(),
        user_id,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Fetch employee_preferences for a user.
async fn fetch_preferences(pool: &PgPool, user_id: Uuid) -> Result<EmployeePreferences> {
    Ok(sqlx::query_as!(
        EmployeePreferences,
        r#"
        SELECT id, user_id, notification_email, notification_sms, preferred_view,
               created_at, updated_at
        FROM employee_preferences
        WHERE user_id = $1
        "#,
        user_id,
    )
    .fetch_one(pool)
    .await?)
}

/// GET /api/users/me/preferences — get own preferences (upsert default if none exist)
pub async fn get_preferences(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<EmployeePreferences>> {
    ensure_preferences_exist(&pool, auth.id).await?;
    Ok(Json(fetch_preferences(&pool, auth.id).await?))
}

/// PUT /api/users/me/preferences — update own preferences
pub async fn update_preferences(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<UpdatePreferencesRequest>,
) -> Result<Json<EmployeePreferences>> {
    if let Some(ref view) = body.preferred_view {
        if !["month", "week", "day"].contains(&view.as_str()) {
            return Err(AppError::BadRequest(
                "preferred_view must be 'month', 'week', or 'day'".into(),
            ));
        }
    }

    let provided_email = body.notification_email.is_some();
    let provided_sms = body.notification_sms.is_some();
    let provided_view = body.preferred_view.is_some();

    ensure_preferences_exist(&pool, auth.id).await?;

    sqlx::query!(
        r#"
        UPDATE employee_preferences
        SET notification_email = CASE WHEN $2 THEN $3 ELSE notification_email END,
            notification_sms   = CASE WHEN $4 THEN $5 ELSE notification_sms END,
            preferred_view     = CASE WHEN $6 THEN $7 ELSE preferred_view END,
            updated_at         = NOW()
        WHERE user_id = $1
        "#,
        auth.id,
        provided_email,
        body.notification_email.unwrap_or_default(),
        provided_sms,
        body.notification_sms.unwrap_or_default(),
        provided_view,
        body.preferred_view.unwrap_or_default(),
    )
    .execute(&pool)
    .await?;

    Ok(Json(fetch_preferences(&pool, auth.id).await?))
}

/// Fetch user shift assignments for a date range, ordered by date and start_time.
async fn fetch_schedule_entries(
    pool: &PgPool,
    user_id: Uuid,
    org_id: Uuid,
    start_date: time::Date,
    end_date: time::Date,
) -> Result<Vec<MyScheduleEntry>> {
    let rows = sqlx::query!(
        r#"
        SELECT ss.date, st.name AS shift_name, st.color AS shift_color,
               st.start_time, st.end_time, st.crosses_midnight,
               t.name AS "team_name?", a.position, a.is_overtime, a.is_trade, a.notes
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        LEFT JOIN shift_slots sl ON sl.id = ss.slot_id
        LEFT JOIN teams t ON t.id = sl.team_id
        WHERE a.user_id = $1 AND ss.date BETWEEN $2 AND $3
          AND ss.org_id = $4
          AND a.cancelled_at IS NULL
        ORDER BY ss.date, st.start_time
        "#,
        user_id,
        start_date,
        end_date,
        org_id,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| MyScheduleEntry {
            date: r.date,
            shift_name: r.shift_name,
            shift_color: r.shift_color,
            start_time: r.start_time,
            end_time: r.end_time,
            crosses_midnight: r.crosses_midnight,
            team_name: r.team_name,
            position: r.position,
            is_overtime: r.is_overtime,
            is_trade: r.is_trade,
            notes: r.notes,
        })
        .collect())
}

/// GET /api/users/me/schedule?start_date&end_date — personal schedule
pub async fn my_schedule(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<MyScheduleQuery>,
) -> Result<Json<Vec<MyScheduleEntry>>> {
    validate_date_range(params.start_date, params.end_date, Some(365))?;
    let entries = fetch_schedule_entries(&pool, auth.id, auth.org_id, params.start_date, params.end_date).await?;
    Ok(Json(entries))
}

/// GET /api/users/me/dashboard — aggregated personal dashboard
pub async fn my_dashboard(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<MyDashboardData>> {
    let today = crate::services::timezone::org_today(&auth.org_timezone);
    let week_end = today + time::Duration::days(7);

    // Fetch all shifts for the upcoming week (today through today+7) in one query.
    // Derive today_shift and next_shift from this result set.
    let upcoming_shifts = fetch_schedule_entries(&pool, auth.id, auth.org_id, today, week_end).await?;
    let today_shift = upcoming_shifts.iter().find(|s| s.date == today).cloned();
    let next_shift = upcoming_shifts.iter().find(|s| s.date > today).cloned();

    // Leave balances
    let balance_rows = sqlx::query!(
        r#"
        SELECT lt.code AS leave_type_code, lt.name AS leave_type_name,
               CAST(lb.balance_hours AS FLOAT8) AS "balance_hours!"
        FROM leave_balances lb
        JOIN leave_types lt ON lt.id = lb.leave_type_id
        WHERE lb.user_id = $1 AND lb.org_id = $2
        ORDER BY lt.display_order
        "#,
        auth.id,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let leave_balances: Vec<LeaveBalanceSummary> = balance_rows
        .into_iter()
        .map(|r| LeaveBalanceSummary {
            leave_type_code: r.leave_type_code,
            leave_type_name: r.leave_type_name,
            balance_hours: r.balance_hours,
        })
        .collect();

    // Pending leave request count
    let pending_leave_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM leave_requests
        WHERE user_id = $1 AND org_id = $2 AND status = 'pending'
        "#,
        auth.id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    // Pending trade request count
    let pending_trade_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM trade_requests
        WHERE (requester_id = $1 OR partner_id = $1)
          AND org_id = $2
          AND status IN ('pending_partner', 'pending_approval')
        "#,
        auth.id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(MyDashboardData {
        today_shift,
        next_shift,
        upcoming_shifts,
        leave_balances,
        pending_leave_count,
        pending_trade_count,
    }))
}
