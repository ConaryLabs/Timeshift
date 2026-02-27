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
        CreateDutyAssignmentRequest, CreateDutyPositionRequest, CreatePositionHoursRequest,
        CreateQualificationRequest, DutyAssignment, DutyAssignmentQuery, DutyAssignmentView,
        DutyPosition, DutyPositionHours, Qualification, QualificationMappingRequest,
        UpdateDutyAssignmentRequest, UpdateDutyPositionRequest, UpdatePositionHoursRequest,
        UpdateQualificationRequest, UserQualificationView,
    },
    org_guard,
};

// ============================================================
// Duty Positions CRUD
// ============================================================

pub async fn list_positions(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<DutyPosition>>> {
    let positions = sqlx::query_as!(
        DutyPosition,
        r#"
        SELECT id, org_id, name, classification_id, sort_order, is_active,
               board_date, created_at, updated_at
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
        INSERT INTO duty_positions (id, org_id, name, classification_id, sort_order, board_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, org_id, name, classification_id, sort_order, is_active, board_date, created_at, updated_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name,
        req.classification_id,
        sort,
        req.board_date,
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
        RETURNING id, org_id, name, classification_id, sort_order, is_active, board_date, created_at, updated_at
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

// ============================================================
// Duty Assignments (updated for block-based schema)
// ============================================================

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
               da.user_id AS "user_id?",
               u.first_name AS "user_first_name?",
               u.last_name AS "user_last_name?",
               da.date, da.block_index,
               da.status,
               da.notes, da.assigned_by,
               da.created_at, da.updated_at
        FROM duty_assignments da
        JOIN duty_positions dp ON dp.id = da.duty_position_id
        LEFT JOIN users u ON u.id = da.user_id
        WHERE da.org_id = $1
          AND da.date = $2
        ORDER BY dp.sort_order, dp.name, da.block_index
        "#,
        auth.org_id,
        params.date,
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

    org_guard::verify_user(&pool, req.user_id, auth.org_id).await?;

    let assignment = sqlx::query_as!(
        DutyAssignment,
        r#"
        INSERT INTO duty_assignments (id, org_id, duty_position_id, user_id, date, block_index, status, notes, assigned_by)
        VALUES ($1, $2, $3, $4, $5, $6, 'assigned', $7, $8)
        RETURNING id, org_id, duty_position_id, user_id, date, block_index, status, notes, assigned_by, created_at, updated_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.duty_position_id,
        req.user_id,
        req.date,
        req.block_index,
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
        RETURNING id, org_id, duty_position_id, user_id, date, block_index, status, notes, assigned_by, created_at, updated_at
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

// ============================================================
// Qualifications CRUD
// ============================================================

pub async fn list_qualifications(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<Qualification>>> {
    let quals = sqlx::query_as!(
        Qualification,
        r#"
        SELECT id, org_id, name, description, created_at
        FROM qualifications
        WHERE org_id = $1
        ORDER BY name
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(quals))
}

pub async fn create_qualification(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateQualificationRequest>,
) -> Result<Json<Qualification>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let qual = sqlx::query_as!(
        Qualification,
        r#"
        INSERT INTO qualifications (id, org_id, name, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id, org_id, name, description, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name,
        req.description,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(qual))
}

pub async fn update_qualification(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateQualificationRequest>,
) -> Result<Json<Qualification>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let desc_provided = req.description.is_some();
    let desc_value = req.description.flatten();

    let qual = sqlx::query_as!(
        Qualification,
        r#"
        UPDATE qualifications
        SET name        = COALESCE($2, name),
            description = CASE WHEN $3 THEN $4 ELSE description END
        WHERE id = $1 AND org_id = $5
        RETURNING id, org_id, name, description, created_at
        "#,
        id,
        req.name.as_deref(),
        desc_provided,
        desc_value,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Qualification not found".into()))?;

    Ok(Json(qual))
}

pub async fn delete_qualification(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "DELETE FROM qualifications WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Qualification not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ============================================================
// Position qualification mappings
// ============================================================

pub async fn list_position_qualifications(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(position_id): Path<Uuid>,
) -> Result<Json<Vec<Qualification>>> {
    // Verify position belongs to org
    let pos_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM duty_positions WHERE id = $1 AND org_id = $2)",
        position_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !pos_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Duty position not found".into()));
    }

    let quals = sqlx::query_as!(
        Qualification,
        r#"
        SELECT q.id, q.org_id, q.name, q.description, q.created_at
        FROM qualifications q
        JOIN duty_position_qualifications dpq ON dpq.qualification_id = q.id
        WHERE dpq.duty_position_id = $1
        ORDER BY q.name
        "#,
        position_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(quals))
}

pub async fn add_position_qualification(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(position_id): Path<Uuid>,
    Json(req): Json<QualificationMappingRequest>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify position and qualification belong to org
    let pos_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM duty_positions WHERE id = $1 AND org_id = $2)",
        position_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !pos_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Duty position not found".into()));
    }

    let qual_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM qualifications WHERE id = $1 AND org_id = $2)",
        req.qualification_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !qual_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Qualification not found".into()));
    }

    sqlx::query!(
        r#"
        INSERT INTO duty_position_qualifications (duty_position_id, qualification_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
        position_id,
        req.qualification_id,
    )
    .execute(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn remove_position_qualification(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((position_id, qualification_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify position belongs to org
    let pos_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM duty_positions WHERE id = $1 AND org_id = $2)",
        position_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !pos_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Duty position not found".into()));
    }

    sqlx::query!(
        "DELETE FROM duty_position_qualifications WHERE duty_position_id = $1 AND qualification_id = $2",
        position_id,
        qualification_id,
    )
    .execute(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ============================================================
// User qualifications
// ============================================================

pub async fn list_user_qualifications(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<UserQualificationView>>> {
    org_guard::verify_user(&pool, user_id, auth.org_id).await?;

    let quals = sqlx::query_as!(
        UserQualificationView,
        r#"
        SELECT uq.user_id, uq.qualification_id, q.name AS qualification_name, uq.granted_at
        FROM user_qualifications uq
        JOIN qualifications q ON q.id = uq.qualification_id
        WHERE uq.user_id = $1
        ORDER BY q.name
        "#,
        user_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(quals))
}

pub async fn add_user_qualification(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(user_id): Path<Uuid>,
    Json(req): Json<QualificationMappingRequest>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_user(&pool, user_id, auth.org_id).await?;

    let qual_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM qualifications WHERE id = $1 AND org_id = $2)",
        req.qualification_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !qual_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Qualification not found".into()));
    }

    sqlx::query!(
        r#"
        INSERT INTO user_qualifications (user_id, qualification_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
        user_id,
        req.qualification_id,
    )
    .execute(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn remove_user_qualification(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((user_id, qualification_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_user(&pool, user_id, auth.org_id).await?;

    sqlx::query!(
        "DELETE FROM user_qualifications WHERE user_id = $1 AND qualification_id = $2",
        user_id,
        qualification_id,
    )
    .execute(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ============================================================
// Position operating hours
// ============================================================

pub async fn list_position_hours(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(position_id): Path<Uuid>,
) -> Result<Json<Vec<DutyPositionHours>>> {
    let pos_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM duty_positions WHERE id = $1 AND org_id = $2)",
        position_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !pos_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Duty position not found".into()));
    }

    let hours = sqlx::query_as!(
        DutyPositionHours,
        r#"
        SELECT id, duty_position_id, day_of_week, open_time, close_time, crosses_midnight
        FROM duty_position_hours
        WHERE duty_position_id = $1
        ORDER BY day_of_week
        "#,
        position_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(hours))
}

pub async fn set_position_hours(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(position_id): Path<Uuid>,
    Json(req): Json<CreatePositionHoursRequest>,
) -> Result<Json<DutyPositionHours>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if req.day_of_week < 0 || req.day_of_week > 6 {
        return Err(AppError::BadRequest("day_of_week must be 0-6".into()));
    }

    let pos_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM duty_positions WHERE id = $1 AND org_id = $2)",
        position_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !pos_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Duty position not found".into()));
    }

    let open_time = time::Time::parse(
        &req.open_time,
        &time::format_description::well_known::Iso8601::DEFAULT,
    )
    .or_else(|_| {
        time::Time::parse(
            &req.open_time,
            time::macros::format_description!("[hour]:[minute]"),
        )
    })
    .map_err(|_| AppError::BadRequest("Invalid open_time format (use HH:MM)".into()))?;

    let close_time = time::Time::parse(
        &req.close_time,
        &time::format_description::well_known::Iso8601::DEFAULT,
    )
    .or_else(|_| {
        time::Time::parse(
            &req.close_time,
            time::macros::format_description!("[hour]:[minute]"),
        )
    })
    .map_err(|_| AppError::BadRequest("Invalid close_time format (use HH:MM)".into()))?;

    let crosses = req.crosses_midnight.unwrap_or(false);

    let hours = sqlx::query_as!(
        DutyPositionHours,
        r#"
        INSERT INTO duty_position_hours (id, duty_position_id, day_of_week, open_time, close_time, crosses_midnight)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (duty_position_id, day_of_week)
        DO UPDATE SET open_time = $4, close_time = $5, crosses_midnight = $6
        RETURNING id, duty_position_id, day_of_week, open_time, close_time, crosses_midnight
        "#,
        Uuid::new_v4(),
        position_id,
        req.day_of_week,
        open_time,
        close_time,
        crosses,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(hours))
}

pub async fn update_position_hours(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(hours_id): Path<Uuid>,
    Json(req): Json<UpdatePositionHoursRequest>,
) -> Result<Json<DutyPositionHours>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify the hours record belongs to a position in this org
    let exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM duty_position_hours dph
            JOIN duty_positions dp ON dp.id = dph.duty_position_id
            WHERE dph.id = $1 AND dp.org_id = $2
        )
        "#,
        hours_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !exists.unwrap_or(false) {
        return Err(AppError::NotFound("Position hours not found".into()));
    }

    let open_time = if let Some(ref t) = req.open_time {
        Some(
            time::Time::parse(t, time::macros::format_description!("[hour]:[minute]"))
                .map_err(|_| AppError::BadRequest("Invalid open_time format (use HH:MM)".into()))?,
        )
    } else {
        None
    };

    let close_time = if let Some(ref t) = req.close_time {
        Some(
            time::Time::parse(t, time::macros::format_description!("[hour]:[minute]"))
                .map_err(|_| {
                    AppError::BadRequest("Invalid close_time format (use HH:MM)".into())
                })?,
        )
    } else {
        None
    };

    let hours = sqlx::query_as!(
        DutyPositionHours,
        r#"
        UPDATE duty_position_hours
        SET open_time        = COALESCE($2, open_time),
            close_time       = COALESCE($3, close_time),
            crosses_midnight = COALESCE($4, crosses_midnight)
        WHERE id = $1
        RETURNING id, duty_position_id, day_of_week, open_time, close_time, crosses_midnight
        "#,
        hours_id,
        open_time,
        close_time,
        req.crosses_midnight,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(hours))
}

pub async fn delete_position_hours(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(hours_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        r#"
        DELETE FROM duty_position_hours
        WHERE id = $1 AND duty_position_id IN (
            SELECT id FROM duty_positions WHERE org_id = $2
        )
        "#,
        hours_id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Position hours not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
