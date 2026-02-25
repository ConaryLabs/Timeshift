use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::shift_pattern::{
        CreateShiftPatternRequest, CycleDateQuery, CycleInfo, ShiftPattern,
        UpdateShiftPatternRequest,
    },
    // org_guard not used (no verify_team available; inline check instead)
};

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<ShiftPattern>>> {
    let rows = sqlx::query_as!(
        ShiftPattern,
        r#"
        SELECT id, org_id, name, pattern_days, work_days, off_days,
               anchor_date, team_id AS "team_id?", is_active, created_at, updated_at
        FROM shift_patterns
        WHERE org_id = $1 AND is_active = true
        ORDER BY name
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateShiftPatternRequest>,
) -> Result<Json<ShiftPattern>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("Name is required".into()));
    }

    if req.pattern_days < 1 {
        return Err(AppError::BadRequest(
            "pattern_days must be at least 1".into(),
        ));
    }

    if req.work_days < 0 || req.off_days < 0 {
        return Err(AppError::BadRequest(
            "work_days and off_days must be non-negative".into(),
        ));
    }

    if req.work_days + req.off_days != req.pattern_days {
        return Err(AppError::BadRequest(
            "work_days + off_days must equal pattern_days".into(),
        ));
    }

    if let Some(team_id) = req.team_id {
        let exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM teams WHERE id = $1 AND org_id = $2)",
            team_id,
            auth.org_id,
        )
        .fetch_one(&pool)
        .await?;
        if exists != Some(true) {
            return Err(AppError::NotFound("Team not found".into()));
        }
    }

    let row = sqlx::query_as!(
        ShiftPattern,
        r#"
        INSERT INTO shift_patterns (id, org_id, name, pattern_days, work_days, off_days, anchor_date, team_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, org_id, name, pattern_days, work_days, off_days,
                  anchor_date, team_id AS "team_id?", is_active, created_at, updated_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name.trim(),
        req.pattern_days,
        req.work_days,
        req.off_days,
        req.anchor_date,
        req.team_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn update(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateShiftPatternRequest>,
) -> Result<Json<ShiftPattern>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify the pattern belongs to the org
    let existing = sqlx::query!(
        "SELECT id FROM shift_patterns WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Shift pattern not found".into()))?;

    // Validate team_id if provided
    if let Some(Some(team_id)) = req.team_id {
        let exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM teams WHERE id = $1 AND org_id = $2)",
            team_id,
            auth.org_id,
        )
        .fetch_one(&pool)
        .await?;
        if exists != Some(true) {
            return Err(AppError::NotFound("Team not found".into()));
        }
    }

    let row = sqlx::query_as!(
        ShiftPattern,
        r#"
        UPDATE shift_patterns SET
            name = COALESCE($3, name),
            pattern_days = COALESCE($4, pattern_days),
            work_days = COALESCE($5, work_days),
            off_days = COALESCE($6, off_days),
            anchor_date = COALESCE($7, anchor_date),
            team_id = CASE WHEN $8 THEN $9 ELSE team_id END,
            is_active = COALESCE($10, is_active),
            updated_at = NOW()
        WHERE id = $1 AND org_id = $2
        RETURNING id, org_id, name, pattern_days, work_days, off_days,
                  anchor_date, team_id AS "team_id?", is_active, created_at, updated_at
        "#,
        existing.id,
        auth.org_id,
        req.name.as_deref(),
        req.pattern_days,
        req.work_days,
        req.off_days,
        req.anchor_date,
        req.team_id.is_some(),
        req.team_id.flatten(),
        req.is_active,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
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
        r#"
        UPDATE shift_patterns SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND org_id = $2 AND is_active = true
        "#,
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Shift pattern not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn cycle(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<CycleDateQuery>,
) -> Result<Json<CycleInfo>> {
    let pattern = sqlx::query_as!(
        ShiftPattern,
        r#"
        SELECT id, org_id, name, pattern_days, work_days, off_days,
               anchor_date, team_id AS "team_id?", is_active, created_at, updated_at
        FROM shift_patterns
        WHERE id = $1 AND org_id = $2
        "#,
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Shift pattern not found".into()))?;

    let days_diff = (q.date - pattern.anchor_date).whole_days();
    let cycle_day = (days_diff.rem_euclid(pattern.pattern_days as i64) + 1) as i32;
    let is_work_day = cycle_day <= pattern.work_days;

    Ok(Json(CycleInfo {
        pattern_id: pattern.id,
        pattern_name: pattern.name,
        date: q.date,
        cycle_day,
        is_work_day,
        pattern_days: pattern.pattern_days,
        work_days: pattern.work_days,
        off_days: pattern.off_days,
    }))
}
