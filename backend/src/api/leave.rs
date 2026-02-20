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
        common::PaginationParams,
        leave::{
            CreateLeaveRequest, LeaveRequest, LeaveStatus, LeaveTypeRecord, ReviewLeaveRequest,
        },
    },
};

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<LeaveRequest>>> {
    // Use a single query with conditional filter to avoid sqlx type mismatch
    let is_manager = auth.role.can_approve_leave();
    let rows = sqlx::query!(
        r#"
        SELECT lr.id, lr.user_id,
               u.first_name, u.last_name,
               lr.leave_type_id,
               lt.code AS leave_type_code, lt.name AS leave_type_name,
               lr.start_date, lr.end_date,
               lr.hours::FLOAT8 AS hours,
               lr.reason,
               lr.status AS "status: LeaveStatus",
               lr.reviewed_by, lr.reviewer_notes, lr.created_at, lr.updated_at
        FROM leave_requests lr
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        JOIN users u ON u.id = lr.user_id
        WHERE u.org_id = $1
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
            reason: r.reason,
            status: r.status,
            reviewed_by: r.reviewed_by,
            reviewer_notes: r.reviewer_notes,
            created_at: r.created_at,
            updated_at: r.updated_at,
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
               lr.reason,
               lr.status AS "status: LeaveStatus",
               lr.reviewed_by, lr.reviewer_notes, lr.created_at, lr.updated_at
        FROM leave_requests lr
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        JOIN users u ON u.id = lr.user_id
        WHERE lr.id = $1 AND u.org_id = $2
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
        reason: r.reason,
        status: r.status,
        reviewed_by: r.reviewed_by,
        reviewer_notes: r.reviewer_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateLeaveRequest>,
) -> Result<Json<LeaveRequest>> {
    if body.end_date < body.start_date {
        return Err(AppError::BadRequest(
            "end_date must be >= start_date".into(),
        ));
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

    // Check for overlapping leave requests (only pending/approved block new ones)
    let overlap = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM leave_requests
            WHERE user_id = $1
              AND status IN ('pending', 'approved')
              AND start_date <= $3
              AND end_date >= $2
        )
        "#,
        auth.id,
        body.start_date,
        body.end_date,
    )
    .fetch_one(&pool)
    .await?;
    if overlap.unwrap_or(false) {
        return Err(AppError::Conflict(
            "Leave request overlaps with an existing request".into(),
        ));
    }

    // Get leave type code/name (already validated above) and user name
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

    let r = sqlx::query!(
        r#"
        INSERT INTO leave_requests (id, user_id, leave_type_id, start_date, end_date, hours, reason, status)
        VALUES ($1, $2, $3, $4, $5, $6::FLOAT8::NUMERIC, $7, 'pending')
        RETURNING id, user_id, leave_type_id, start_date, end_date,
                  hours::FLOAT8 AS hours, reason,
                  status AS "status: LeaveStatus",
                  reviewed_by, reviewer_notes, created_at, updated_at
        "#,
        Uuid::new_v4(),
        auth.id,
        body.leave_type_id,
        body.start_date,
        body.end_date,
        body.hours,
        body.reason,
    )
    .fetch_one(&pool)
    .await?;

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
        reason: r.reason,
        status: r.status,
        reviewed_by: r.reviewed_by,
        reviewer_notes: r.reviewer_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
}

pub async fn cancel(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let can_cancel_others = auth.role.can_approve_leave();

    let rows = sqlx::query!(
        r#"
        UPDATE leave_requests
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
          AND status IN ('pending', 'approved')
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = leave_requests.user_id AND u.org_id = $2)
          AND ($3 OR leave_requests.user_id = $4)
        "#,
        id,
        auth.org_id,
        can_cancel_others,
        auth.id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound(
            "Leave request not found or cannot be cancelled (already denied or cancelled)".into(),
        ));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn review(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewLeaveRequest>,
) -> Result<Json<LeaveRequest>> {
    if !auth.role.can_approve_leave() {
        return Err(AppError::Forbidden);
    }

    if !matches!(body.status, LeaveStatus::Approved | LeaveStatus::Denied) {
        return Err(AppError::BadRequest(
            "status must be 'approved' or 'denied'".into(),
        ));
    }

    let rows_affected = sqlx::query!(
        r#"
        UPDATE leave_requests
        SET status         = $2,
            reviewed_by    = $3,
            reviewer_notes = $4,
            updated_at     = NOW()
        WHERE id = $1
          AND status = 'pending'
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = leave_requests.user_id AND u.org_id = $5)
        "#,
        id,
        body.status as LeaveStatus,
        auth.id,
        body.reviewer_notes,
        auth.org_id,
    )
    .execute(&pool)
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
               lr.reason,
               lr.status AS "status: LeaveStatus",
               lr.reviewed_by, lr.reviewer_notes, lr.created_at, lr.updated_at
        FROM leave_requests lr
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        JOIN users u ON u.id = lr.user_id
        WHERE lr.id = $1
        "#,
        id
    )
    .fetch_one(&pool)
    .await?;

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
        reason: r.reason,
        status: r.status,
        reviewed_by: r.reviewed_by,
        reviewer_notes: r.reviewer_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
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
