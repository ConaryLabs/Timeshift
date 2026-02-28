use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    api::helpers::{ensure_rows_affected, json_ok},
    auth::AuthUser,
    error::{AppError, Result},
    models::special_assignment::{
        CreateSpecialAssignmentRequest, SpecialAssignment, SpecialAssignmentListParams,
        UpdateSpecialAssignmentRequest,
    },
    org_guard,
};

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<SpecialAssignmentListParams>,
) -> Result<Json<Vec<SpecialAssignment>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        r#"
        SELECT sa.id, sa.org_id, sa.user_id,
               u.first_name AS user_first_name,
               u.last_name AS user_last_name,
               sa.assignment_type, sa.start_date, sa.end_date,
               sa.notes, sa.assigned_by, sa.created_at, sa.updated_at
        FROM special_assignments sa
        JOIN users u ON u.id = sa.user_id
        WHERE sa.org_id = $1
          AND ($2::uuid IS NULL OR sa.user_id = $2)
          AND ($3::varchar IS NULL OR sa.assignment_type = $3)
          AND ($4::date IS NULL OR (sa.start_date <= $4 AND (sa.end_date IS NULL OR sa.end_date >= $4)))
        ORDER BY sa.start_date DESC, u.last_name, u.first_name
        LIMIT 500
        "#,
        auth.org_id,
        params.user_id,
        params.assignment_type,
        params.active_on,
    )
    .fetch_all(&pool)
    .await?;

    let assignments = rows
        .into_iter()
        .map(|r| SpecialAssignment {
            id: r.id,
            org_id: r.org_id,
            user_id: r.user_id,
            user_first_name: r.user_first_name,
            user_last_name: r.user_last_name,
            assignment_type: r.assignment_type,
            start_date: r.start_date,
            end_date: r.end_date,
            notes: r.notes,
            assigned_by: r.assigned_by,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(assignments))
}

pub async fn get_one(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<SpecialAssignment>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let r = sqlx::query!(
        r#"
        SELECT sa.id, sa.org_id, sa.user_id,
               u.first_name AS user_first_name,
               u.last_name AS user_last_name,
               sa.assignment_type, sa.start_date, sa.end_date,
               sa.notes, sa.assigned_by, sa.created_at, sa.updated_at
        FROM special_assignments sa
        JOIN users u ON u.id = sa.user_id
        WHERE sa.id = $1 AND sa.org_id = $2
        "#,
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Special assignment not found".into()))?;

    Ok(Json(SpecialAssignment {
        id: r.id,
        org_id: r.org_id,
        user_id: r.user_id,
        user_first_name: r.user_first_name,
        user_last_name: r.user_last_name,
        assignment_type: r.assignment_type,
        start_date: r.start_date,
        end_date: r.end_date,
        notes: r.notes,
        assigned_by: r.assigned_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateSpecialAssignmentRequest>,
) -> Result<Json<SpecialAssignment>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if req.assignment_type.is_empty() || req.assignment_type.len() > 100 {
        return Err(AppError::BadRequest(
            "assignment_type must be between 1 and 100 characters".into(),
        ));
    }

    if let Some(end) = req.end_date {
        if end < req.start_date {
            return Err(AppError::BadRequest(
                "end_date must be >= start_date".into(),
            ));
        }
    }

    org_guard::verify_user(&pool, req.user_id, auth.org_id).await?;

    let id = Uuid::new_v4();
    let r = sqlx::query!(
        r#"
        INSERT INTO special_assignments (id, org_id, user_id, assignment_type, start_date, end_date, notes, assigned_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, org_id, user_id, assignment_type, start_date, end_date, notes, assigned_by, created_at, updated_at
        "#,
        id,
        auth.org_id,
        req.user_id,
        req.assignment_type,
        req.start_date,
        req.end_date,
        req.notes,
        auth.id,
    )
    .fetch_one(&pool)
    .await?;

    let user = sqlx::query!(
        "SELECT first_name, last_name FROM users WHERE id = $1",
        req.user_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(SpecialAssignment {
        id: r.id,
        org_id: r.org_id,
        user_id: r.user_id,
        user_first_name: user.first_name,
        user_last_name: user.last_name,
        assignment_type: r.assignment_type,
        start_date: r.start_date,
        end_date: r.end_date,
        notes: r.notes,
        assigned_by: r.assigned_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
}

pub async fn update(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateSpecialAssignmentRequest>,
) -> Result<Json<SpecialAssignment>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if let Some(ref at) = req.assignment_type {
        if at.is_empty() || at.len() > 100 {
            return Err(AppError::BadRequest(
                "assignment_type must be between 1 and 100 characters".into(),
            ));
        }
    }

    let end_provided = req.end_date.is_some();
    let end_val = req.end_date.flatten();
    let notes_provided = req.notes.is_some();
    let notes_val = req.notes.flatten();

    let r = sqlx::query!(
        r#"
        UPDATE special_assignments
        SET assignment_type = COALESCE($2, assignment_type),
            end_date = CASE WHEN $3 THEN $4 ELSE end_date END,
            notes = CASE WHEN $5 THEN $6 ELSE notes END,
            updated_at = NOW()
        WHERE id = $1 AND org_id = $7
        RETURNING id, org_id, user_id, assignment_type, start_date, end_date, notes, assigned_by, created_at, updated_at
        "#,
        id,
        req.assignment_type,
        end_provided,
        end_val,
        notes_provided,
        notes_val,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Special assignment not found".into()))?;

    let user = sqlx::query!(
        "SELECT first_name, last_name FROM users WHERE id = $1",
        r.user_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(SpecialAssignment {
        id: r.id,
        org_id: r.org_id,
        user_id: r.user_id,
        user_first_name: user.first_name,
        user_last_name: user.last_name,
        assignment_type: r.assignment_type,
        start_date: r.start_date,
        end_date: r.end_date,
        notes: r.notes,
        assigned_by: r.assigned_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
}

pub async fn delete(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "DELETE FROM special_assignments WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    ensure_rows_affected(rows, "Special assignment")?;
    Ok(json_ok())
}
