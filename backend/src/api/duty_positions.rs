use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::duty_position::{
        CreateDutyAssignmentRequest, CreateDutyPositionRequest, DutyAssignment,
        DutyAssignmentQuery, DutyAssignmentView, DutyPosition, UpdateDutyAssignmentRequest,
        UpdateDutyPositionRequest,
    },
    org_guard,
};

// -- Duty Positions --

pub async fn list_positions(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<DutyPosition>>> {
    let positions = sqlx::query_as!(
        DutyPosition,
        r#"
        SELECT id, org_id, name, classification_id, sort_order, is_active,
               created_at, updated_at
        FROM duty_positions
        WHERE org_id = $1 AND is_active = true
        ORDER BY sort_order, name
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(positions))
}

pub async fn create_position(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateDutyPositionRequest>,
) -> Result<Json<DutyPosition>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if let Some(cid) = req.classification_id {
        org_guard::verify_classification(&pool, cid, auth.org_id).await?;
    }

    let sort = req.sort_order.unwrap_or(0);

    let pos = sqlx::query_as!(
        DutyPosition,
        r#"
        INSERT INTO duty_positions (id, org_id, name, classification_id, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, org_id, name, classification_id, sort_order, is_active, created_at, updated_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name,
        req.classification_id,
        sort,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(pos))
}

pub async fn update_position(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateDutyPositionRequest>,
) -> Result<Json<DutyPosition>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // If classification_id is being set, verify it belongs to the org
    if let Some(Some(cid)) = req.classification_id {
        org_guard::verify_classification(&pool, cid, auth.org_id).await?;
    }

    let classification_provided = req.classification_id.is_some();
    let classification_value = req.classification_id.flatten();

    let pos = sqlx::query_as!(
        DutyPosition,
        r#"
        UPDATE duty_positions
        SET name              = COALESCE($2, name),
            classification_id = CASE WHEN $3 THEN $4 ELSE classification_id END,
            sort_order        = COALESCE($5, sort_order),
            is_active         = COALESCE($6, is_active),
            updated_at        = NOW()
        WHERE id = $1 AND org_id = $7
        RETURNING id, org_id, name, classification_id, sort_order, is_active, created_at, updated_at
        "#,
        id,
        req.name.as_deref(),
        classification_provided,
        classification_value,
        req.sort_order,
        req.is_active,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Duty position not found".into()))?;

    Ok(Json(pos))
}

pub async fn delete_position(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        r#"
        UPDATE duty_positions
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND org_id = $2 AND is_active = true
        "#,
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Duty position not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// -- Duty Assignments --

pub async fn list_assignments(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<DutyAssignmentQuery>,
) -> Result<Json<Vec<DutyAssignmentView>>> {
    let assignments = sqlx::query_as!(
        DutyAssignmentView,
        r#"
        SELECT da.id, da.org_id, da.duty_position_id,
               dp.name AS duty_position_name,
               da.user_id,
               u.first_name AS user_first_name,
               u.last_name AS user_last_name,
               da.date, da.shift_template_id,
               st.name AS "shift_template_name?",
               da.notes, da.assigned_by,
               da.created_at, da.updated_at
        FROM duty_assignments da
        JOIN duty_positions dp ON dp.id = da.duty_position_id
        JOIN users u ON u.id = da.user_id
        LEFT JOIN shift_templates st ON st.id = da.shift_template_id
        WHERE da.org_id = $1
          AND da.date = $2
          AND ($3::UUID IS NULL OR da.shift_template_id = $3)
        ORDER BY dp.sort_order, dp.name
        "#,
        auth.org_id,
        params.date,
        params.shift_template_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(assignments))
}

pub async fn create_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateDutyAssignmentRequest>,
) -> Result<Json<DutyAssignment>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify duty_position belongs to org
    let pos_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM duty_positions WHERE id = $1 AND org_id = $2 AND is_active = true)",
        req.duty_position_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !pos_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Duty position not found".into()));
    }

    // Verify user belongs to org
    org_guard::verify_user(&pool, req.user_id, auth.org_id).await?;

    // Verify shift_template if provided
    if let Some(tid) = req.shift_template_id {
        org_guard::verify_shift_template(&pool, tid, auth.org_id).await?;
    }

    let assignment = sqlx::query_as!(
        DutyAssignment,
        r#"
        INSERT INTO duty_assignments (id, org_id, duty_position_id, user_id, date, shift_template_id, notes, assigned_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, org_id, duty_position_id, user_id, date, shift_template_id, notes, assigned_by, created_at, updated_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.duty_position_id,
        req.user_id,
        req.date,
        req.shift_template_id,
        req.notes,
        auth.id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(assignment))
}

pub async fn update_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateDutyAssignmentRequest>,
) -> Result<Json<DutyAssignment>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if let Some(uid) = req.user_id {
        org_guard::verify_user(&pool, uid, auth.org_id).await?;
    }

    let notes_provided = req.notes.is_some();
    let notes_value = req.notes.flatten();

    let assignment = sqlx::query_as!(
        DutyAssignment,
        r#"
        UPDATE duty_assignments
        SET user_id    = COALESCE($2, user_id),
            notes      = CASE WHEN $3 THEN $4 ELSE notes END,
            updated_at = NOW()
        WHERE id = $1 AND org_id = $5
        RETURNING id, org_id, duty_position_id, user_id, date, shift_template_id, notes, assigned_by, created_at, updated_at
        "#,
        id,
        req.user_id,
        notes_provided,
        notes_value,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Duty assignment not found".into()))?;

    Ok(Json(assignment))
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
        "DELETE FROM duty_assignments WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Duty assignment not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
