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
            BumpRequest, BumpRequestWithNames, CalloutAttempt, CalloutEvent, CalloutListEntry,
            CalloutStatus, CreateBumpRequest, CreateCalloutEventRequest, RecordAttemptRequest,
            ReviewBumpRequest,
        },
        common::PaginationParams,
        ot::CalloutStep,
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
               cl.name AS classification_name,
               ce.status AS "status: CalloutStatus",
               ce.current_step AS "current_step?: CalloutStep",
               ce.step_started_at AS "step_started_at?",
               st.name AS "shift_template_name?",
               ss.date AS "shift_date?",
               t.name AS "team_name?",
               ce.created_at, ce.updated_at
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        JOIN classifications cl ON cl.id = ce.classification_id
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
               cl.name AS classification_name,
               ce.status AS "status: CalloutStatus",
               ce.current_step AS "current_step?: CalloutStep",
               ce.step_started_at AS "step_started_at?",
               st.name AS "shift_template_name?",
               ss.date AS "shift_date?",
               t.name AS "team_name?",
               ce.created_at, ce.updated_at
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        JOIN classifications cl ON cl.id = ce.classification_id
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
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify all FK references belong to caller's org
    org_guard::verify_scheduled_shift(&pool, req.scheduled_shift_id, auth.org_id).await?;
    if let Some(reason_id) = req.ot_reason_id {
        org_guard::verify_ot_reason(&pool, reason_id, auth.org_id).await?;
    }
    org_guard::verify_classification(&pool, req.classification_id, auth.org_id).await?;

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
               cl.name AS classification_name,
               ce.status AS "status: CalloutStatus",
               ce.current_step AS "current_step?: CalloutStep",
               ce.step_started_at AS "step_started_at?",
               st.name AS "shift_template_name?",
               ss.date AS "shift_date?",
               t.name AS "team_name?",
               ce.created_at, ce.updated_at
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        JOIN classifications cl ON cl.id = ce.classification_id
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
        SELECT ce.scheduled_shift_id, ce.classification_id, ss.org_id, ss.date AS shift_date
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

    // Use shift date's calendar year so the displayed OT hours match what
    // record_attempt will record (consistent with fiscal_year in that handler).
    let fiscal_year: i32 = event.shift_date.year();

    // Fetch the org's cross-classification eligibility window (default 10 days per LOU 25-10).
    // When the shift is within this many days, employees from other classifications are included.
    let window_days: i64 = sqlx::query_scalar!(
        r#"SELECT CAST(value AS BIGINT) FROM org_settings WHERE org_id = $1 AND key = 'ot_cross_class_window_days'"#,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .flatten()
    .unwrap_or(10);

    let today = time::OffsetDateTime::now_utc().date();
    let days_until_shift = (event.shift_date - today).whole_days();
    let cross_class_eligible = days_until_shift >= 0 && days_until_shift <= window_days;

    let rows = sqlx::query!(
        r#"
        SELECT
            u.id,
            u.employee_id,
            u.first_name,
            u.last_name,
            (u.classification_id IS DISTINCT FROM $4) AS "is_cross_class!: bool",
            cl.abbreviation AS "classification_abbreviation?",
            sr.overall_seniority_date AS "overall_seniority_date?",
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
        LEFT JOIN seniority_records sr ON sr.user_id = u.id
        LEFT JOIN ot_hours ot ON ot.user_id = u.id
            AND ot.fiscal_year = $3
            AND ot.classification_id IS NULL
        LEFT JOIN ot_queue_positions oq ON
            oq.org_id = $2
            AND oq.user_id = u.id
            AND oq.fiscal_year = $3
            AND oq.classification_id = u.classification_id
        WHERE u.is_active = true AND u.org_id = $2
          AND ($5 OR u.classification_id = $4)
          AND u.classification_id IS NOT NULL
        ORDER BY
            (u.classification_id = $4) DESC,
            (NOT EXISTS (
                SELECT 1 FROM assignments a2 WHERE a2.user_id = u.id AND a2.scheduled_shift_id = $1
            ) AND NOT EXISTS (
                SELECT 1 FROM leave_requests lr2
                JOIN scheduled_shifts ss2 ON ss2.id = $1
                WHERE lr2.user_id = u.id AND lr2.status = 'approved'
                  AND lr2.start_date <= ss2.date AND lr2.end_date >= ss2.date
            )) DESC,
            oq.last_ot_event_at ASC NULLS FIRST,
            COALESCE(ot.hours_worked, 0.0) ASC,
            sr.overall_seniority_date ASC NULLS LAST
        "#,
        event.scheduled_shift_id,
        auth.org_id,
        fiscal_year,
        event.classification_id,
        cross_class_eligible,
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
            overall_seniority_date: r.overall_seniority_date,
            ot_hours: r.ot_hours.unwrap_or(0.0),
            is_available: r.is_available.unwrap_or(false),
            unavailable_reason: r.unavailable_reason,
            is_cross_class: r.is_cross_class,
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
    use validator::Validate;
    req.validate()?;

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
               ce.classification_id,
               ce.current_step AS "current_step?: CalloutStep",
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
        return Err(AppError::Conflict("Callout event is not open".into()));
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
            // Update OT queue position: stamp last_ot_event_at = NOW() so this user
            // moves toward the back of the queue for next callout.
            sqlx::query!(
                r#"
                INSERT INTO ot_queue_positions
                    (id, org_id, classification_id, user_id, last_ot_event_at, fiscal_year, updated_at)
                VALUES (gen_random_uuid(), $1, $2, $3, NOW(), $4, NOW())
                ON CONFLICT (org_id, classification_id, user_id, fiscal_year)
                DO UPDATE SET last_ot_event_at = NOW(), updated_at = NOW()
                "#,
                auth.org_id,
                ctx.classification_id,
                req.user_id,
                fiscal_year,
            )
            .execute(&mut *tx)
            .await?;

            // Mark the event filled.
            sqlx::query!(
                "UPDATE callout_events SET status = 'filled', updated_at = NOW() WHERE id = $1",
                event_id
            )
            .execute(&mut *tx)
            .await?;

            // Determine ot_type from the callout step.
            let ot_type = match ctx.current_step {
                Some(CalloutStep::Volunteers) => "voluntary",
                Some(CalloutStep::Mandatory) => "mandatory",
                _ => "elective",
            };

            // Create an OT assignment. Skip if the user is already on this shift.
            sqlx::query!(
                r#"
                INSERT INTO assignments
                    (id, scheduled_shift_id, user_id, is_overtime, created_by, ot_type)
                VALUES (gen_random_uuid(), $1, $2, true, $3, $4)
                ON CONFLICT (scheduled_shift_id, user_id) DO NOTHING
                "#,
                ctx.scheduled_shift_id,
                req.user_id,
                auth.id,
                ot_type,
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
            // Update OT queue position for declined too.
            sqlx::query!(
                r#"
                INSERT INTO ot_queue_positions
                    (id, org_id, classification_id, user_id, last_ot_event_at, fiscal_year, updated_at)
                VALUES (gen_random_uuid(), $1, $2, $3, NOW(), $4, NOW())
                ON CONFLICT (org_id, classification_id, user_id, fiscal_year)
                DO UPDATE SET last_ot_event_at = NOW(), updated_at = NOW()
                "#,
                auth.org_id,
                ctx.classification_id,
                req.user_id,
                fiscal_year,
            )
            .execute(&mut *tx)
            .await?;

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
        _ => {} // no_answer: no OT accounting change, no queue stamp
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

pub async fn cancel_ot_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // 1. Fetch event + shift timing.
    let event = sqlx::query!(
        r#"
        SELECT ce.status AS "status: CalloutStatus",
               ss.org_id, ss.date AS shift_date, st.start_time
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
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
    if event.status != CalloutStatus::Filled {
        return Err(AppError::Conflict(
            "Callout event is not in filled status".into(),
        ));
    }

    // 2. Find the active OT assignment for the user who accepted THIS callout event.
    let assignment = sqlx::query!(
        r#"
        SELECT a.id, a.user_id, a.ot_type, a.cancelled_at
        FROM assignments a
        JOIN callout_events ce ON ce.id = $1 AND ce.scheduled_shift_id = a.scheduled_shift_id
        JOIN callout_attempts ca ON ca.event_id = $1 AND ca.user_id = a.user_id AND ca.response = 'accepted'
        WHERE a.is_overtime = true AND a.cancelled_at IS NULL
        "#,
        event_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("No active OT assignment for this event".into()))?;

    // 3. Authorization: employees can only cancel their own assignment.
    if !auth.role.can_manage_schedule() && assignment.user_id != auth.id {
        return Err(AppError::Forbidden);
    }

    // 4. Skip enforcement for managers/supervisors.
    if !auth.role.can_manage_schedule() {
        // 5. Enforcement for non-managers.
        let shift_start = event.shift_date.with_time(event.start_time).assume_utc();
        let now = time::OffsetDateTime::now_utc();
        match assignment.ot_type.as_deref() {
            Some("voluntary") | Some("elective") => {
                let hours_until = (shift_start - now).whole_hours();
                if hours_until < 24 {
                    return Err(AppError::Conflict(
                        "Cannot cancel voluntary OT within 24 hours of shift start".into(),
                    ));
                }
            }
            Some("mandatory") => {
                if now < shift_start {
                    return Err(AppError::Conflict(
                        "Cannot cancel mandatory OT before shift start".into(),
                    ));
                }
                // now >= shift_start -> end-of-shift release, allowed
            }
            _ => {} // NULL ot_type or unknown -- allow (shouldn't happen)
        }
    }

    // 6+7 must be atomic: if the server crashes between them the event would be
    // permanently stuck in 'filled' with no active assignment.
    let mut tx = pool.begin().await?;

    // 6. Soft-cancel the assignment.
    sqlx::query!(
        "UPDATE assignments SET cancelled_at = NOW() WHERE id = $1",
        assignment.id
    )
    .execute(&mut *tx)
    .await?;

    // 7. Auto-reopen event so it re-enters the callout queue — in 911 dispatch,
    // lost OT coverage must be immediately re-callable without manual supervisor
    // intervention.
    sqlx::query!(
        "UPDATE callout_events SET status = 'open', updated_at = NOW() WHERE id = $1",
        event_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "ok": true })))
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

/// Submit a bump request to displace another employee from a filled OT callout event.
///
/// **Role check**: Any authenticated employee can submit — there is no supervisor gate.
/// The business gate is the OT queue priority comparison (step 5 below): the requesting
/// user must have strictly higher OT priority (fewer hours worked, or earlier queue
/// timestamp when hours are equal) than the displaced user. If they do not, the request
/// is rejected with a 409 Conflict.
///
/// This is intentional per the VCCEA contract — union members have the right to bump
/// lower-priority employees off OT assignments without requiring supervisor pre-approval.
/// A supervisor review step occurs *after* submission (see `review_bump_request`).
pub async fn create_bump_request(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
    Json(req): Json<CreateBumpRequest>,
) -> Result<Json<BumpRequest>> {
    use validator::Validate;
    req.validate()?;

    // 1. Fetch event context
    let event = sqlx::query!(
        r#"
        SELECT ce.status AS "status: CalloutStatus", ce.classification_id,
               ss.org_id, ss.date AS shift_date, ce.scheduled_shift_id
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
    if event.status != CalloutStatus::Filled {
        return Err(AppError::Conflict("Callout event is not filled".into()));
    }
    if req.displaced_user_id == auth.id {
        return Err(AppError::BadRequest("Cannot bump yourself".into()));
    }
    org_guard::verify_user(&pool, req.displaced_user_id, auth.org_id).await?;

    // 2. Verify displaced user has an active OT assignment for this event
    let has_ot = sqlx::query_scalar!(
        r#"
        SELECT a.user_id FROM assignments a
        WHERE a.scheduled_shift_id = $1 AND a.user_id = $2
          AND a.is_overtime = true AND a.cancelled_at IS NULL
        "#,
        event.scheduled_shift_id,
        req.displaced_user_id
    )
    .fetch_optional(&pool)
    .await?;

    if has_ot.is_none() {
        return Err(AppError::NotFound(
            "Displaced user has no active OT assignment for this event".into(),
        ));
    }

    // 3. No pending bump request already
    let pending_exists: bool = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM bump_requests WHERE event_id = $1 AND status = 'pending') AS "exists!""#,
        event_id
    )
    .fetch_one(&pool)
    .await?;

    if pending_exists {
        return Err(AppError::Conflict(
            "A bump request is already pending for this event".into(),
        ));
    }

    // 4. Timing check - shift must not have started
    let shift_info = sqlx::query!(
        r#"
        SELECT st.start_time FROM scheduled_shifts ss
        JOIN shift_templates st ON st.id = ss.shift_template_id
        WHERE ss.id = $1
        "#,
        event.scheduled_shift_id
    )
    .fetch_one(&pool)
    .await?;

    let shift_start = event
        .shift_date
        .with_time(shift_info.start_time)
        .assume_utc();
    if time::OffsetDateTime::now_utc() >= shift_start {
        return Err(AppError::Conflict(
            "Cannot request a bump after the shift has started".into(),
        ));
    }

    // 5. Priority check - requester must outrank displaced on the OT list
    let fiscal_year: i32 = event.shift_date.year();

    let priority = sqlx::query!(
        r#"
        SELECT
            COALESCE((SELECT CAST(hours_worked AS FLOAT8) FROM ot_hours
                      WHERE user_id = $1 AND fiscal_year = $3 AND classification_id IS NULL), 0.0) AS "req_hours!",
            (SELECT last_ot_event_at FROM ot_queue_positions
             WHERE user_id = $1 AND classification_id = $4 AND org_id = $2 AND fiscal_year = $3) AS req_queue,
            COALESCE((SELECT CAST(hours_worked AS FLOAT8) FROM ot_hours
                      WHERE user_id = $5 AND fiscal_year = $3 AND classification_id IS NULL), 0.0) AS "dis_hours!",
            (SELECT last_ot_event_at FROM ot_queue_positions
             WHERE user_id = $5 AND classification_id = $4 AND org_id = $2 AND fiscal_year = $3) AS dis_queue
        "#,
        auth.id,        // $1
        auth.org_id,    // $2
        fiscal_year,    // $3
        event.classification_id, // $4
        req.displaced_user_id,   // $5
    )
    .fetch_one(&pool)
    .await?;

    let requester_outranks = if (priority.req_hours - priority.dis_hours).abs() < f64::EPSILON {
        // Equal hours: check queue position
        match (&priority.req_queue, &priority.dis_queue) {
            (None, Some(_)) => true,         // requester never called = higher priority
            (Some(rq), Some(dq)) => rq < dq, // earlier timestamp = higher priority
            _ => false,
        }
    } else {
        priority.req_hours < priority.dis_hours
    };

    if !requester_outranks {
        return Err(AppError::Conflict(
            "Requesting user does not have higher OT priority than displaced user".into(),
        ));
    }

    // 6. Insert bump request
    let new_id = Uuid::new_v4();
    let bump = sqlx::query_as!(
        BumpRequest,
        r#"
        INSERT INTO bump_requests (id, org_id, event_id, requesting_user_id, displaced_user_id, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, org_id, event_id, requesting_user_id, displaced_user_id, status,
                  reason, created_at, reviewed_at, reviewed_by
        "#,
        new_id,
        auth.org_id,
        event_id,
        auth.id,
        req.displaced_user_id,
        req.reason,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(bump))
}

pub async fn review_bump_request(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<ReviewBumpRequest>,
) -> Result<Json<BumpRequest>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    use validator::Validate;
    req.validate()?;

    let mut tx = pool.begin().await?;

    // 1. Fetch + lock the bump request
    let br = sqlx::query_as!(
        BumpRequest,
        r#"
        SELECT br.id, br.org_id, br.event_id, br.requesting_user_id,
               br.displaced_user_id, br.status, br.reason, br.created_at,
               br.reviewed_at, br.reviewed_by
        FROM bump_requests br WHERE br.id = $1 FOR UPDATE
        "#,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Bump request not found".into()))?;

    if br.org_id != auth.org_id {
        return Err(AppError::NotFound("Bump request not found".into()));
    }
    if br.status != "pending" {
        return Err(AppError::Conflict(
            "Bump request has already been reviewed".into(),
        ));
    }

    // 2. Fetch the callout event's scheduled_shift_id
    let scheduled_shift_id = sqlx::query_scalar!(
        "SELECT scheduled_shift_id FROM callout_events WHERE id = $1",
        br.event_id
    )
    .fetch_one(&mut *tx)
    .await?;

    // Verify shift hasn't started and event is still filled
    let shift_check = sqlx::query!(
        r#"
        SELECT ss.date AS shift_date, st.start_time,
               ce.status AS "status: CalloutStatus"
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        WHERE ce.id = $1
        "#,
        br.event_id
    )
    .fetch_one(&mut *tx)
    .await?;

    if shift_check.status != CalloutStatus::Filled {
        return Err(AppError::Conflict(
            "Callout event is no longer filled".into(),
        ));
    }
    let shift_start = shift_check
        .shift_date
        .with_time(shift_check.start_time)
        .assume_utc();
    if time::OffsetDateTime::now_utc() >= shift_start {
        return Err(AppError::Conflict(
            "Cannot approve bump after the shift has started".into(),
        ));
    }

    if req.approved {
        // 3a. Re-verify requesting user is still active in this org.
        let requester_ok = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND org_id = $2 AND is_active = true)",
            br.requesting_user_id,
            auth.org_id,
        )
        .fetch_one(&mut *tx)
        .await?
        .unwrap_or(false);

        if !requester_ok {
            return Err(AppError::Conflict(
                "Requesting user is no longer active".into(),
            ));
        }

        // 3b. Fetch ot_type from displaced user's assignment, then cancel it.
        let displaced_ot_type: Option<String> = sqlx::query_scalar!(
            r#"
            SELECT ot_type FROM assignments
            WHERE scheduled_shift_id = $1 AND user_id = $2
              AND is_overtime = true AND cancelled_at IS NULL
            "#,
            scheduled_shift_id,
            br.displaced_user_id,
        )
        .fetch_optional(&mut *tx)
        .await?
        .flatten();

        let cancelled = sqlx::query!(
            r#"
            UPDATE assignments SET cancelled_at = NOW()
            WHERE scheduled_shift_id = $1 AND user_id = $2
              AND is_overtime = true AND cancelled_at IS NULL
            "#,
            scheduled_shift_id,
            br.displaced_user_id,
        )
        .execute(&mut *tx)
        .await?;

        if cancelled.rows_affected() == 0 {
            return Err(AppError::Conflict(
                "Displaced user's OT assignment is no longer active".into(),
            ));
        }

        // 3c. Insert new OT assignment for requester, copying ot_type from displaced.
        let inserted = sqlx::query!(
            r#"
            INSERT INTO assignments (id, scheduled_shift_id, user_id, is_overtime, created_by, ot_type)
            VALUES (gen_random_uuid(), $1, $2, true, $3, $4)
            ON CONFLICT (scheduled_shift_id, user_id) DO NOTHING
            "#,
            scheduled_shift_id,
            br.requesting_user_id,
            auth.id,
            displaced_ot_type,
        )
        .execute(&mut *tx)
        .await?;

        if inserted.rows_affected() == 0 {
            return Err(AppError::Conflict(
                "Requesting user already has an assignment for this shift".into(),
            ));
        }

        // 3d. Update bump request to approved
        sqlx::query!(
            r#"
            UPDATE bump_requests
            SET status = 'approved', reviewed_at = NOW(), reviewed_by = $2, reason = COALESCE($3, reason)
            WHERE id = $1
            "#,
            id,
            auth.id,
            req.reason,
        )
        .execute(&mut *tx)
        .await?;
    } else {
        // 4. Denied
        sqlx::query!(
            r#"
            UPDATE bump_requests
            SET status = 'denied', reviewed_at = NOW(), reviewed_by = $2, reason = COALESCE($3, reason)
            WHERE id = $1
            "#,
            id,
            auth.id,
            req.reason,
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // 5. Return the updated bump request
    let updated = sqlx::query_as!(
        BumpRequest,
        r#"
        SELECT id, org_id, event_id, requesting_user_id, displaced_user_id,
               status, reason, created_at, reviewed_at, reviewed_by
        FROM bump_requests WHERE id = $1
        "#,
        id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(updated))
}

pub async fn list_bump_requests(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<BumpRequestWithNames>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify event belongs to the user's org
    let event_org = sqlx::query_scalar!(
        "SELECT org_id FROM callout_events ce JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id WHERE ce.id = $1",
        event_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;

    if event_org != auth.org_id {
        return Err(AppError::NotFound("Callout event not found".into()));
    }

    let rows = sqlx::query_as!(
        BumpRequestWithNames,
        r#"
        SELECT br.id, br.event_id, br.requesting_user_id,
               ru.first_name AS requesting_user_first_name,
               ru.last_name  AS requesting_user_last_name,
               br.displaced_user_id,
               du.first_name AS displaced_user_first_name,
               du.last_name  AS displaced_user_last_name,
               br.status, br.reason, br.created_at, br.reviewed_at, br.reviewed_by
        FROM bump_requests br
        JOIN users ru ON ru.id = br.requesting_user_id
        JOIN users du ON du.id = br.displaced_user_id
        WHERE br.event_id = $1 AND br.org_id = $2
        ORDER BY br.created_at DESC
        "#,
        event_id,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}
