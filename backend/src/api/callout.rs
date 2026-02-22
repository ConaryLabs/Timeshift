use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::{
        callout::{
            CalloutAttempt, CalloutEvent, CalloutListEntry, CalloutStatus,
            CreateCalloutEventRequest, RecordAttemptRequest,
        },
        common::PaginationParams,
    },
    org_guard,
};

pub async fn list_events(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<CalloutEvent>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let events = sqlx::query_as!(
        CalloutEvent,
        r#"
        SELECT ce.id, ce.scheduled_shift_id, ce.initiated_by,
               ce.ot_reason_id, ce.reason_text, ce.classification_id,
               ce.status AS "status: CalloutStatus",
               st.name AS "shift_template_name?",
               ss.date AS "shift_date?",
               t.name AS "team_name?",
               ce.created_at, ce.updated_at
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        LEFT JOIN shift_slots sl ON sl.id = ss.slot_id
        LEFT JOIN teams t ON t.id = sl.team_id
        WHERE ss.org_id = $1
        ORDER BY ce.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        auth.org_id,
        params.limit(),
        params.offset(),
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
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let event = sqlx::query_as!(
        CalloutEvent,
        r#"
        SELECT ce.id, ce.scheduled_shift_id, ce.initiated_by,
               ce.ot_reason_id, ce.reason_text, ce.classification_id,
               ce.status AS "status: CalloutStatus",
               st.name AS "shift_template_name?",
               ss.date AS "shift_date?",
               t.name AS "team_name?",
               ce.created_at, ce.updated_at
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        LEFT JOIN shift_slots sl ON sl.id = ss.slot_id
        LEFT JOIN teams t ON t.id = sl.team_id
        WHERE ce.id = $1 AND ss.org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;

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

    // Verify all FK references belong to caller's org
    org_guard::verify_scheduled_shift(&pool, req.scheduled_shift_id, auth.org_id).await?;
    if let Some(reason_id) = req.ot_reason_id {
        org_guard::verify_ot_reason(&pool, reason_id, auth.org_id).await?;
    }
    if let Some(class_id) = req.classification_id {
        org_guard::verify_classification(&pool, class_id, auth.org_id).await?;
    }

    let new_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO callout_events (id, scheduled_shift_id, initiated_by, ot_reason_id, reason_text, classification_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'open')
        "#,
        new_id,
        req.scheduled_shift_id,
        auth.id,
        req.ot_reason_id,
        req.reason_text,
        req.classification_id,
    )
    .execute(&pool)
    .await?;

    let event = sqlx::query_as!(
        CalloutEvent,
        r#"
        SELECT ce.id, ce.scheduled_shift_id, ce.initiated_by,
               ce.ot_reason_id, ce.reason_text, ce.classification_id,
               ce.status AS "status: CalloutStatus",
               st.name AS "shift_template_name?",
               ss.date AS "shift_date?",
               t.name AS "team_name?",
               ce.created_at, ce.updated_at
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        LEFT JOIN shift_slots sl ON sl.id = ss.slot_id
        LEFT JOIN teams t ON t.id = sl.team_id
        WHERE ce.id = $1
        "#,
        new_id
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
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

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
        return Err(AppError::NotFound("Callout event not found".into()));
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
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
    Json(req): Json<RecordAttemptRequest>,
) -> Result<Json<CalloutAttempt>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if !matches!(req.response.as_str(), "accepted" | "declined" | "no_answer") {
        return Err(AppError::BadRequest(
            "response must be 'accepted', 'declined', or 'no_answer'".into(),
        ));
    }

    let mut tx = pool.begin().await?;

    // 1. Lock the callout event row (FOR UPDATE) and fetch shift context.
    let ctx = sqlx::query!(
        r#"
        SELECT ce.status AS "status: CalloutStatus", ce.scheduled_shift_id,
               ss.org_id, ss.date AS shift_date, st.duration_minutes
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates  st ON st.id = ss.shift_template_id
        WHERE ce.id = $1
        FOR UPDATE OF ce
        "#,
        event_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;

    if ctx.org_id != auth.org_id {
        return Err(AppError::NotFound("Callout event not found".into()));
    }
    if ctx.status != CalloutStatus::Open {
        return Err(AppError::Conflict("Callout event is no longer open".into()));
    }

    // 2. Validate the target user belongs to this org and is active.
    let user_ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND org_id = $2 AND is_active = true)",
        req.user_id,
        auth.org_id
    )
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(false);

    if !user_ok {
        return Err(AppError::NotFound("User not found".into()));
    }

    // Use shift date's calendar year as the OT fiscal year.
    let fiscal_year: i32 = ctx.shift_date.year();

    // 3. Snapshot current OT hours_worked at contact time (0 if no row yet).
    let ot_snapshot: f64 = sqlx::query_scalar!(
        r#"
        SELECT CAST(hours_worked AS FLOAT8)
        FROM ot_hours
        WHERE user_id = $1 AND fiscal_year = $2 AND classification_id IS NULL
        "#,
        req.user_id,
        fiscal_year,
    )
    .fetch_optional(&mut *tx)
    .await?
    .flatten()
    .unwrap_or(0.0);

    // 4. Contact-order position: how many attempts have already been recorded.
    let count: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM callout_attempts WHERE event_id = $1",
        event_id
    )
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(0);
    let position = (count + 1) as i32;

    // 5. Insert the attempt.
    let attempt_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO callout_attempts
            (id, event_id, user_id, list_position, contacted_at,
             response, ot_hours_at_contact, notes)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6::FLOAT8::NUMERIC, $7)
        "#,
        attempt_id,
        event_id,
        req.user_id,
        position,
        req.response,
        ot_snapshot,
        req.notes,
    )
    .execute(&mut *tx)
    .await?;

    // Shift duration in hours for OT accounting.
    let shift_hours = ctx.duration_minutes as f64 / 60.0;

    match req.response.as_str() {
        "accepted" => {
            // Mark the event filled.
            sqlx::query!(
                "UPDATE callout_events SET status = 'filled', updated_at = NOW() WHERE id = $1",
                event_id
            )
            .execute(&mut *tx)
            .await?;

            // Create an OT assignment. Skip if the user is already on this shift.
            sqlx::query!(
                r#"
                INSERT INTO assignments
                    (id, scheduled_shift_id, user_id, is_overtime, created_by)
                VALUES (gen_random_uuid(), $1, $2, true, $3)
                ON CONFLICT (scheduled_shift_id, user_id) DO NOTHING
                "#,
                ctx.scheduled_shift_id,
                req.user_id,
                auth.id,
            )
            .execute(&mut *tx)
            .await?;

            // Upsert OT hours_worked for this user/year.
            sqlx::query!(
                r#"
                INSERT INTO ot_hours
                    (id, user_id, fiscal_year, classification_id, hours_worked, hours_declined)
                VALUES (gen_random_uuid(), $1, $2, NULL, $3::FLOAT8::NUMERIC, 0)
                ON CONFLICT (user_id, fiscal_year,
                    COALESCE(classification_id,
                             '00000000-0000-0000-0000-000000000000'::uuid))
                DO UPDATE SET
                    hours_worked = ot_hours.hours_worked + $3::FLOAT8::NUMERIC,
                    updated_at   = NOW()
                "#,
                req.user_id,
                fiscal_year,
                shift_hours,
            )
            .execute(&mut *tx)
            .await?;
        }
        "declined" => {
            // Upsert OT hours_declined for this user/year.
            sqlx::query!(
                r#"
                INSERT INTO ot_hours
                    (id, user_id, fiscal_year, classification_id, hours_worked, hours_declined)
                VALUES (gen_random_uuid(), $1, $2, NULL, 0, $3::FLOAT8::NUMERIC)
                ON CONFLICT (user_id, fiscal_year,
                    COALESCE(classification_id,
                             '00000000-0000-0000-0000-000000000000'::uuid))
                DO UPDATE SET
                    hours_declined = ot_hours.hours_declined + $3::FLOAT8::NUMERIC,
                    updated_at     = NOW()
                "#,
                req.user_id,
                fiscal_year,
                shift_hours,
            )
            .execute(&mut *tx)
            .await?;
        }
        _ => {} // no_answer: no OT accounting change
    }

    tx.commit().await?;

    // Fetch and return the persisted attempt.
    let attempt = sqlx::query_as!(
        CalloutAttempt,
        r#"
        SELECT id, event_id, user_id, list_position, contacted_at, response,
               CAST(ot_hours_at_contact AS FLOAT8) AS "ot_hours_at_contact!",
               notes
        FROM callout_attempts
        WHERE id = $1
        "#,
        attempt_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(attempt))
}

pub async fn cancel_event(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        r#"
        UPDATE callout_events
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
          AND status = 'open'
          AND EXISTS (
              SELECT 1 FROM scheduled_shifts ss
              WHERE ss.id = callout_events.scheduled_shift_id AND ss.org_id = $2
          )
        "#,
        event_id,
        auth.org_id
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound(
            "Event not found, already cancelled, or already filled".into(),
        ));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
