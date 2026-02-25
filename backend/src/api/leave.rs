use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    api::notifications::{create_notification, CreateNotificationParams},
    auth::AuthUser,
    error::{AppError, Result},
    models::{
        common::PaginationParams,
        leave::{
            BulkReviewLeaveRequest, CreateLeaveRequest, LeaveRequest, LeaveRequestLine,
            LeaveSegment, LeaveStatus, LeaveTypeRecord, ReviewLeaveRequest,
        },
    },
    services::leave::{create_fmla_segments, deduct_leave_balance, refund_leave_balance},
};

/// Fetch segments for a leave request (empty vec if none).
async fn fetch_segments(pool: &PgPool, leave_request_id: Uuid) -> Result<Vec<LeaveSegment>> {
    let rows = sqlx::query!(
        r#"
        SELECT lrs.id, lrs.leave_type_id, lt.code AS leave_type_code, lt.name AS leave_type_name,
               CAST(lrs.hours AS FLOAT8) AS "hours!", lrs.sort_order
        FROM leave_request_segments lrs
        JOIN leave_types lt ON lt.id = lrs.leave_type_id
        WHERE lrs.leave_request_id = $1
        ORDER BY lrs.sort_order
        "#,
        leave_request_id,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| LeaveSegment {
            id: r.id,
            leave_type_id: r.leave_type_id,
            leave_type_code: r.leave_type_code,
            leave_type_name: r.leave_type_name,
            hours: r.hours,
            sort_order: r.sort_order,
        })
        .collect())
}

/// Fetch per-day lines for a leave request (empty vec if none).
async fn fetch_lines(pool: &PgPool, leave_request_id: Uuid) -> Result<Vec<LeaveRequestLine>> {
    let rows = sqlx::query!(
        r#"
        SELECT id, date, start_time, end_time, CAST(hours AS FLOAT8) AS "hours!"
        FROM leave_request_lines
        WHERE leave_request_id = $1
        ORDER BY date
        "#,
        leave_request_id,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| LeaveRequestLine {
            id: r.id,
            date: r.date,
            start_time: r.start_time,
            end_time: r.end_time,
            hours: r.hours,
        })
        .collect())
}

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<LeaveRequest>>> {
    let is_manager = auth.role.can_approve_leave();
    let rows = sqlx::query!(
        r#"
        SELECT lr.id, lr.user_id,
               u.first_name, u.last_name,
               lr.leave_type_id,
               lt.code AS leave_type_code, lt.name AS leave_type_name,
               lr.start_date, lr.end_date,
               lr.hours::FLOAT8 AS hours,
               lr.start_time,
               lr.scheduled_shift_id,
               lr.is_rdo,
               lr.reason,
               lr.emergency_contact,
               lr.bereavement_relationship,
               lr.bereavement_name,
               lr.status AS "status: LeaveStatus",
               lr.reviewed_by, lr.reviewer_notes, lr.created_at, lr.updated_at
        FROM leave_requests lr
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        JOIN users u ON u.id = lr.user_id
        WHERE u.org_id = $1
          AND lr.org_id = $1
          AND ($2 OR lr.user_id = $3)
        ORDER BY lr.created_at DESC
        LIMIT $4 OFFSET $5
        "#,
        auth.org_id,
        is_manager,
        auth.id,
        params.limit(),
        params.offset(),
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| LeaveRequest {
            id: r.id,
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            leave_type_id: r.leave_type_id,
            leave_type_code: r.leave_type_code,
            leave_type_name: r.leave_type_name,
            start_date: r.start_date,
            end_date: r.end_date,
            hours: r.hours,
            start_time: r.start_time,
            scheduled_shift_id: r.scheduled_shift_id,
            is_rdo: r.is_rdo,
            reason: r.reason,
            emergency_contact: r.emergency_contact,
            bereavement_relationship: r.bereavement_relationship,
            bereavement_name: r.bereavement_name,
            status: r.status,
            reviewed_by: r.reviewed_by,
            reviewer_notes: r.reviewer_notes,
            created_at: r.created_at,
            updated_at: r.updated_at,
            segments: vec![],
            lines: vec![],
        })
        .collect();

    Ok(Json(result))
}

pub async fn get_one(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<LeaveRequest>> {
    let r = sqlx::query!(
        r#"
        SELECT lr.id, lr.user_id,
               u.first_name, u.last_name,
               lr.leave_type_id,
               lt.code AS leave_type_code, lt.name AS leave_type_name,
               lr.start_date, lr.end_date,
               lr.hours::FLOAT8 AS hours,
               lr.start_time,
               lr.scheduled_shift_id,
               lr.is_rdo,
               lr.reason,
               lr.emergency_contact,
               lr.bereavement_relationship,
               lr.bereavement_name,
               lr.status AS "status: LeaveStatus",
               lr.reviewed_by, lr.reviewer_notes, lr.created_at, lr.updated_at
        FROM leave_requests lr
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        JOIN users u ON u.id = lr.user_id
        WHERE lr.id = $1 AND lr.org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Leave request not found".into()))?;

    if !auth.role.can_approve_leave() && r.user_id != auth.id {
        return Err(AppError::Forbidden);
    }

    let segments = fetch_segments(&pool, r.id).await?;
    let lines = fetch_lines(&pool, r.id).await?;

    Ok(Json(LeaveRequest {
        id: r.id,
        user_id: r.user_id,
        first_name: r.first_name,
        last_name: r.last_name,
        leave_type_id: r.leave_type_id,
        leave_type_code: r.leave_type_code,
        leave_type_name: r.leave_type_name,
        start_date: r.start_date,
        end_date: r.end_date,
        hours: r.hours,
        start_time: r.start_time,
        scheduled_shift_id: r.scheduled_shift_id,
        is_rdo: r.is_rdo,
        reason: r.reason,
        emergency_contact: r.emergency_contact,
        bereavement_relationship: r.bereavement_relationship,
        bereavement_name: r.bereavement_name,
        status: r.status,
        reviewed_by: r.reviewed_by,
        reviewer_notes: r.reviewer_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
        segments,
        lines,
    }))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateLeaveRequest>,
) -> Result<Json<LeaveRequest>> {
    use validator::Validate;
    body.validate()?;

    if body.end_date < body.start_date {
        return Err(AppError::BadRequest(
            "end_date must be >= start_date".into(),
        ));
    }

    if let Some(hours) = body.hours {
        if hours <= 0.0 || hours > 744.0 {
            return Err(AppError::BadRequest(
                "hours must be between 0 and 744".into(),
            ));
        }
    }

    if (body.end_date - body.start_date).whole_days() > 365 {
        return Err(AppError::BadRequest(
            "Leave request cannot span more than 365 days".into(),
        ));
    }

    // Validate manual segments if provided
    if let Some(ref segments) = body.segments {
        if segments.is_empty() {
            return Err(AppError::BadRequest(
                "segments array must not be empty if provided".into(),
            ));
        }
        if segments.len() > 5 {
            return Err(AppError::BadRequest("Maximum 5 segments allowed".into()));
        }
        for seg in segments {
            if seg.hours <= 0.0 {
                return Err(AppError::BadRequest(
                    "Each segment must have hours > 0".into(),
                ));
            }
        }
        // Segment hours must sum to request hours
        if let Some(total_hours) = body.hours {
            let seg_total: f64 = segments.iter().map(|s| s.hours).sum();
            if (seg_total - total_hours).abs() > 0.01 {
                return Err(AppError::BadRequest(format!(
                    "Segment hours ({:.2}) must equal request hours ({:.2})",
                    seg_total, total_hours
                )));
            }
        }
    }

    // Validate lines if provided
    if let Some(ref lines) = body.lines {
        for line in lines {
            if line.hours <= 0.0 {
                return Err(AppError::BadRequest("Each line must have hours > 0".into()));
            }
            if line.date < body.start_date || line.date > body.end_date {
                return Err(AppError::BadRequest(format!(
                    "Line date {} is outside request range",
                    line.date
                )));
            }
        }
    }

    // Verify leave type belongs to caller's org and is active
    let lt_ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM leave_types WHERE id = $1 AND org_id = $2 AND is_active = true)",
        body.leave_type_id,
        auth.org_id
    )
    .fetch_one(&pool)
    .await?;
    if !lt_ok.unwrap_or(false) {
        return Err(AppError::NotFound("Leave type not found".into()));
    }

    // Verify scheduled_shift_id if provided
    if let Some(shift_id) = body.scheduled_shift_id {
        let shift_ok = sqlx::query_scalar!(
            r#"SELECT EXISTS(
                SELECT 1 FROM scheduled_shifts ss
                JOIN shift_templates st ON st.id = ss.shift_template_id
                WHERE ss.id = $1 AND st.org_id = $2
            )"#,
            shift_id,
            auth.org_id,
        )
        .fetch_one(&pool)
        .await?;
        if !shift_ok.unwrap_or(false) {
            return Err(AppError::NotFound("Scheduled shift not found".into()));
        }
    }

    // Verify segment leave types belong to caller's org
    if let Some(ref segments) = body.segments {
        for seg in segments {
            let seg_ok = sqlx::query_scalar!(
                "SELECT EXISTS(SELECT 1 FROM leave_types WHERE id = $1 AND org_id = $2 AND is_active = true)",
                seg.leave_type_id,
                auth.org_id,
            )
            .fetch_one(&pool)
            .await?;
            if !seg_ok.unwrap_or(false) {
                return Err(AppError::NotFound(format!(
                    "Segment leave type {} not found",
                    seg.leave_type_id
                )));
            }
        }
    }

    // Get leave type code/name and creator name
    let lt = sqlx::query!(
        "SELECT code, name FROM leave_types WHERE id = $1",
        body.leave_type_id
    )
    .fetch_one(&pool)
    .await?;

    let creator = sqlx::query!(
        "SELECT first_name, last_name FROM users WHERE id = $1",
        auth.id
    )
    .fetch_one(&pool)
    .await?;

    let mut tx = pool.begin().await?;

    // Check for overlapping leave requests (only pending/approved block new ones)
    let overlap = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM leave_requests
            WHERE user_id = $1
              AND status IN ('pending', 'approved')
              AND start_date <= $3
              AND end_date >= $2
              AND org_id = $4
        )
        "#,
        auth.id,
        body.start_date,
        body.end_date,
        auth.org_id,
    )
    .fetch_one(&mut *tx)
    .await?;
    if overlap.unwrap_or(false) {
        return Err(AppError::Conflict(
            "Leave request overlaps with an existing request".into(),
        ));
    }

    let leave_request_id = Uuid::new_v4();
    let r = sqlx::query!(
        r#"
        INSERT INTO leave_requests
            (id, user_id, leave_type_id, start_date, end_date, hours,
             start_time, scheduled_shift_id, is_rdo,
             reason, emergency_contact, bereavement_relationship, bereavement_name,
             status, org_id)
        VALUES ($1, $2, $3, $4, $5, $6::FLOAT8::NUMERIC,
                $7, $8, $9,
                $10, $11, $12, $13,
                'pending', $14)
        RETURNING id, user_id, leave_type_id, start_date, end_date,
                  hours::FLOAT8 AS hours, start_time,
                  scheduled_shift_id, is_rdo,
                  reason, emergency_contact, bereavement_relationship, bereavement_name,
                  status AS "status: LeaveStatus",
                  reviewed_by, reviewer_notes, created_at, updated_at
        "#,
        leave_request_id,
        auth.id,
        body.leave_type_id,
        body.start_date,
        body.end_date,
        body.hours,
        body.start_time,
        body.scheduled_shift_id,
        body.is_rdo,
        body.reason,
        body.emergency_contact,
        body.bereavement_relationship,
        body.bereavement_name,
        auth.org_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    // Handle segments: manual split coding takes priority over auto-FMLA
    if let Some(ref segments) = body.segments {
        for (i, seg) in segments.iter().enumerate() {
            sqlx::query!(
                r#"
                INSERT INTO leave_request_segments (leave_request_id, leave_type_id, hours, sort_order)
                VALUES ($1, $2, $3::FLOAT8::NUMERIC, $4)
                "#,
                leave_request_id,
                seg.leave_type_id,
                seg.hours,
                i as i32,
            )
            .execute(&mut *tx)
            .await?;
        }
    } else {
        // Auto-create FMLA priority segments for FMLA leave types when hours are specified
        let is_fmla = lt.code.starts_with("fmla_");
        if is_fmla {
            if let Some(total_hours) = body.hours {
                create_fmla_segments(&mut tx, leave_request_id, auth.org_id, auth.id, total_hours)
                    .await?;
            }
        }
    }

    // Generate leave_request_lines
    if let Some(ref lines) = body.lines {
        // Use client-provided lines
        for line in lines {
            sqlx::query!(
                r#"
                INSERT INTO leave_request_lines (leave_request_id, date, start_time, end_time, hours)
                VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC)
                "#,
                leave_request_id,
                line.date,
                line.start_time,
                line.end_time,
                line.hours,
            )
            .execute(&mut *tx)
            .await?;
        }
    } else if let Some(total_hours) = body.hours {
        // Auto-generate lines: distribute hours across each date in the range
        let days = (body.end_date - body.start_date).whole_days() + 1;
        let per_day = total_hours / days as f64;
        let mut current = body.start_date;
        while current <= body.end_date {
            sqlx::query!(
                r#"
                INSERT INTO leave_request_lines (leave_request_id, date, start_time, end_time, hours)
                VALUES ($1, $2, $3, NULL, $4::FLOAT8::NUMERIC)
                "#,
                leave_request_id,
                current,
                body.start_time,
                per_day,
            )
            .execute(&mut *tx)
            .await?;
            let prev = current;
            current = current.next_day().unwrap_or(current);
            if current == prev {
                break; // safety: overflow guard (next_day returned None)
            }
        }
    }

    tx.commit().await?;

    let segments = fetch_segments(&pool, leave_request_id).await?;
    let lines = fetch_lines(&pool, leave_request_id).await?;

    Ok(Json(LeaveRequest {
        id: r.id,
        user_id: r.user_id,
        first_name: creator.first_name,
        last_name: creator.last_name,
        leave_type_id: r.leave_type_id,
        leave_type_code: lt.code,
        leave_type_name: lt.name,
        start_date: r.start_date,
        end_date: r.end_date,
        hours: r.hours,
        start_time: r.start_time,
        scheduled_shift_id: r.scheduled_shift_id,
        is_rdo: r.is_rdo,
        reason: r.reason,
        emergency_contact: r.emergency_contact,
        bereavement_relationship: r.bereavement_relationship,
        bereavement_name: r.bereavement_name,
        status: r.status,
        reviewed_by: r.reviewed_by,
        reviewer_notes: r.reviewer_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
        segments,
        lines,
    }))
}

pub async fn cancel(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let can_cancel_others = auth.role.can_approve_leave();

    let mut tx = pool.begin().await?;

    let request = sqlx::query!(
        r#"
        SELECT lr.id, lr.user_id, lr.leave_type_id,
               lr.hours::FLOAT8 AS hours,
               lr.status AS "status: LeaveStatus"
        FROM leave_requests lr
        WHERE lr.id = $1 AND lr.org_id = $2
          AND lr.status IN ('pending', 'approved')
          AND ($3 OR lr.user_id = $4)
        FOR UPDATE OF lr
        "#,
        id,
        auth.org_id,
        can_cancel_others,
        auth.id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::NotFound(
            "Leave request not found or cannot be cancelled (already denied or cancelled)".into(),
        )
    })?;

    let was_approved = request.status == LeaveStatus::Approved;

    sqlx::query!(
        r#"
        UPDATE leave_requests
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
        "#,
        id,
    )
    .execute(&mut *tx)
    .await?;

    // If the request was previously approved, refund the hours
    if was_approved {
        // Check for segments first (FMLA / split absences)
        let segments = sqlx::query!(
            r#"
            SELECT lrs.leave_type_id, CAST(lrs.hours AS FLOAT8) AS "hours!",
                   lt.code AS leave_type_code
            FROM leave_request_segments lrs
            JOIN leave_types lt ON lt.id = lrs.leave_type_id
            WHERE lrs.leave_request_id = $1
            ORDER BY lrs.sort_order
            "#,
            id,
        )
        .fetch_all(&mut *tx)
        .await?;

        if segments.is_empty() {
            // Original single-type refund
            if let Some(hours) = request.hours {
                if hours > 0.0 {
                    refund_leave_balance(
                        &mut tx,
                        auth.org_id,
                        request.user_id,
                        request.leave_type_id,
                        hours,
                        id,
                        auth.id,
                        &auth.org_timezone,
                    )
                    .await?;
                }
            }
        } else {
            // Refund each segment (skip LWOP — no balance was deducted for it)
            for seg in segments {
                if seg.leave_type_code != "lwop" && seg.hours > 0.0 {
                    refund_leave_balance(
                        &mut tx,
                        auth.org_id,
                        request.user_id,
                        seg.leave_type_id,
                        seg.hours,
                        id,
                        auth.id,
                        &auth.org_timezone,
                    )
                    .await?;
                }
            }
        }
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn review(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewLeaveRequest>,
) -> Result<Json<LeaveRequest>> {
    use validator::Validate;
    body.validate()?;

    if !auth.role.can_approve_leave() {
        return Err(AppError::Forbidden);
    }

    if !matches!(body.status, LeaveStatus::Approved | LeaveStatus::Denied) {
        return Err(AppError::BadRequest(
            "status must be 'approved' or 'denied'".into(),
        ));
    }

    let status = body.status;

    // Optimistic locking: check if the record has been modified since the client last fetched it
    if let Some(expected) = body.expected_updated_at {
        let current = sqlx::query_scalar!(
            r#"
            SELECT lr.updated_at FROM leave_requests lr
            WHERE lr.id = $1 AND lr.org_id = $2
            "#,
            id,
            auth.org_id
        )
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Leave request not found".into()))?;

        if current != expected {
            return Err(AppError::Conflict(
                "This record has been modified by another user. Please refresh and try again."
                    .into(),
            ));
        }
    }

    let mut tx = pool.begin().await?;

    let rows_affected = sqlx::query!(
        r#"
        UPDATE leave_requests
        SET status         = $2,
            reviewed_by    = $3,
            reviewer_notes = $4,
            updated_at     = NOW()
        WHERE id = $1
          AND status = 'pending'
          AND org_id = $5
        "#,
        id,
        status as LeaveStatus,
        auth.id,
        body.reviewer_notes,
        auth.org_id,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(AppError::NotFound(
            "Leave request not found or already reviewed".into(),
        ));
    }

    let r = sqlx::query!(
        r#"
        SELECT lr.id, lr.user_id,
               u.first_name, u.last_name,
               lr.leave_type_id,
               lt.code AS leave_type_code, lt.name AS leave_type_name,
               lr.start_date, lr.end_date,
               lr.hours::FLOAT8 AS hours,
               lr.start_time,
               lr.scheduled_shift_id,
               lr.is_rdo,
               lr.reason,
               lr.emergency_contact,
               lr.bereavement_relationship,
               lr.bereavement_name,
               lr.status AS "status: LeaveStatus",
               lr.reviewed_by, lr.reviewer_notes, lr.created_at, lr.updated_at
        FROM leave_requests lr
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        JOIN users u ON u.id = lr.user_id
        WHERE lr.id = $1 AND lr.org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_one(&mut *tx)
    .await?;

    // On approve: deduct hours from leave balance(s)
    if status == LeaveStatus::Approved {
        // Check for segments (FMLA / split absences)
        let segments = sqlx::query!(
            r#"
            SELECT lrs.leave_type_id, CAST(lrs.hours AS FLOAT8) AS "hours!",
                   lt.code AS leave_type_code
            FROM leave_request_segments lrs
            JOIN leave_types lt ON lt.id = lrs.leave_type_id
            WHERE lrs.leave_request_id = $1
            ORDER BY lrs.sort_order
            "#,
            id,
        )
        .fetch_all(&mut *tx)
        .await?;

        if segments.is_empty() {
            // Original single-type deduction
            if let Some(hours) = r.hours {
                if hours > 0.0 {
                    // H4: Lock balance row and verify sufficient balance before deduction
                    let current_balance = sqlx::query_scalar!(
                        r#"SELECT CAST(balance_hours AS FLOAT8) AS "balance!"
                         FROM leave_balances
                         WHERE user_id = $1 AND leave_type_id = $2
                         FOR UPDATE"#,
                        r.user_id,
                        r.leave_type_id,
                    )
                    .fetch_optional(&mut *tx)
                    .await?;

                    let balance = current_balance.unwrap_or(0.0);
                    if balance < hours {
                        return Err(AppError::Conflict(
                            "Insufficient leave balance to approve this request".into(),
                        ));
                    }

                    deduct_leave_balance(
                        &mut tx,
                        auth.org_id,
                        r.user_id,
                        r.leave_type_id,
                        hours,
                        id,
                        auth.id,
                        &auth.org_timezone,
                    )
                    .await?;
                }
            }
        } else {
            // Deduct from each segment's leave type (skip LWOP — no balance)
            for seg in &segments {
                if seg.leave_type_code != "lwop" && seg.hours > 0.0 {
                    // H4: Lock balance row and verify sufficient balance before deduction
                    let current_balance = sqlx::query_scalar!(
                        r#"SELECT CAST(balance_hours AS FLOAT8) AS "balance!"
                         FROM leave_balances
                         WHERE user_id = $1 AND leave_type_id = $2
                         FOR UPDATE"#,
                        r.user_id,
                        seg.leave_type_id,
                    )
                    .fetch_optional(&mut *tx)
                    .await?;

                    let balance = current_balance.unwrap_or(0.0);
                    if balance < seg.hours {
                        return Err(AppError::Conflict(
                            "Insufficient leave balance to approve this request".into(),
                        ));
                    }

                    deduct_leave_balance(
                        &mut tx,
                        auth.org_id,
                        r.user_id,
                        seg.leave_type_id,
                        seg.hours,
                        id,
                        auth.id,
                        &auth.org_timezone,
                    )
                    .await?;
                }
            }
        }
    }

    tx.commit().await?;

    // Notify the leave requester
    let reviewer_name = sqlx::query!(
        "SELECT first_name || ' ' || last_name AS name FROM users WHERE id = $1",
        auth.id,
    )
    .fetch_optional(&pool)
    .await?;
    let reviewer_display = reviewer_name
        .map(|r| r.name.unwrap_or_default())
        .unwrap_or_default();
    let status_word = if status == LeaveStatus::Approved {
        "approved"
    } else {
        "denied"
    };
    let notif_title = format!("Leave request {}", status_word);
    let notif_message = format!(
        "Your leave request for {} to {} has been {} by {}",
        r.start_date, r.end_date, status_word, reviewer_display,
    );
    let _ = create_notification(
        &pool,
        CreateNotificationParams {
            org_id: auth.org_id,
            user_id: r.user_id,
            notification_type: "leave_reviewed",
            title: &notif_title,
            message: &notif_message,
            link: Some("/leave"),
            source_type: Some("leave_request"),
            source_id: Some(id),
        },
    )
    .await;

    let segments = fetch_segments(&pool, id).await?;
    let lines = fetch_lines(&pool, id).await?;

    Ok(Json(LeaveRequest {
        id: r.id,
        user_id: r.user_id,
        first_name: r.first_name,
        last_name: r.last_name,
        leave_type_id: r.leave_type_id,
        leave_type_code: r.leave_type_code,
        leave_type_name: r.leave_type_name,
        start_date: r.start_date,
        end_date: r.end_date,
        hours: r.hours,
        start_time: r.start_time,
        scheduled_shift_id: r.scheduled_shift_id,
        is_rdo: r.is_rdo,
        reason: r.reason,
        emergency_contact: r.emergency_contact,
        bereavement_relationship: r.bereavement_relationship,
        bereavement_name: r.bereavement_name,
        status: r.status,
        reviewed_by: r.reviewed_by,
        reviewer_notes: r.reviewer_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
        segments,
        lines,
    }))
}

pub async fn bulk_review(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<BulkReviewLeaveRequest>,
) -> Result<Json<serde_json::Value>> {
    use validator::Validate;
    body.validate()?;

    if !auth.role.can_approve_leave() {
        return Err(AppError::Forbidden);
    }

    if !matches!(body.status, LeaveStatus::Approved | LeaveStatus::Denied) {
        return Err(AppError::BadRequest(
            "status must be 'approved' or 'denied'".into(),
        ));
    }

    if body.ids.is_empty() {
        return Err(AppError::BadRequest("ids must not be empty".into()));
    }

    if body.ids.len() > 100 {
        return Err(AppError::BadRequest(
            "Cannot bulk review more than 100 requests at once".into(),
        ));
    }

    let mut tx = pool.begin().await?;
    let mut reviewed = 0u64;
    let mut notif_targets: Vec<(Uuid, Uuid, time::Date, time::Date)> = Vec::new();

    for id in &body.ids {
        let rows_affected = sqlx::query!(
            r#"
            UPDATE leave_requests
            SET status         = $2,
                reviewed_by    = $3,
                reviewer_notes = $4,
                updated_at     = NOW()
            WHERE id = $1
              AND status = 'pending'
              AND org_id = $5
            "#,
            id,
            body.status as LeaveStatus,
            auth.id,
            body.reviewer_notes,
            auth.org_id,
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();

        if rows_affected == 0 {
            continue;
        }

        reviewed += rows_affected;

        // Collect info for notification after commit
        let leave_info = sqlx::query!(
            r#"
            SELECT user_id, leave_type_id, hours::FLOAT8 AS hours,
                   start_date, end_date
            FROM leave_requests
            WHERE id = $1 AND org_id = $2
            "#,
            id,
            auth.org_id,
        )
        .fetch_one(&mut *tx)
        .await?;

        notif_targets.push((
            leave_info.user_id,
            *id,
            leave_info.start_date,
            leave_info.end_date,
        ));

        if body.status == LeaveStatus::Approved {
            // Check for segments
            let segments = sqlx::query!(
                r#"
                SELECT lrs.leave_type_id, CAST(lrs.hours AS FLOAT8) AS "hours!",
                       lt.code AS leave_type_code
                FROM leave_request_segments lrs
                JOIN leave_types lt ON lt.id = lrs.leave_type_id
                WHERE lrs.leave_request_id = $1
                ORDER BY lrs.sort_order
                "#,
                id,
            )
            .fetch_all(&mut *tx)
            .await?;

            if segments.is_empty() {
                if let Some(hours) = leave_info.hours {
                    if hours > 0.0 {
                        // Lock balance row and verify sufficient balance before deduction
                        let current_balance = sqlx::query_scalar!(
                            r#"SELECT CAST(balance_hours AS FLOAT8) AS "balance!"
                             FROM leave_balances
                             WHERE user_id = $1 AND leave_type_id = $2
                             FOR UPDATE"#,
                            leave_info.user_id,
                            leave_info.leave_type_id,
                        )
                        .fetch_optional(&mut *tx)
                        .await?;

                        let balance = current_balance.unwrap_or(0.0);
                        if balance < hours {
                            return Err(AppError::Conflict(
                                "Insufficient leave balance to approve this request".into(),
                            ));
                        }

                        deduct_leave_balance(
                            &mut tx,
                            auth.org_id,
                            leave_info.user_id,
                            leave_info.leave_type_id,
                            hours,
                            *id,
                            auth.id,
                            &auth.org_timezone,
                        )
                        .await?;
                    }
                }
            } else {
                for seg in segments {
                    if seg.leave_type_code != "lwop" && seg.hours > 0.0 {
                        // Lock balance row and verify sufficient balance before deduction
                        let current_balance = sqlx::query_scalar!(
                            r#"SELECT CAST(balance_hours AS FLOAT8) AS "balance!"
                             FROM leave_balances
                             WHERE user_id = $1 AND leave_type_id = $2
                             FOR UPDATE"#,
                            leave_info.user_id,
                            seg.leave_type_id,
                        )
                        .fetch_optional(&mut *tx)
                        .await?;

                        let balance = current_balance.unwrap_or(0.0);
                        if balance < seg.hours {
                            return Err(AppError::Conflict(
                                "Insufficient leave balance to approve this request".into(),
                            ));
                        }

                        deduct_leave_balance(
                            &mut tx,
                            auth.org_id,
                            leave_info.user_id,
                            seg.leave_type_id,
                            seg.hours,
                            *id,
                            auth.id,
                            &auth.org_timezone,
                        )
                        .await?;
                    }
                }
            }
        }
    }

    tx.commit().await?;

    // Send notifications for all reviewed requests
    let reviewer_name = sqlx::query!(
        "SELECT first_name || ' ' || last_name AS name FROM users WHERE id = $1",
        auth.id,
    )
    .fetch_optional(&pool)
    .await?;
    let reviewer_display = reviewer_name
        .map(|r| r.name.unwrap_or_default())
        .unwrap_or_default();
    let status_word = if body.status == LeaveStatus::Approved {
        "approved"
    } else {
        "denied"
    };

    for (user_id, request_id, start_date, end_date) in notif_targets {
        let notif_title = format!("Leave request {}", status_word);
        let notif_message = format!(
            "Your leave request for {} to {} has been {} by {}",
            start_date, end_date, status_word, reviewer_display,
        );
        let _ = create_notification(
            &pool,
            CreateNotificationParams {
                org_id: auth.org_id,
                user_id,
                notification_type: "leave_reviewed",
                title: &notif_title,
                message: &notif_message,
                link: Some("/leave"),
                source_type: Some("leave_request"),
                source_id: Some(request_id),
            },
        )
        .await;
    }

    Ok(Json(
        serde_json::json!({ "ok": true, "reviewed": reviewed }),
    ))
}

// -- Leave Types --

pub async fn list_types(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<LeaveTypeRecord>>> {
    let rows = sqlx::query_as!(
        LeaveTypeRecord,
        r#"
        SELECT id, org_id, code, name, requires_approval, is_reported, draws_from,
               display_order, is_active, created_at
        FROM leave_types
        WHERE org_id = $1 AND is_active = true
        ORDER BY display_order, name
        "#,
        auth.org_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

// -- M2/M3: Carryover cap enforcement --

#[derive(Debug, serde::Deserialize)]
pub struct CarryoverRequest {
    pub fiscal_year: i32,
}

#[derive(Debug, serde::Serialize)]
pub struct CarryoverResult {
    pub fiscal_year: i32,
    pub users_processed: i64,
    pub users_affected: i64,
    pub total_hours_cashed_out: f64,
}

/// POST /api/leave/carryover-enforcement
/// Admin-only: enforce vacation+holiday carryover caps at fiscal year-end.
/// VCCEA: vacation + holiday combined ≤ 240 hrs (deduct vacation first, then holiday).
/// VCSG: vacation only ≤ 260 hrs.
pub async fn carryover_enforcement(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CarryoverRequest>,
) -> Result<Json<CarryoverResult>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let mut tx = pool.begin().await?;

    // Fetch all active users with their bargaining units
    let users = sqlx::query!(
        r#"
        SELECT id, bargaining_unit::TEXT AS "bargaining_unit!"
        FROM users
        WHERE org_id = $1 AND is_active = true
          AND bargaining_unit IN ('vccea', 'vcsg')
        "#,
        auth.org_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    let mut users_processed = 0i64;
    let mut users_affected = 0i64;
    let mut total_cashed_out = 0.0f64;

    for user in &users {
        users_processed += 1;
        let (cap, pool_draws_from): (f64, &[&str]) = match user.bargaining_unit.as_str() {
            "vccea" => (240.0, &["vacation", "holiday"]),
            "vcsg" => (260.0, &["vacation"]),
            _ => continue,
        };

        // Sum current balances across all leave types in the applicable pools
        let balance_rows = sqlx::query!(
            r#"
            SELECT lb.leave_type_id, lt.draws_from,
                   CAST(lb.balance_hours AS FLOAT8) AS "balance_hours!"
            FROM leave_balances lb
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE lb.user_id = $1 AND lb.org_id = $2
              AND lt.draws_from = ANY($3)
              AND lb.balance_hours > 0
            ORDER BY lt.draws_from DESC, lb.balance_hours DESC
            "#,
            user.id,
            auth.org_id,
            pool_draws_from as &[&str],
        )
        .fetch_all(&mut *tx)
        .await?;

        let total: f64 = balance_rows.iter().map(|r| r.balance_hours).sum();
        if total <= cap {
            continue;
        }

        users_affected += 1;
        let mut excess = total - cap;

        // Deduct from vacation types first, then holiday (for VCCEA)
        for row in &balance_rows {
            if excess <= 0.0 {
                break;
            }
            let deduct = excess.min(row.balance_hours);

            sqlx::query!(
                r#"
                INSERT INTO accrual_transactions
                    (id, org_id, user_id, leave_type_id, hours, reason, note, created_by)
                VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, 'carryover',
                        $6, $7)
                "#,
                Uuid::new_v4(),
                auth.org_id,
                user.id,
                row.leave_type_id,
                -deduct,
                format!(
                    "FY{} carryover cap enforcement — excess cashed out",
                    body.fiscal_year
                ),
                auth.id,
            )
            .execute(&mut *tx)
            .await?;

            let today = crate::services::timezone::org_today(&auth.org_timezone);
            sqlx::query!(
                r#"
                UPDATE leave_balances
                SET balance_hours = balance_hours - $3::FLOAT8::NUMERIC,
                    as_of_date = $4,
                    updated_at = NOW()
                WHERE user_id = $1 AND leave_type_id = $2
                "#,
                user.id,
                row.leave_type_id,
                deduct,
                today,
            )
            .execute(&mut *tx)
            .await?;

            excess -= deduct;
            total_cashed_out += deduct;
        }
    }

    tx.commit().await?;

    Ok(Json(CarryoverResult {
        fiscal_year: body.fiscal_year,
        users_processed,
        users_affected,
        total_hours_cashed_out: total_cashed_out,
    }))
}

// -- M7: VCSG longevity credit --

#[derive(Debug, serde::Deserialize)]
pub struct LongevityRequest {
    pub user_id: Uuid,
}

#[derive(Debug, serde::Serialize)]
pub struct LongevityResult {
    pub user_id: Uuid,
    pub years_of_service: i32,
    pub vacation_hours_credited: f64,
    pub longevity_bonus_percent: f64,
}

/// POST /api/leave/longevity-credit
/// Admin-only: credit 24 vacation hours on VCSG employee anniversary.
/// Returns longevity bonus % for payroll processing.
pub async fn longevity_credit(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<LongevityRequest>,
) -> Result<Json<LongevityResult>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Fetch user — must be VCSG and in caller's org
    let user = sqlx::query!(
        r#"
        SELECT users.id, bargaining_unit::TEXT AS "bargaining_unit!",
               hire_date,
               overall_seniority_date AS "overall_seniority_date?"
        FROM users
        JOIN seniority_records sr ON sr.user_id = users.id
        WHERE users.id = $1 AND users.org_id = $2 AND users.is_active = true
        "#,
        body.user_id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    if user.bargaining_unit != "vcsg" {
        return Err(AppError::BadRequest(
            "Longevity credit applies to VCSG employees only".into(),
        ));
    }

    // Determine service start date (overall_seniority_date preferred, fall back to hire_date)
    let service_start = user
        .overall_seniority_date
        .or(user.hire_date)
        .ok_or_else(|| AppError::BadRequest("User has no seniority or hire date set".into()))?;

    let today = crate::services::timezone::org_today(&auth.org_timezone);
    let mut years_of_service = (today.year() - service_start.year()) as i32;
    if (today.month() as u8) < (service_start.month() as u8)
        || ((today.month() as u8) == (service_start.month() as u8)
            && today.day() < service_start.day())
    {
        years_of_service -= 1;
    }

    // VCSG longevity tiers
    let longevity_percent = match years_of_service {
        0..=4 => 1.55,
        5..=9 => 2.05,
        10..=14 => 2.55,
        15..=19 => 3.05,
        _ => 3.55,
    };

    // Credit 24 vacation hours — find the first active vacation-pool leave type
    let vacation_type_id = sqlx::query_scalar!(
        r#"
        SELECT id FROM leave_types
        WHERE org_id = $1 AND draws_from = 'vacation' AND is_active = true
        ORDER BY display_order LIMIT 1
        "#,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("No vacation leave type configured".into()))?;

    const VACATION_CREDIT: f64 = 24.0;

    let mut tx = pool.begin().await?;

    sqlx::query!(
        r#"
        INSERT INTO accrual_transactions
            (id, org_id, user_id, leave_type_id, hours, reason, note, created_by)
        VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, 'adjustment',
                $6, $7)
        "#,
        Uuid::new_v4(),
        auth.org_id,
        body.user_id,
        vacation_type_id,
        VACATION_CREDIT,
        format!(
            "VCSG anniversary credit: {} yrs of service; longevity {}%",
            years_of_service, longevity_percent
        ),
        auth.id,
    )
    .execute(&mut *tx)
    .await?;

    let today = crate::services::timezone::org_today(&auth.org_timezone);
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
        auth.org_id,
        body.user_id,
        vacation_type_id,
        VACATION_CREDIT,
        today,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(LongevityResult {
        user_id: body.user_id,
        years_of_service,
        vacation_hours_credited: VACATION_CREDIT,
        longevity_bonus_percent: longevity_percent,
    }))
}
