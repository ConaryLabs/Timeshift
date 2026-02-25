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
    models::ot_request::{
        CreateOtRequest, CreateOtRequestAssignment, OtRequestAssignmentRow, OtRequestDetail,
        OtRequestQuery, OtRequestRow, OtRequestStatus, OtRequestVolunteerRow, UpdateOtRequest,
    },
    org_guard,
};

// ---------------------------------------------------------------------------
// List OT Requests
// ---------------------------------------------------------------------------

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<OtRequestQuery>,
) -> Result<Json<Vec<OtRequestRow>>> {
    let volunteered_by_me = params.volunteered_by_me.unwrap_or(false);

    let rows = sqlx::query!(
        r#"
        SELECT
            r.id, r.org_id, r.date, r.start_time, r.end_time,
            CAST(r.hours AS FLOAT8) AS "hours!",
            r.classification_id,
            cl.name AS classification_name,
            r.ot_reason_id,
            orr.name AS "ot_reason_name?",
            r.location,
            r.is_fixed_coverage,
            r.notes,
            r.status AS "status: OtRequestStatus",
            r.created_by,
            (cu.first_name || ' ' || cu.last_name) AS "created_by_name!",
            r.created_at,
            r.updated_at,
            r.cancelled_at,
            r.cancelled_by,
            (SELECT COUNT(*) FROM ot_request_volunteers v
             WHERE v.ot_request_id = r.id AND v.withdrawn_at IS NULL) AS "volunteer_count!",
            (SELECT COUNT(*) FROM ot_request_assignments a
             WHERE a.ot_request_id = r.id AND a.cancelled_at IS NULL) AS "assignment_count!",
            EXISTS(SELECT 1 FROM ot_request_volunteers v
             WHERE v.ot_request_id = r.id AND v.user_id = $9 AND v.withdrawn_at IS NULL) AS "user_volunteered!"
        FROM ot_requests r
        JOIN classifications cl ON cl.id = r.classification_id
        JOIN users cu ON cu.id = r.created_by
        LEFT JOIN ot_reasons orr ON orr.id = r.ot_reason_id
        WHERE r.org_id = $1
          AND ($2::ot_request_status IS NULL OR r.status = $2)
          AND ($3::DATE IS NULL OR r.date >= $3)
          AND ($4::DATE IS NULL OR r.date <= $4)
          AND ($5::UUID IS NULL OR r.classification_id = $5)
          AND (NOT $8::BOOL OR EXISTS (
            SELECT 1 FROM ot_request_volunteers v
            WHERE v.ot_request_id = r.id AND v.user_id = $9 AND v.withdrawn_at IS NULL
          ))
        ORDER BY r.date DESC, r.start_time ASC
        LIMIT $6 OFFSET $7
        "#,
        auth.org_id,
        params.status as Option<OtRequestStatus>,
        params.date_from as Option<time::Date>,
        params.date_to as Option<time::Date>,
        params.classification_id as Option<Uuid>,
        params.limit(),
        params.offset(),
        volunteered_by_me,
        auth.id,
    )
    .fetch_all(&pool)
    .await?;

    let results = rows
        .into_iter()
        .map(|r| OtRequestRow {
            id: r.id,
            org_id: r.org_id,
            date: r.date,
            start_time: r.start_time,
            end_time: r.end_time,
            hours: r.hours,
            classification_id: r.classification_id,
            classification_name: r.classification_name,
            ot_reason_id: r.ot_reason_id,
            ot_reason_name: r.ot_reason_name,
            location: r.location,
            is_fixed_coverage: r.is_fixed_coverage,
            notes: r.notes,
            status: r.status,
            created_by: r.created_by,
            created_by_name: r.created_by_name,
            created_at: r.created_at,
            updated_at: r.updated_at,
            cancelled_at: r.cancelled_at,
            cancelled_by: r.cancelled_by,
            volunteer_count: r.volunteer_count,
            assignment_count: r.assignment_count,
            user_volunteered: r.user_volunteered,
        })
        .collect();

    Ok(Json(results))
}

// ---------------------------------------------------------------------------
// Get Single OT Request (with volunteers + assignments)
// ---------------------------------------------------------------------------

pub async fn get_one(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<OtRequestDetail>> {
    let row = sqlx::query!(
        r#"
        SELECT
            r.id, r.org_id, r.date, r.start_time, r.end_time,
            CAST(r.hours AS FLOAT8) AS "hours!",
            r.classification_id,
            cl.name AS classification_name,
            r.ot_reason_id,
            orr.name AS "ot_reason_name?",
            r.location,
            r.is_fixed_coverage,
            r.notes,
            r.status AS "status: OtRequestStatus",
            r.created_by,
            (cu.first_name || ' ' || cu.last_name) AS "created_by_name!",
            r.created_at,
            r.updated_at,
            r.cancelled_at,
            r.cancelled_by
        FROM ot_requests r
        JOIN classifications cl ON cl.id = r.classification_id
        JOIN users cu ON cu.id = r.created_by
        LEFT JOIN ot_reasons orr ON orr.id = r.ot_reason_id
        WHERE r.id = $1 AND r.org_id = $2
        "#,
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("OT request not found".into()))?;

    // Fetch volunteers
    let volunteer_rows = sqlx::query!(
        r#"
        SELECT
            v.id, v.ot_request_id, v.user_id,
            (u.first_name || ' ' || u.last_name) AS "user_name!",
            u.email AS user_email,
            cl.name AS "classification_name?",
            v.volunteered_at,
            v.withdrawn_at
        FROM ot_request_volunteers v
        JOIN users u ON u.id = v.user_id
        LEFT JOIN classifications cl ON cl.id = u.classification_id
        WHERE v.ot_request_id = $1
        ORDER BY v.volunteered_at ASC
        "#,
        id,
    )
    .fetch_all(&pool)
    .await?;

    let volunteers: Vec<OtRequestVolunteerRow> = volunteer_rows
        .into_iter()
        .map(|v| OtRequestVolunteerRow {
            id: v.id,
            ot_request_id: v.ot_request_id,
            user_id: v.user_id,
            user_name: v.user_name,
            user_email: v.user_email,
            classification_name: v.classification_name,
            volunteered_at: v.volunteered_at,
            withdrawn_at: v.withdrawn_at,
        })
        .collect();

    // Fetch assignments
    let assignment_rows = sqlx::query!(
        r#"
        SELECT
            a.id, a.ot_request_id, a.user_id,
            (u.first_name || ' ' || u.last_name) AS "user_name!",
            a.ot_type,
            a.assigned_by,
            (ab.first_name || ' ' || ab.last_name) AS "assigned_by_name!",
            a.assigned_at,
            a.cancelled_at,
            a.cancelled_by
        FROM ot_request_assignments a
        JOIN users u ON u.id = a.user_id
        JOIN users ab ON ab.id = a.assigned_by
        WHERE a.ot_request_id = $1
        ORDER BY a.assigned_at ASC
        "#,
        id,
    )
    .fetch_all(&pool)
    .await?;

    let assignments: Vec<OtRequestAssignmentRow> = assignment_rows
        .into_iter()
        .map(|a| OtRequestAssignmentRow {
            id: a.id,
            ot_request_id: a.ot_request_id,
            user_id: a.user_id,
            user_name: a.user_name,
            ot_type: a.ot_type,
            assigned_by: a.assigned_by,
            assigned_by_name: a.assigned_by_name,
            assigned_at: a.assigned_at,
            cancelled_at: a.cancelled_at,
            cancelled_by: a.cancelled_by,
        })
        .collect();

    let detail = OtRequestDetail {
        id: row.id,
        org_id: row.org_id,
        date: row.date,
        start_time: row.start_time,
        end_time: row.end_time,
        hours: row.hours,
        classification_id: row.classification_id,
        classification_name: row.classification_name,
        ot_reason_id: row.ot_reason_id,
        ot_reason_name: row.ot_reason_name,
        location: row.location,
        is_fixed_coverage: row.is_fixed_coverage,
        notes: row.notes,
        status: row.status,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        cancelled_at: row.cancelled_at,
        cancelled_by: row.cancelled_by,
        volunteers,
        assignments,
    };

    Ok(Json(detail))
}

// ---------------------------------------------------------------------------
// Create OT Request (admin/supervisor only)
// ---------------------------------------------------------------------------

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateOtRequest>,
) -> Result<Json<OtRequestRow>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify classification belongs to org
    org_guard::verify_classification(&pool, req.classification_id, auth.org_id).await?;

    // Verify ot_reason belongs to org (if provided)
    if let Some(reason_id) = req.ot_reason_id {
        org_guard::verify_ot_reason(&pool, reason_id, auth.org_id).await?;
    }

    // Reject identical start and end times (would compute as 24h due to midnight-crossing branch)
    if req.start_time == req.end_time {
        return Err(AppError::BadRequest(
            "Start time and end time cannot be the same".into(),
        ));
    }

    // Compute hours from start_time and end_time
    let start_secs = req.start_time.hour() as f64 * 3600.0
        + req.start_time.minute() as f64 * 60.0
        + req.start_time.second() as f64;
    let end_secs = req.end_time.hour() as f64 * 3600.0
        + req.end_time.minute() as f64 * 60.0
        + req.end_time.second() as f64;
    let diff_secs = if end_secs > start_secs {
        end_secs - start_secs
    } else {
        // Crosses midnight
        (86400.0 - start_secs) + end_secs
    };
    let hours = diff_secs / 3600.0;

    if hours <= 0.0 || hours > 24.0 {
        return Err(AppError::BadRequest(
            "Invalid time range: hours must be between 0 and 24".into(),
        ));
    }

    let is_fixed = req.is_fixed_coverage.unwrap_or(false);

    let new_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO ot_requests
            (id, org_id, date, start_time, end_time, hours, classification_id,
             ot_reason_id, location, is_fixed_coverage, notes, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6::FLOAT8::NUMERIC, $7, $8, $9, $10, $11, 'open', $12)
        "#,
        new_id,
        auth.org_id,
        req.date,
        req.start_time,
        req.end_time,
        hours,
        req.classification_id,
        req.ot_reason_id,
        req.location,
        is_fixed,
        req.notes,
        auth.id,
    )
    .execute(&pool)
    .await?;

    // Re-fetch with joins for the response
    let row = sqlx::query!(
        r#"
        SELECT
            r.id, r.org_id, r.date, r.start_time, r.end_time,
            CAST(r.hours AS FLOAT8) AS "hours!",
            r.classification_id,
            cl.name AS classification_name,
            r.ot_reason_id,
            orr.name AS "ot_reason_name?",
            r.location,
            r.is_fixed_coverage,
            r.notes,
            r.status AS "status: OtRequestStatus",
            r.created_by,
            (cu.first_name || ' ' || cu.last_name) AS "created_by_name!",
            r.created_at,
            r.updated_at,
            r.cancelled_at,
            r.cancelled_by
        FROM ot_requests r
        JOIN classifications cl ON cl.id = r.classification_id
        JOIN users cu ON cu.id = r.created_by
        LEFT JOIN ot_reasons orr ON orr.id = r.ot_reason_id
        WHERE r.id = $1 AND r.org_id = $2
        "#,
        new_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(OtRequestRow {
        id: row.id,
        org_id: row.org_id,
        date: row.date,
        start_time: row.start_time,
        end_time: row.end_time,
        hours: row.hours,
        classification_id: row.classification_id,
        classification_name: row.classification_name,
        ot_reason_id: row.ot_reason_id,
        ot_reason_name: row.ot_reason_name,
        location: row.location,
        is_fixed_coverage: row.is_fixed_coverage,
        notes: row.notes,
        status: row.status,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        cancelled_at: row.cancelled_at,
        cancelled_by: row.cancelled_by,
        volunteer_count: 0,
        assignment_count: 0,
        user_volunteered: false,
    }))
}

// ---------------------------------------------------------------------------
// Update OT Request (admin/supervisor only)
// ---------------------------------------------------------------------------

pub async fn update(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateOtRequest>,
) -> Result<Json<OtRequestRow>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Manual length validation for double-Option fields (derive(Validate) can't reach inner strings)
    if let Some(Some(ref loc)) = req.location {
        if loc.len() > 500 {
            return Err(AppError::BadRequest(
                "Location too long (max 500 chars)".into(),
            ));
        }
    }
    if let Some(Some(ref n)) = req.notes {
        if n.len() > 2000 {
            return Err(AppError::BadRequest(
                "Notes too long (max 2000 chars)".into(),
            ));
        }
    }

    // Optimistic locking: check if the record has been modified since the client last fetched it
    if let Some(expected) = req.expected_updated_at {
        let current = sqlx::query_scalar!(
            "SELECT updated_at FROM ot_requests WHERE id = $1 AND org_id = $2",
            id,
            auth.org_id
        )
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound("OT request not found".into()))?;

        if current != expected {
            return Err(AppError::Conflict(
                "This record has been modified by another user. Please refresh and try again."
                    .into(),
            ));
        }
    }

    // Verify request exists and belongs to org
    let existing = sqlx::query!(
        r#"SELECT status AS "status: OtRequestStatus" FROM ot_requests WHERE id = $1 AND org_id = $2"#,
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("OT request not found".into()))?;

    if existing.status == OtRequestStatus::Cancelled {
        return Err(AppError::Conflict(
            "Cannot update a cancelled OT request".into(),
        ));
    }

    // Validate ot_reason_id if provided
    if let Some(Some(reason_id)) = &req.ot_reason_id {
        org_guard::verify_ot_reason(&pool, *reason_id, auth.org_id).await?;
    }

    // Double-Option update pattern
    let ot_reason_provided = req.ot_reason_id.is_some();
    let ot_reason_val = req.ot_reason_id.flatten();
    let location_provided = req.location.is_some();
    let location_val = req.location.flatten();
    let notes_provided = req.notes.is_some();
    let notes_val = req.notes.flatten();

    sqlx::query!(
        r#"
        UPDATE ot_requests SET
            ot_reason_id = CASE WHEN $3 THEN $4 ELSE ot_reason_id END,
            location = CASE WHEN $5 THEN $6 ELSE location END,
            is_fixed_coverage = COALESCE($7, is_fixed_coverage),
            notes = CASE WHEN $8 THEN $9 ELSE notes END,
            status = COALESCE($10, status),
            updated_at = NOW()
        WHERE id = $1 AND org_id = $2
        "#,
        id,
        auth.org_id,
        ot_reason_provided,
        ot_reason_val as Option<Uuid>,
        location_provided,
        location_val as Option<String>,
        req.is_fixed_coverage as Option<bool>,
        notes_provided,
        notes_val as Option<String>,
        req.status as Option<OtRequestStatus>,
    )
    .execute(&pool)
    .await?;

    // Re-fetch with joins
    let row = sqlx::query!(
        r#"
        SELECT
            r.id, r.org_id, r.date, r.start_time, r.end_time,
            CAST(r.hours AS FLOAT8) AS "hours!",
            r.classification_id,
            cl.name AS classification_name,
            r.ot_reason_id,
            orr.name AS "ot_reason_name?",
            r.location,
            r.is_fixed_coverage,
            r.notes,
            r.status AS "status: OtRequestStatus",
            r.created_by,
            (cu.first_name || ' ' || cu.last_name) AS "created_by_name!",
            r.created_at,
            r.updated_at,
            r.cancelled_at,
            r.cancelled_by,
            (SELECT COUNT(*) FROM ot_request_volunteers v
             WHERE v.ot_request_id = r.id AND v.withdrawn_at IS NULL) AS "volunteer_count!",
            (SELECT COUNT(*) FROM ot_request_assignments a
             WHERE a.ot_request_id = r.id AND a.cancelled_at IS NULL) AS "assignment_count!",
            EXISTS(SELECT 1 FROM ot_request_volunteers v
             WHERE v.ot_request_id = r.id AND v.user_id = $3 AND v.withdrawn_at IS NULL) AS "user_volunteered!"
        FROM ot_requests r
        JOIN classifications cl ON cl.id = r.classification_id
        JOIN users cu ON cu.id = r.created_by
        LEFT JOIN ot_reasons orr ON orr.id = r.ot_reason_id
        WHERE r.id = $1 AND r.org_id = $2
        "#,
        id,
        auth.org_id,
        auth.id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(OtRequestRow {
        id: row.id,
        org_id: row.org_id,
        date: row.date,
        start_time: row.start_time,
        end_time: row.end_time,
        hours: row.hours,
        classification_id: row.classification_id,
        classification_name: row.classification_name,
        ot_reason_id: row.ot_reason_id,
        ot_reason_name: row.ot_reason_name,
        location: row.location,
        is_fixed_coverage: row.is_fixed_coverage,
        notes: row.notes,
        status: row.status,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        cancelled_at: row.cancelled_at,
        cancelled_by: row.cancelled_by,
        volunteer_count: row.volunteer_count,
        assignment_count: row.assignment_count,
        user_volunteered: row.user_volunteered,
    }))
}

// ---------------------------------------------------------------------------
// Cancel OT Request (admin/supervisor only)
// ---------------------------------------------------------------------------

pub async fn cancel(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        r#"
        UPDATE ot_requests
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_by = $3,
            updated_at = NOW()
        WHERE id = $1 AND org_id = $2
          AND status != 'cancelled'
        "#,
        id,
        auth.org_id,
        auth.id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound(
            "OT request not found or already cancelled".into(),
        ));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ---------------------------------------------------------------------------
// Volunteer for OT Request
// ---------------------------------------------------------------------------

pub async fn volunteer(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let mut tx = pool.begin().await?;

    // Lock the OT request row to serialize concurrent volunteers, verify it exists,
    // belongs to org, and is open or partially_filled.
    let request = sqlx::query!(
        r#"SELECT status AS "status: OtRequestStatus", date, CAST(hours AS FLOAT8) AS "hours!", classification_id, is_fixed_coverage
           FROM ot_requests WHERE id = $1 AND org_id = $2 FOR UPDATE"#,
        id,
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("OT request not found".into()))?;

    if !matches!(
        request.status,
        OtRequestStatus::Open | OtRequestStatus::PartiallyFilled
    ) {
        return Err(AppError::Conflict(
            "OT request is not accepting volunteers".into(),
        ));
    }

    // Verify user is active
    let user_active = sqlx::query_scalar!(
        "SELECT is_active FROM users WHERE id = $1 AND org_id = $2",
        auth.id,
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    if !user_active {
        return Err(AppError::Forbidden);
    }

    // Check for existing active volunteer entry (not withdrawn)
    let already_volunteered = sqlx::query_scalar!(
        r#"SELECT EXISTS(
            SELECT 1 FROM ot_request_volunteers
            WHERE ot_request_id = $1 AND user_id = $2 AND withdrawn_at IS NULL
        ) AS "exists!""#,
        id,
        auth.id,
    )
    .fetch_one(&mut *tx)
    .await?;

    if already_volunteered {
        return Err(AppError::Conflict(
            "You have already volunteered for this OT request".into(),
        ));
    }

    // Insert or re-activate (if previously withdrawn, insert new row; UNIQUE constraint
    // is on (ot_request_id, user_id) so we need to handle the withdrawn case)
    // If there's a withdrawn entry, remove the withdrawn_at; otherwise insert new
    let updated = sqlx::query!(
        r#"
        UPDATE ot_request_volunteers
        SET withdrawn_at = NULL, volunteered_at = NOW()
        WHERE ot_request_id = $1 AND user_id = $2 AND withdrawn_at IS NOT NULL
        "#,
        id,
        auth.id,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();

    if updated == 0 {
        // No withdrawn entry to reactivate, insert new
        sqlx::query!(
            r#"
            INSERT INTO ot_request_volunteers (id, ot_request_id, user_id)
            VALUES (gen_random_uuid(), $1, $2)
            "#,
            id,
            auth.id,
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ---------------------------------------------------------------------------
// Withdraw Volunteer
// ---------------------------------------------------------------------------

pub async fn withdraw_volunteer(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Verify request exists and belongs to org
    sqlx::query_scalar!(
        "SELECT id FROM ot_requests WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("OT request not found".into()))?;

    let rows = sqlx::query!(
        r#"
        UPDATE ot_request_volunteers
        SET withdrawn_at = NOW()
        WHERE ot_request_id = $1 AND user_id = $2 AND withdrawn_at IS NULL
        "#,
        id,
        auth.id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound(
            "No active volunteer entry found for this request".into(),
        ));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ---------------------------------------------------------------------------
// Assign User to OT Request (admin/supervisor)
// ---------------------------------------------------------------------------

pub async fn assign(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<CreateOtRequestAssignment>,
) -> Result<Json<OtRequestAssignmentRow>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let mut tx = pool.begin().await?;

    // Verify request exists, belongs to org, and is not cancelled/filled
    let request = sqlx::query!(
        r#"SELECT status AS "status: OtRequestStatus", date, CAST(hours AS FLOAT8) AS "hours!", classification_id, is_fixed_coverage
           FROM ot_requests WHERE id = $1 AND org_id = $2 FOR UPDATE"#,
        id,
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("OT request not found".into()))?;

    if request.status == OtRequestStatus::Cancelled {
        return Err(AppError::Conflict(
            "Cannot assign to a cancelled OT request".into(),
        ));
    }

    if request.status == OtRequestStatus::Filled {
        return Err(AppError::Conflict("OT request is already filled".into()));
    }

    // Verify user belongs to org and is active
    org_guard::verify_user(&pool, req.user_id, auth.org_id).await?;

    // Check for existing active assignment
    let already_assigned = sqlx::query_scalar!(
        r#"SELECT EXISTS(
            SELECT 1 FROM ot_request_assignments
            WHERE ot_request_id = $1 AND user_id = $2 AND cancelled_at IS NULL
        ) AS "exists!""#,
        id,
        req.user_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    if already_assigned {
        return Err(AppError::Conflict(
            "User is already assigned to this OT request".into(),
        ));
    }

    let ot_type = req.ot_type.unwrap_or_else(|| "voluntary".to_string());

    // Validate ot_type
    if !matches!(
        ot_type.as_str(),
        "voluntary" | "mandatory" | "fixed_coverage"
    ) {
        return Err(AppError::BadRequest(
            "ot_type must be one of: voluntary, mandatory, fixed_coverage".into(),
        ));
    }

    let assignment_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO ot_request_assignments
            (id, ot_request_id, user_id, ot_type, assigned_by)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        assignment_id,
        id,
        req.user_id,
        ot_type,
        auth.id,
    )
    .execute(&mut *tx)
    .await?;

    // Update request status based on coverage type:
    // Fixed coverage = single-slot, so one assignment fills it.
    // Non-fixed coverage = may need more assignments, so mark partially_filled.
    let new_status = if request.is_fixed_coverage {
        OtRequestStatus::Filled
    } else {
        OtRequestStatus::PartiallyFilled
    };
    sqlx::query!(
        r#"
        UPDATE ot_requests SET
            status = $3,
            updated_at = NOW()
        WHERE id = $1 AND org_id = $2
        "#,
        id,
        auth.org_id,
        new_status as OtRequestStatus,
    )
    .execute(&mut *tx)
    .await?;

    // Update OT hours tracking: increment user's OT hours for the fiscal year.
    // Fixed coverage assignments do not count toward the OT queue hours.
    if !request.is_fixed_coverage {
        let fiscal_year: i32 = request.date.year();

        sqlx::query!(
            r#"
            INSERT INTO ot_hours
                (id, user_id, fiscal_year, classification_id, hours_worked, hours_declined)
            VALUES (gen_random_uuid(), $1, $2, $4, $3::FLOAT8::NUMERIC, 0)
            ON CONFLICT (user_id, fiscal_year,
                COALESCE(classification_id,
                         '00000000-0000-0000-0000-000000000000'::uuid))
            DO UPDATE SET
                hours_worked = ot_hours.hours_worked + $3::FLOAT8::NUMERIC,
                updated_at   = NOW()
            "#,
            req.user_id,
            fiscal_year,
            request.hours,
            request.classification_id,
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // Notify the assigned employee
    let link = format!("/ot-requests/{}", id);
    let ot_times = sqlx::query!(
        "SELECT start_time, end_time FROM ot_requests WHERE id = $1",
        id,
    )
    .fetch_optional(&pool)
    .await
    .ok()
    .flatten();
    let time_fmt = time::format_description::parse("[hour]:[minute]").unwrap_or_default();
    let time_range = match ot_times {
        Some(ref t) => format!(
            " ({} - {})",
            t.start_time.format(&time_fmt).unwrap_or_default(),
            t.end_time.format(&time_fmt).unwrap_or_default(),
        ),
        None => String::new(),
    };
    let notif_message = format!(
        "You have been assigned to OT on {}{}",
        request.date, time_range,
    );
    let _ = create_notification(
        &pool,
        CreateNotificationParams {
            org_id: auth.org_id,
            user_id: req.user_id,
            notification_type: "ot_assigned",
            title: "OT Assignment",
            message: &notif_message,
            link: Some(&link),
            source_type: Some("ot_request"),
            source_id: Some(id),
        },
    )
    .await;

    // Fetch the assignment with joins
    let row = sqlx::query!(
        r#"
        SELECT
            a.id, a.ot_request_id, a.user_id,
            (u.first_name || ' ' || u.last_name) AS "user_name!",
            a.ot_type,
            a.assigned_by,
            (ab.first_name || ' ' || ab.last_name) AS "assigned_by_name!",
            a.assigned_at,
            a.cancelled_at,
            a.cancelled_by
        FROM ot_request_assignments a
        JOIN users u ON u.id = a.user_id
        JOIN users ab ON ab.id = a.assigned_by
        WHERE a.id = $1
        "#,
        assignment_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(OtRequestAssignmentRow {
        id: row.id,
        ot_request_id: row.ot_request_id,
        user_id: row.user_id,
        user_name: row.user_name,
        ot_type: row.ot_type,
        assigned_by: row.assigned_by,
        assigned_by_name: row.assigned_by_name,
        assigned_at: row.assigned_at,
        cancelled_at: row.cancelled_at,
        cancelled_by: row.cancelled_by,
    }))
}

// ---------------------------------------------------------------------------
// Cancel Assignment (admin/supervisor)
// ---------------------------------------------------------------------------

pub async fn cancel_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let mut tx = pool.begin().await?;

    // Verify request belongs to org
    let request = sqlx::query!(
        r#"SELECT status AS "status: OtRequestStatus", date, CAST(hours AS FLOAT8) AS "hours!", classification_id, is_fixed_coverage
           FROM ot_requests WHERE id = $1 AND org_id = $2 FOR UPDATE"#,
        id,
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("OT request not found".into()))?;

    // Cancel the assignment
    let rows = sqlx::query!(
        r#"
        UPDATE ot_request_assignments
        SET cancelled_at = NOW(), cancelled_by = $3
        WHERE ot_request_id = $1 AND user_id = $2 AND cancelled_at IS NULL
        "#,
        id,
        user_id,
        auth.id,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound(
            "No active assignment found for this user on this OT request".into(),
        ));
    }

    // Revert OT hours tracking (only for non-fixed-coverage, matching the assign logic)
    if !request.is_fixed_coverage {
        let fiscal_year: i32 = request.date.year();

        sqlx::query!(
            r#"
            UPDATE ot_hours
            SET hours_worked = GREATEST(ot_hours.hours_worked - $3::FLOAT8::NUMERIC, 0::NUMERIC),
                updated_at = NOW()
            WHERE user_id = $1 AND fiscal_year = $2
              AND COALESCE(classification_id, '00000000-0000-0000-0000-000000000000'::uuid)
                = COALESCE($4, '00000000-0000-0000-0000-000000000000'::uuid)
            "#,
            user_id,
            fiscal_year,
            request.hours,
            Some(request.classification_id) as Option<Uuid>,
        )
        .execute(&mut *tx)
        .await?;
    }

    // Determine new status: check remaining active assignments
    let active_count: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM ot_request_assignments WHERE ot_request_id = $1 AND cancelled_at IS NULL",
        id
    )
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(0);

    let new_status = if request.status == OtRequestStatus::Cancelled {
        OtRequestStatus::Cancelled // Don't change if already cancelled
    } else if active_count > 0 {
        OtRequestStatus::PartiallyFilled
    } else {
        OtRequestStatus::Open
    };

    sqlx::query!(
        "UPDATE ot_requests SET status = $2, updated_at = NOW() WHERE id = $1",
        id,
        new_status as OtRequestStatus,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Notify the employee about cancelled assignment
    let _ = create_notification(
        &pool,
        CreateNotificationParams {
            org_id: auth.org_id,
            user_id,
            notification_type: "ot_assignment_cancelled",
            title: "OT Assignment Cancelled",
            message: &format!("Your OT assignment on {} has been cancelled", request.date),
            link: Some("/available-ot"),
            source_type: Some("ot_request"),
            source_id: Some(id),
        },
    )
    .await;

    Ok(Json(serde_json::json!({ "ok": true })))
}
