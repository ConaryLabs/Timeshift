use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    api::helpers::json_ok,
    auth::AuthUser,
    error::{AppError, Result},
    models::{
        callout::{
            BumpRequest, BumpRequestWithNames, CalloutAttempt, CalloutEvent, CalloutListEntry,
            CalloutStatus, CreateBumpRequest, CreateCalloutEventRequest, RecordAttemptRequest,
            ReviewBumpRequest,
        },
        common::{OtType, Paginated, PaginationParams},
        ot::CalloutStep,
    },
    org_guard,
    services::availability::compute_available_employees,
};

/// Fetch a single callout event by ID with org isolation.
///
/// Centralises the 25-line SELECT/JOIN used by `get_event` and the post-INSERT
/// fetch in `create_event`, so the query definition lives in one place.
async fn fetch_event_by_id(pool: &PgPool, event_id: Uuid, org_id: Uuid) -> Result<CalloutEvent> {
    sqlx::query_as!(
        CalloutEvent,
        r#"
        SELECT ce.id, ce.scheduled_shift_id, ce.initiated_by,
               ce.ot_reason_id, ce.reason_text, ce.classification_id,
               cl.name AS classification_name,
               ce.ot_request_id AS "ot_request_id?",
               ce.status AS "status: CalloutStatus",
               ce.current_step AS "current_step?: CalloutStep",
               ce.step_started_at AS "step_started_at?",
               st.name AS "shift_template_name?",
               ss.date AS "shift_date?",
               t.name AS "team_name?",
               (SELECT a.user_id FROM assignments a
                WHERE a.scheduled_shift_id = ce.scheduled_shift_id
                  AND a.is_overtime = true AND a.cancelled_at IS NULL
                LIMIT 1) AS "assigned_user_id?",
               (SELECT (u.first_name || ' ' || u.last_name) FROM assignments a
                JOIN users u ON u.id = a.user_id
                WHERE a.scheduled_shift_id = ce.scheduled_shift_id
                  AND a.is_overtime = true AND a.cancelled_at IS NULL
                LIMIT 1) AS "assigned_user_name?",
               ce.created_at, ce.updated_at
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        JOIN classifications cl ON cl.id = ce.classification_id
        LEFT JOIN shift_slots sl ON sl.id = ss.slot_id
        LEFT JOIN teams t ON t.id = sl.team_id
        WHERE ce.id = $1 AND ss.org_id = $2
        "#,
        event_id,
        org_id,
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))
}

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
               ce.ot_request_id AS "ot_request_id?",
               ce.status AS "status: CalloutStatus",
               ce.current_step AS "current_step?: CalloutStep",
               ce.step_started_at AS "step_started_at?",
               st.name AS "shift_template_name?",
               ss.date AS "shift_date?",
               t.name AS "team_name?",
               (SELECT a.user_id FROM assignments a
                WHERE a.scheduled_shift_id = ce.scheduled_shift_id
                  AND a.is_overtime = true AND a.cancelled_at IS NULL
                LIMIT 1) AS "assigned_user_id?",
               (SELECT (u.first_name || ' ' || u.last_name) FROM assignments a
                JOIN users u ON u.id = a.user_id
                WHERE a.scheduled_shift_id = ce.scheduled_shift_id
                  AND a.is_overtime = true AND a.cancelled_at IS NULL
                LIMIT 1) AS "assigned_user_name?",
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

    let event = fetch_event_by_id(&pool, id, auth.org_id).await?;
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
    if let Some(ot_req_id) = req.ot_request_id {
        org_guard::verify_ot_request(&pool, ot_req_id, auth.org_id).await?;
    }

    // Fix 2: Check for existing open callout event on the same shift before inserting.
    // The DB partial unique index (idx_callout_events_shift_open) also guards this,
    // but an explicit check gives a clearer error message.
    let existing_open: bool = sqlx::query_scalar!(
        r#"SELECT EXISTS(
            SELECT 1 FROM callout_events
            WHERE scheduled_shift_id = $1 AND status = 'open'
        ) AS "exists!""#,
        req.scheduled_shift_id,
    )
    .fetch_one(&pool)
    .await?;

    if existing_open {
        return Err(AppError::Conflict(
            "An open callout event already exists for this shift".into(),
        ));
    }

    let new_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO callout_events (id, scheduled_shift_id, initiated_by, ot_reason_id, reason_text, classification_id, ot_request_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
        "#,
        new_id,
        req.scheduled_shift_id,
        auth.id,
        req.ot_reason_id,
        req.reason_text,
        req.classification_id,
        req.ot_request_id,
    )
    .execute(&pool)
    .await?;

    let event = fetch_event_by_id(&pool, new_id, auth.org_id).await?;

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
        SELECT ce.scheduled_shift_id, ce.classification_id, ss.date AS shift_date,
               st.start_time AS shift_start_time, st.duration_minutes AS shift_duration
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        WHERE ce.id = $1 AND ss.org_id = $2
        "#,
        event_id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;

    let entries = compute_available_employees(
        &pool,
        auth.org_id,
        &auth.org_timezone,
        event.scheduled_shift_id,
        event.classification_id,
        event.shift_date,
        event.shift_start_time,
        event.shift_duration,
    )
    .await?;

    Ok(Json(entries))
}

/// Context fetched from the callout event row (locked FOR UPDATE) plus joined shift info.
struct CalloutEventCtx {
    #[allow(dead_code)] // Status is validated before ctx creation; kept for debugging
    status: CalloutStatus,
    scheduled_shift_id: Uuid,
    classification_id: Uuid,
    current_step: Option<CalloutStep>,
    ot_request_id: Option<Uuid>,
    shift_date: time::Date,
    duration_minutes: i32,
    shift_start_time: time::Time,
    shift_end_time: time::Time,
}

/// Handle an accepted callout attempt:
/// - Check CBA 10-hour rest protection for mandatory OT
/// - Stamp OT queue (user moves toward back)
/// - Mark event as filled
/// - Create OT assignment
/// - Upsert hours_worked
/// - Mark linked OT request as filled (if any)
async fn handle_attempt_accepted(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    event_id: Uuid,
    user_id: Uuid,
    supervisor_id: Uuid,
    org_id: Uuid,
    fiscal_year: i32,
    ctx: &CalloutEventCtx,
) -> Result<()> {
    let shift_hours = ctx.duration_minutes as f64 / 60.0;

    // CBA: 10-hour rest protection (CBA § 4.4.3) — verify at least 10 hours
    // between the end of this OT shift and the employee's next regular shift.
    // Applies to ALL OT types (voluntary, elective, mandatory), not just mandatory.
    crate::services::ot::check_10_hour_rest_gap(
        tx, user_id, org_id, ctx.shift_date, ctx.shift_start_time, ctx.shift_end_time,
    ).await?;

    // Stamp queue position so this user moves toward the back for next callout.
    crate::services::ot::stamp_ot_queue(
        tx, org_id, ctx.classification_id, user_id, fiscal_year,
    ).await?;

    // Mark the event filled.
    sqlx::query!(
        "UPDATE callout_events SET status = 'filled', updated_at = NOW() WHERE id = $1",
        event_id
    )
    .execute(&mut **tx)
    .await?;

    // CBA: OT type is determined by which callout step the employee accepted from.
    // Voluntary = accepted during volunteer step; Mandatory = assigned during mandatory step.
    let ot_type = match ctx.current_step {
        Some(CalloutStep::Volunteers) => OtType::Voluntary,
        Some(CalloutStep::Mandatory) => OtType::Mandatory,
        _ => OtType::Elective,
    };
    let ot_type_str = ot_type.to_string();

    // Create an OT assignment. Skip if the user is already on this shift.
    sqlx::query!(
        r#"
                INSERT INTO assignments
                    (id, scheduled_shift_id, user_id, is_overtime, created_by, ot_type)
                VALUES (gen_random_uuid(), $1, $2, true, $3, $4)
                ON CONFLICT (scheduled_shift_id, user_id) DO NOTHING
                "#,
        ctx.scheduled_shift_id,
        user_id,
        supervisor_id,
        ot_type_str,
    )
    .execute(&mut **tx)
    .await?;

    // Upsert OT hours_worked for this user/year/classification.
    crate::services::ot::upsert_ot_hours_worked(
        tx, user_id, fiscal_year, ctx.classification_id, shift_hours,
    ).await?;

    // If this callout is linked to an OT request, mark it as filled.
    if let Some(ot_req_id) = ctx.ot_request_id {
        sqlx::query!(
            r#"
                    UPDATE ot_requests
                    SET status = 'filled', updated_at = NOW()
                    WHERE id = $1 AND status != 'cancelled'
                    "#,
            ot_req_id,
        )
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

/// Handle a declined callout attempt:
/// - Stamp OT queue (CBA: employee was contacted and moves to back regardless of response)
/// - Upsert hours_declined
async fn handle_attempt_declined(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    org_id: Uuid,
    fiscal_year: i32,
    ctx: &CalloutEventCtx,
) -> Result<()> {
    let shift_hours = ctx.duration_minutes as f64 / 60.0;

    // CBA: Declining OT still stamps the queue position — the employee was contacted
    // and moves to the back of the queue regardless of their response.
    crate::services::ot::stamp_ot_queue(
        tx, org_id, ctx.classification_id, user_id, fiscal_year,
    ).await?;

    // Upsert OT hours_declined for this user/year/classification.
    crate::services::ot::upsert_ot_hours_declined(
        tx, user_id, fiscal_year, ctx.classification_id, shift_hours,
    ).await?;

    Ok(())
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
    let raw = sqlx::query!(
        r#"
        SELECT ce.status AS "status: CalloutStatus", ce.scheduled_shift_id,
               ce.classification_id,
               ce.current_step AS "current_step?: CalloutStep",
               ce.ot_request_id,
               ss.date AS shift_date, st.duration_minutes,
               st.start_time AS shift_start_time, st.end_time AS shift_end_time
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates  st ON st.id = ss.shift_template_id
        WHERE ce.id = $1 AND ss.org_id = $2
        FOR UPDATE OF ce
        "#,
        event_id,
        auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;

    if raw.status != CalloutStatus::Open {
        return Err(AppError::Conflict("Callout event is not open".into()));
    }

    let ctx = CalloutEventCtx {
        status: raw.status,
        scheduled_shift_id: raw.scheduled_shift_id,
        classification_id: raw.classification_id,
        current_step: raw.current_step,
        ot_request_id: raw.ot_request_id,
        shift_date: raw.shift_date,
        duration_minutes: raw.duration_minutes,
        shift_start_time: raw.shift_start_time,
        shift_end_time: raw.shift_end_time,
    };

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

    let fiscal_year = crate::services::ot::org_fiscal_year(&pool, auth.org_id, ctx.shift_date).await;

    // 3. Snapshot current OT hours_worked at contact time (0 if no row yet).
    let ot_snapshot: f64 = sqlx::query_scalar!(
        r#"
        SELECT CAST(hours_worked AS FLOAT8)
        FROM ot_hours
        WHERE user_id = $1 AND fiscal_year = $2 AND classification_id = $3
        "#,
        req.user_id,
        fiscal_year,
        ctx.classification_id,
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

    // 6. Dispatch to the appropriate outcome handler.
    match req.response.as_str() {
        "accepted" => {
            handle_attempt_accepted(
                &mut tx, event_id, req.user_id, auth.id, auth.org_id, fiscal_year, &ctx,
            ).await?;
        }
        "declined" => {
            handle_attempt_declined(
                &mut tx, req.user_id, auth.org_id, fiscal_year, &ctx,
            ).await?;
        }
        // "no_answer" — CBA: no queue stamp; nothing to do beyond the attempt row itself.
        _ => {}
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
    // All checks and mutations must be in a single transaction to prevent a
    // concurrent cancellation from slipping through between the status check
    // and the actual cancel.
    let mut tx = pool.begin().await?;

    // 1. Fetch event + shift timing (FOR UPDATE to prevent concurrent cancel).
    let event = sqlx::query!(
        r#"
        SELECT ce.status AS "status: CalloutStatus",
               ce.ot_request_id,
               ce.classification_id,
               ss.date AS shift_date, st.start_time, st.duration_minutes
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        WHERE ce.id = $1 AND ss.org_id = $2
        FOR UPDATE OF ce
        "#,
        event_id,
        auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;
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
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id AND ss.org_id = $2
        JOIN callout_attempts ca ON ca.event_id = $1 AND ca.user_id = a.user_id AND ca.response = 'accepted'
        WHERE a.is_overtime = true AND a.cancelled_at IS NULL
        FOR UPDATE OF a
        "#,
        event_id,
        auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("No active OT assignment for this event".into()))?;

    // 3. Authorization: employees can only cancel their own assignment.
    if !auth.role.can_manage_schedule() && assignment.user_id != auth.id {
        return Err(AppError::Forbidden);
    }

    // CBA: Supervisors can cancel any OT assignment; employees have restrictions.
    if !auth.role.can_manage_schedule() {
        // CBA: Voluntary/elective OT can be cancelled with advance notice (configurable window).
        // Mandatory OT cannot be cancelled before the shift — only released after it starts.
        let shift_start = crate::services::timezone::local_to_utc(
            event.shift_date,
            event.start_time,
            &auth.org_timezone,
        );
        let now = time::OffsetDateTime::now_utc();
        let cancel_window = crate::services::org_settings::get_i64(
            &pool,
            auth.org_id,
            "voluntary_ot_cancel_hours",
            24,
        )
        .await;
        match assignment.ot_type.as_deref() {
            Some("voluntary" | "elective") => {
                let hours_until = (shift_start - now).whole_hours();
                if hours_until < cancel_window {
                    return Err(AppError::Conflict(format!(
                        "Cannot cancel voluntary OT within {cancel_window} hours of shift start"
                    )));
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

    // 6. Soft-cancel the assignment.
    sqlx::query!(
        "UPDATE assignments SET cancelled_at = NOW() WHERE id = $1",
        assignment.id
    )
    .execute(&mut *tx)
    .await?;

    // 6b. Reverse OT hours_worked for the cancelled assignment.
    let shift_hours = event.duration_minutes as f64 / 60.0;
    let fiscal_year = crate::services::ot::org_fiscal_year(&pool, auth.org_id, event.shift_date).await;

    crate::services::ot::revert_ot_hours_worked(
        &mut tx, assignment.user_id, fiscal_year, Some(event.classification_id), shift_hours,
    ).await?;

    // 7. Auto-reopen event so it re-enters the callout queue — in 911 dispatch,
    // lost OT coverage must be immediately re-callable without manual supervisor
    // intervention.
    sqlx::query!(
        "UPDATE callout_events SET status = 'open', updated_at = NOW() WHERE id = $1",
        event_id
    )
    .execute(&mut *tx)
    .await?;

    // 8. If linked to an OT request, reopen it so it can be re-filled.
    if let Some(ot_req_id) = event.ot_request_id {
        sqlx::query!(
            r#"
            UPDATE ot_requests
            SET status = 'open', updated_at = NOW()
            WHERE id = $1 AND status = 'filled'
            "#,
            ot_req_id,
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(json_ok())
}

pub async fn cancel_event(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let mut tx = pool.begin().await?;

    // Fetch the event's current status before updating so we can handle
    // filled-event cancellation (cancel OT assignment + revert hours).
    let event = sqlx::query!(
        r#"
        SELECT ce.status AS "status: CalloutStatus",
               ce.classification_id,
               ce.scheduled_shift_id,
               ss.date AS shift_date,
               st.duration_minutes
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        WHERE ce.id = $1
          AND ss.org_id = $2
          AND ce.status IN ('open', 'filled')
        FOR UPDATE OF ce
        "#,
        event_id,
        auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Event not found or already cancelled".into()))?;

    // Fix 3: When cancelling a filled event, also cancel the active OT assignment
    // and revert the OT hours for the assigned employee.
    if event.status == CalloutStatus::Filled {
        // Find and cancel the active OT assignment linked to this event.
        let assignment = sqlx::query!(
            r#"
            SELECT a.id, a.user_id
            FROM assignments a
            JOIN callout_attempts ca ON ca.event_id = $1
                AND ca.user_id = a.user_id AND ca.response = 'accepted'
            WHERE a.scheduled_shift_id = $2
              AND a.is_overtime = true AND a.cancelled_at IS NULL
            LIMIT 1
            "#,
            event_id,
            event.scheduled_shift_id,
        )
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(asgn) = assignment {
            // Soft-cancel the assignment.
            sqlx::query!(
                "UPDATE assignments SET cancelled_at = NOW() WHERE id = $1",
                asgn.id
            )
            .execute(&mut *tx)
            .await?;

            // Revert OT hours_worked for the cancelled assignment.
            let shift_hours = event.duration_minutes as f64 / 60.0;
            let fiscal_year = crate::services::ot::org_fiscal_year(
                &pool, auth.org_id, event.shift_date,
            ).await;

            crate::services::ot::revert_ot_hours_worked(
                &mut tx, asgn.user_id, fiscal_year,
                Some(event.classification_id), shift_hours,
            ).await?;
        }
    }

    // Set the event to cancelled.
    sqlx::query!(
        "UPDATE callout_events SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
        event_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(json_ok())
}

/// Submit a bump request to displace another employee from a filled OT callout event.
///
/// **Role check**: Any authenticated employee can submit — there is no supervisor gate.
/// The business gate is the OT queue priority comparison (step 5 below): the requesting
/// user must have strictly higher OT priority (fewer hours worked, or earlier queue
/// timestamp when hours are equal) than the displaced user. If they do not, the request
/// is rejected with a 409 Conflict.
///
/// This is intentional per the CBA — union members have the right to bump
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

    let mut tx = pool.begin().await?;

    // 1. Fetch event context (FOR UPDATE to prevent concurrent bump submissions)
    let event = sqlx::query!(
        r#"
        SELECT ce.status AS "status: CalloutStatus", ce.classification_id,
               ss.date AS shift_date, ce.scheduled_shift_id
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        WHERE ce.id = $1 AND ss.org_id = $2
        FOR UPDATE OF ce
        "#,
        event_id,
        auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;
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
    .fetch_optional(&mut *tx)
    .await?;

    if has_ot.is_none() {
        return Err(AppError::NotFound(
            "Displaced user has no active OT assignment for this event".into(),
        ));
    }

    // 2b. CBA: classification crossing prohibition — cannot bump across classifications
    let requester_class = sqlx::query_scalar!(
        "SELECT classification_id FROM users WHERE id = $1",
        auth.id
    )
    .fetch_one(&mut *tx)
    .await?;

    let displaced_class = sqlx::query_scalar!(
        "SELECT classification_id FROM users WHERE id = $1",
        req.displaced_user_id
    )
    .fetch_one(&mut *tx)
    .await?;

    if requester_class != displaced_class {
        return Err(AppError::BadRequest(
            "Cannot bump across classifications — requester and displaced employee \
             must hold the same classification."
                .into(),
        ));
    }

    // 2c. CBA: holiday bump prohibition — bumping is not allowed on holidays
    let is_holiday = sqlx::query_scalar!(
        r#"SELECT EXISTS(
            SELECT 1 FROM holiday_calendar
            WHERE org_id = $1 AND date = $2
        ) AS "exists!""#,
        auth.org_id,
        event.shift_date,
    )
    .fetch_one(&mut *tx)
    .await?;

    if is_holiday {
        return Err(AppError::BadRequest(
            "Bump requests are not allowed on holidays.".into(),
        ));
    }

    // 3. No pending bump request already (also guarded by partial unique index
    // idx_bump_requests_one_pending_per_event from migration 0021)
    let pending_exists: bool = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM bump_requests WHERE event_id = $1 AND status = 'pending') AS "exists!""#,
        event_id
    )
    .fetch_one(&mut *tx)
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
    .fetch_one(&mut *tx)
    .await?;

    let shift_start = crate::services::timezone::local_to_utc(
        event.shift_date,
        shift_info.start_time,
        &auth.org_timezone,
    );
    let now = time::OffsetDateTime::now_utc();
    if now >= shift_start {
        return Err(AppError::Conflict(
            "Cannot request a bump after the shift has started".into(),
        ));
    }
    // CBA (CBA Article 15.9): Bump requests must be submitted before the deadline.
    let bump_deadline =
        crate::services::org_settings::get_i64(&pool, auth.org_id, "bump_deadline_hours", 24).await;
    let hours_until = (shift_start - now).whole_hours();
    if hours_until < bump_deadline {
        return Err(AppError::BadRequest(format!(
            "Bump requests must be submitted at least {bump_deadline} hours before shift start"
        )));
    }

    // 5. CBA (CBA Article 15.9): Bump priority check — requester must have strictly
    // higher OT priority (fewer hours worked, or earlier queue timestamp if hours equal)
    // than the displaced user. This ensures equitable OT distribution.
    let fiscal_year = crate::services::ot::org_fiscal_year(&pool, auth.org_id, event.shift_date).await;

    let priority = sqlx::query!(
        r#"
        SELECT
            COALESCE((SELECT CAST(hours_worked AS FLOAT8) FROM ot_hours
                      WHERE user_id = $1 AND fiscal_year = $3 AND classification_id = $4), 0.0) AS "req_hours!",
            (SELECT last_ot_event_at FROM ot_queue_positions
             WHERE user_id = $1 AND classification_id = $4 AND org_id = $2 AND fiscal_year = $3) AS req_queue,
            COALESCE((SELECT CAST(hours_worked AS FLOAT8) FROM ot_hours
                      WHERE user_id = $5 AND fiscal_year = $3 AND classification_id = $4), 0.0) AS "dis_hours!",
            (SELECT last_ot_event_at FROM ot_queue_positions
             WHERE user_id = $5 AND classification_id = $4 AND org_id = $2 AND fiscal_year = $3) AS dis_queue
        "#,
        auth.id,        // $1
        auth.org_id,    // $2
        fiscal_year,    // $3
        event.classification_id, // $4
        req.displaced_user_id,   // $5
    )
    .fetch_one(&mut *tx)
    .await?;

    // CBA: Priority comparison — lowest hours worked wins. If equal, earliest queue
    // timestamp wins. NULL timestamp (never contacted) = highest priority.
    let requester_outranks = if (priority.req_hours - priority.dis_hours).abs() < f64::EPSILON {
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
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

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
        FROM bump_requests br WHERE br.id = $1 AND br.org_id = $2 FOR UPDATE
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Bump request not found".into()))?;
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

    // Verify shift hasn't started and event is still filled; also fetch classification
    // and duration for OT hour accounting on bump approval.
    let shift_check = sqlx::query!(
        r#"
        SELECT ss.date AS shift_date, st.start_time,
               ce.status AS "status: CalloutStatus",
               ce.classification_id,
               st.duration_minutes
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
    let shift_start = crate::services::timezone::local_to_utc(
        shift_check.shift_date,
        shift_check.start_time,
        &auth.org_timezone,
    );
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

        // 3d. Update OT hours and queue positions for the bump swap.
        let shift_hours = shift_check.duration_minutes as f64 / 60.0;
        let fiscal_year = crate::services::ot::org_fiscal_year(
            &pool, auth.org_id, shift_check.shift_date,
        ).await;

        // Revert displaced user's OT hours (they're no longer working this shift).
        crate::services::ot::revert_ot_hours_worked(
            &mut tx, br.displaced_user_id, fiscal_year,
            Some(shift_check.classification_id), shift_hours,
        ).await?;

        // Credit requesting user's OT hours (they're taking over the shift).
        crate::services::ot::upsert_ot_hours_worked(
            &mut tx, br.requesting_user_id, fiscal_year,
            shift_check.classification_id, shift_hours,
        ).await?;

        // Stamp requesting user's queue position (they were contacted/assigned OT).
        crate::services::ot::stamp_ot_queue(
            &mut tx, auth.org_id, shift_check.classification_id,
            br.requesting_user_id, fiscal_year,
        ).await?;

        // 3e. Restore displaced user's queue position — they were bumped off, not
        // contacted for new OT, so their last_ot_event_at should be reset.
        sqlx::query!(
            r#"
            UPDATE ot_queue_positions
            SET last_ot_event_at = NULL, updated_at = NOW()
            WHERE user_id = $1 AND classification_id = $2 AND org_id = $3 AND fiscal_year = $4
            "#,
            br.displaced_user_id,
            shift_check.classification_id,
            auth.org_id,
            fiscal_year,
        )
        .execute(&mut *tx)
        .await?;

        // 3f. Update bump request to approved
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
    sqlx::query_scalar!(
        "SELECT ce.id FROM callout_events ce JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id WHERE ce.id = $1 AND ss.org_id = $2",
        event_id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;

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
