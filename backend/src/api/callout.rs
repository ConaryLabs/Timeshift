use axum::{
    extract::{Path, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::callout::{
        CalloutAttempt, CalloutEvent, CalloutListEntry, CalloutStatus,
        CreateCalloutEventRequest, RecordAttemptRequest,
    },
};

pub async fn list_events(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<CalloutEvent>>> {
    let events = sqlx::query_as!(
        CalloutEvent,
        r#"
        SELECT ce.id, ce.scheduled_shift_id, ce.initiated_by,
               ce.ot_reason_id, ce.reason_text, ce.classification_id,
               ce.status AS "status: CalloutStatus",
               ce.created_at, ce.updated_at
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        WHERE ss.org_id = $1
        ORDER BY ce.created_at DESC
        "#,
        auth.org_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(events))
}

pub async fn get_event(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<CalloutEvent>> {
    let event = sqlx::query_as!(
        CalloutEvent,
        r#"
        SELECT ce.id, ce.scheduled_shift_id, ce.initiated_by,
               ce.ot_reason_id, ce.reason_text, ce.classification_id,
               ce.status AS "status: CalloutStatus",
               ce.created_at, ce.updated_at
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        WHERE ce.id = $1 AND ss.org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Callout event {} not found", id)))?;

    Ok(Json(event))
}

pub async fn create_event(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateCalloutEventRequest>,
) -> Result<Json<CalloutEvent>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let event = sqlx::query_as!(
        CalloutEvent,
        r#"
        INSERT INTO callout_events (id, scheduled_shift_id, initiated_by, ot_reason_id, reason_text, classification_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'open')
        RETURNING id, scheduled_shift_id, initiated_by, ot_reason_id, reason_text, classification_id,
                  status AS "status: CalloutStatus",
                  created_at, updated_at
        "#,
        Uuid::new_v4(),
        req.scheduled_shift_id,
        auth.id,
        req.ot_reason_id,
        req.reason_text,
        req.classification_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(event))
}

/// Computes the ordered callout list for a given event.
pub async fn callout_list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<CalloutListEntry>>> {
    let event = sqlx::query!(
        r#"
        SELECT ce.scheduled_shift_id, ss.org_id
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        WHERE ce.id = $1
        "#,
        event_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;

    if event.org_id != auth.org_id {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        r#"
        SELECT
            u.id,
            u.employee_id,
            u.first_name,
            u.last_name,
            cl.abbreviation AS "classification_abbreviation?",
            u.seniority_date,
            COALESCE(ot.hours_worked, 0.0)::FLOAT8 AS ot_hours,
            NOT EXISTS (
                SELECT 1 FROM assignments a
                WHERE a.user_id = u.id AND a.scheduled_shift_id = $1
            ) AND NOT EXISTS (
                SELECT 1 FROM leave_requests lr
                JOIN scheduled_shifts ss ON ss.id = $1
                WHERE lr.user_id = u.id
                  AND lr.status = 'approved'
                  AND lr.start_date <= ss.date
                  AND lr.end_date   >= ss.date
            ) AS is_available,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM assignments a
                    WHERE a.user_id = u.id AND a.scheduled_shift_id = $1
                ) THEN 'Already scheduled'
                WHEN EXISTS (
                    SELECT 1 FROM leave_requests lr
                    JOIN scheduled_shifts ss ON ss.id = $1
                    WHERE lr.user_id = u.id
                      AND lr.status = 'approved'
                      AND lr.start_date <= ss.date
                      AND lr.end_date   >= ss.date
                ) THEN 'On approved leave'
                ELSE NULL
            END AS unavailable_reason
        FROM users u
        LEFT JOIN classifications cl ON cl.id = u.classification_id
        LEFT JOIN ot_hours ot ON ot.user_id = u.id
            AND ot.fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE)::int
            AND ot.classification_id IS NULL
        WHERE u.is_active = true AND u.org_id = $2
        ORDER BY
            (NOT EXISTS (
                SELECT 1 FROM assignments a2 WHERE a2.user_id = u.id AND a2.scheduled_shift_id = $1
            ) AND NOT EXISTS (
                SELECT 1 FROM leave_requests lr2
                JOIN scheduled_shifts ss2 ON ss2.id = $1
                WHERE lr2.user_id = u.id AND lr2.status = 'approved'
                  AND lr2.start_date <= ss2.date AND lr2.end_date >= ss2.date
            )) DESC,
            COALESCE(ot.hours_worked, 0.0) ASC,
            u.seniority_date ASC NULLS LAST
        "#,
        event.scheduled_shift_id,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let entries = rows
        .into_iter()
        .enumerate()
        .map(|(i, r)| CalloutListEntry {
            position: i as i32 + 1,
            user_id: r.id,
            employee_id: r.employee_id,
            first_name: r.first_name,
            last_name: r.last_name,
            classification_abbreviation: r.classification_abbreviation,
            seniority_date: r.seniority_date,
            ot_hours: r.ot_hours.unwrap_or(0.0),
            is_available: r.is_available.unwrap_or(false),
            unavailable_reason: r.unavailable_reason,
        })
        .collect();

    Ok(Json(entries))
}

pub async fn record_attempt(
    State(_pool): State<PgPool>,
    auth: AuthUser,
    Path(_event_id): Path<Uuid>,
    Json(_req): Json<RecordAttemptRequest>,
) -> Result<Json<CalloutAttempt>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    Err(AppError::BadRequest("Not yet implemented -- expand RecordAttemptRequest".into()))
}

pub async fn cancel_event(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    sqlx::query!(
        "UPDATE callout_events SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
        event_id
    )
    .execute(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
