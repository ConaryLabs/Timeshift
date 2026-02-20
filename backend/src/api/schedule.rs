use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::schedule::{Assignment, AssignmentView, CreateAssignmentRequest, StaffingQuery},
    models::shift::{
        CreateSchedulePeriodRequest, CreateSlotAssignmentRequest, SchedulePeriod, SlotAssignment,
    },
    org_guard,
};

/// Returns a staffing view for a date range.
pub async fn staffing_view(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<StaffingQuery>,
) -> Result<Json<Vec<AssignmentView>>> {
    if q.end_date < q.start_date {
        return Err(AppError::BadRequest(
            "end_date must be >= start_date".into(),
        ));
    }
    if (q.end_date - q.start_date).whole_days() > 90 {
        return Err(AppError::BadRequest(
            "Date range must not exceed 90 days".into(),
        ));
    }

    let rows = sqlx::query!(
        r#"
        SELECT
            a.id            AS assignment_id,
            ss.date,
            st.name         AS shift_name,
            st.color        AS shift_color,
            st.start_time,
            st.end_time,
            st.crosses_midnight,
            u.id            AS user_id,
            u.employee_id,
            u.first_name,
            u.last_name,
            a.position,
            a.is_overtime,
            a.is_trade,
            a.notes,
            t.name          AS "team_name?",
            cl.abbreviation AS "classification_abbreviation?"
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates  st ON st.id = ss.shift_template_id
        JOIN users            u  ON u.id  = a.user_id
        LEFT JOIN shift_slots sl ON sl.id = ss.slot_id
        LEFT JOIN teams       t  ON t.id  = sl.team_id
        LEFT JOIN classifications cl ON cl.id = u.classification_id
        WHERE ss.org_id = $1
          AND ss.date BETWEEN $2 AND $3
          AND ($4::uuid IS NULL OR sl.team_id = $4)
        ORDER BY ss.date, st.start_time, u.last_name
        "#,
        auth.org_id,
        q.start_date,
        q.end_date,
        q.team_id,
    )
    .fetch_all(&pool)
    .await?;

    let views = rows
        .into_iter()
        .map(|r| AssignmentView {
            assignment_id: r.assignment_id,
            date: r.date,
            shift_name: r.shift_name,
            shift_color: r.shift_color,
            start_time: r.start_time,
            end_time: r.end_time,
            crosses_midnight: r.crosses_midnight,
            user_id: r.user_id,
            employee_id: r.employee_id,
            first_name: r.first_name,
            last_name: r.last_name,
            position: r.position,
            is_overtime: r.is_overtime,
            is_trade: r.is_trade,
            team_name: r.team_name,
            classification_abbreviation: r.classification_abbreviation,
            notes: r.notes,
        })
        .collect();

    Ok(Json(views))
}

pub async fn create_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateAssignmentRequest>,
) -> Result<Json<Assignment>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify both scheduled_shift and user belong to caller's org
    org_guard::verify_scheduled_shift(&pool, req.scheduled_shift_id, auth.org_id).await?;
    org_guard::verify_user(&pool, req.user_id, auth.org_id).await?;

    let a = sqlx::query_as!(
        Assignment,
        r#"
        INSERT INTO assignments (id, scheduled_shift_id, user_id, position, is_overtime, is_trade, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, scheduled_shift_id, user_id, position, is_overtime, is_trade, notes, created_by, created_at
        "#,
        Uuid::new_v4(),
        req.scheduled_shift_id,
        req.user_id,
        req.position,
        req.is_overtime,
        req.is_trade,
        req.notes,
        auth.id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(a))
}

pub async fn delete_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        r#"
        DELETE FROM assignments
        WHERE id = $1
          AND EXISTS (
              SELECT 1 FROM scheduled_shifts ss
              WHERE ss.id = assignments.scheduled_shift_id AND ss.org_id = $2
          )
        "#,
        id,
        auth.org_id
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Assignment not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// -- Schedule Periods --

pub async fn list_periods(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<SchedulePeriod>>> {
    let rows = sqlx::query_as!(
        SchedulePeriod,
        r#"
        SELECT id, org_id, name, start_date, end_date, is_active, created_at
        FROM schedule_periods
        WHERE org_id = $1
        ORDER BY start_date DESC
        "#,
        auth.org_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create_period(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateSchedulePeriodRequest>,
) -> Result<Json<SchedulePeriod>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let row = sqlx::query_as!(
        SchedulePeriod,
        r#"
        INSERT INTO schedule_periods (id, org_id, name, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, org_id, name, start_date, end_date, is_active, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name,
        req.start_date,
        req.end_date,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn assign_slot(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(period_id): Path<Uuid>,
    Json(req): Json<CreateSlotAssignmentRequest>,
) -> Result<Json<SlotAssignment>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify slot, user, and period all belong to caller's org
    org_guard::verify_slot(&pool, req.slot_id, auth.org_id).await?;
    org_guard::verify_user(&pool, req.user_id, auth.org_id).await?;
    org_guard::verify_period(&pool, period_id, auth.org_id).await?;

    let row = sqlx::query_as!(
        SlotAssignment,
        r#"
        INSERT INTO slot_assignments (id, slot_id, user_id, period_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, slot_id, user_id, period_id, created_at
        "#,
        Uuid::new_v4(),
        req.slot_id,
        req.user_id,
        period_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}
