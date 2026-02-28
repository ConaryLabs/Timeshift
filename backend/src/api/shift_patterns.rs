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
        CreatePatternAssignmentRequest, CreateShiftPatternRequest, CycleDateQuery, CycleInfo,
        ShiftPattern, ShiftPatternAssignment, ShiftPatternAssignmentRow, UpdateShiftPatternRequest,
    },
    org_guard,
};

pub async fn list(State(pool): State<PgPool>, auth: AuthUser) -> Result<Json<Vec<ShiftPattern>>> {
    let rows = sqlx::query_as!(
        ShiftPattern,
        r#"
        SELECT id, org_id, name, pattern_days, work_days, off_days,
               anchor_date, team_id AS "team_id?", is_active,
               work_days_in_cycle,
               created_at, updated_at
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

    if req.pattern_days < 1 || req.pattern_days > 366 {
        return Err(AppError::BadRequest(
            "pattern_days must be between 1 and 366".into(),
        ));
    }

    // Determine work_days and off_days based on whether complex or simple pattern
    let (work_days, off_days) = if let Some(ref mask) = req.work_days_in_cycle {
        // Complex pattern: validate mask values
        if mask.is_empty() {
            return Err(AppError::BadRequest(
                "work_days_in_cycle must not be empty".into(),
            ));
        }
        let mut seen = std::collections::HashSet::new();
        for &d in mask {
            if d < 1 || d > req.pattern_days {
                return Err(AppError::BadRequest(format!(
                    "work_days_in_cycle values must be between 1 and {}",
                    req.pattern_days
                )));
            }
            if !seen.insert(d) {
                return Err(AppError::BadRequest(format!(
                    "work_days_in_cycle contains duplicate day: {}",
                    d
                )));
            }
        }
        // Derive work_days and off_days from the mask
        let wd = mask.len() as i32;
        (wd, req.pattern_days - wd)
    } else {
        // Simple pattern: require work_days and off_days
        let wd = req.work_days.ok_or_else(|| {
            AppError::BadRequest(
                "work_days is required for simple patterns (or provide work_days_in_cycle)".into(),
            )
        })?;
        let od = req.off_days.ok_or_else(|| {
            AppError::BadRequest(
                "off_days is required for simple patterns (or provide work_days_in_cycle)".into(),
            )
        })?;
        if wd < 0 || od < 0 {
            return Err(AppError::BadRequest(
                "work_days and off_days must be non-negative".into(),
            ));
        }
        if wd + od != req.pattern_days {
            return Err(AppError::BadRequest(
                "work_days + off_days must equal pattern_days".into(),
            ));
        }
        (wd, od)
    };

    if let Some(team_id) = req.team_id {
        org_guard::verify_team(&pool, team_id, auth.org_id).await?;
    }

    let row = sqlx::query_as!(
        ShiftPattern,
        r#"
        INSERT INTO shift_patterns (id, org_id, name, pattern_days, work_days, off_days,
                                    anchor_date, team_id, work_days_in_cycle)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, org_id, name, pattern_days, work_days, off_days,
                  anchor_date, team_id AS "team_id?", is_active,
                  work_days_in_cycle,
                  created_at, updated_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name.trim(),
        req.pattern_days,
        work_days,
        off_days,
        req.anchor_date,
        req.team_id,
        req.work_days_in_cycle.as_deref(),
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

    let _existing = sqlx::query!(
        "SELECT id FROM shift_patterns WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Shift pattern not found".into()))?;

    if let Some(Some(team_id)) = req.team_id {
        org_guard::verify_team(&pool, team_id, auth.org_id).await?;
    }

    // If any of pattern_days/work_days/off_days are being changed, validate the invariant
    if req.pattern_days.is_some() || req.work_days.is_some() || req.off_days.is_some() {
        let existing = sqlx::query!(
            "SELECT pattern_days, work_days, off_days FROM shift_patterns WHERE id = $1 AND org_id = $2",
            id,
            auth.org_id,
        )
        .fetch_one(&pool)
        .await?;

        let pd = req.pattern_days.unwrap_or(existing.pattern_days);
        let wd = req.work_days.unwrap_or(existing.work_days);
        let od = req.off_days.unwrap_or(existing.off_days);
        if wd + od != pd {
            return Err(AppError::BadRequest(
                "work_days + off_days must equal pattern_days".into(),
            ));
        }
    }

    let wdic_provided = req.work_days_in_cycle.is_some();
    let wdic_value = req.work_days_in_cycle.flatten();

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
            work_days_in_cycle = CASE WHEN $11 THEN $12 ELSE work_days_in_cycle END,
            updated_at = NOW()
        WHERE id = $1 AND org_id = $2
        RETURNING id, org_id, name, pattern_days, work_days, off_days,
                  anchor_date, team_id AS "team_id?", is_active,
                  work_days_in_cycle,
                  created_at, updated_at
        "#,
        id,
        auth.org_id,
        req.name.as_deref(),
        req.pattern_days,
        req.work_days,
        req.off_days,
        req.anchor_date,
        req.team_id.is_some(),
        req.team_id.flatten(),
        req.is_active,
        wdic_provided,
        wdic_value.as_deref(),
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
               anchor_date, team_id AS "team_id?", is_active,
               work_days_in_cycle,
               created_at, updated_at
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
    let is_work_day = pattern.is_work_day(cycle_day);

    Ok(Json(CycleInfo {
        pattern_id: pattern.id,
        pattern_name: pattern.name,
        date: q.date,
        cycle_day,
        is_work_day,
        pattern_days: pattern.pattern_days,
        work_days: pattern.work_days,
        off_days: pattern.off_days,
        work_days_in_cycle: pattern.work_days_in_cycle,
    }))
}

// ---------------------------------------------------------------------------
// Shift Pattern Assignments
// ---------------------------------------------------------------------------

/// GET /api/shift-pattern-assignments
/// List all active pattern assignments for the org.
pub async fn list_assignments(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<ShiftPatternAssignmentRow>>> {
    let rows = sqlx::query!(
        r#"
        SELECT spa.id, spa.user_id,
               (u.first_name || ' ' || u.last_name) AS "user_name!",
               spa.pattern_id,
               sp.name AS "pattern_name!",
               spa.effective_from,
               spa.effective_to
        FROM shift_pattern_assignments spa
        JOIN users u ON u.id = spa.user_id
        JOIN shift_patterns sp ON sp.id = spa.pattern_id
        WHERE spa.org_id = $1
        ORDER BY u.last_name, u.first_name
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| ShiftPatternAssignmentRow {
            id: r.id,
            user_id: r.user_id,
            user_name: r.user_name,
            pattern_id: r.pattern_id,
            pattern_name: r.pattern_name,
            effective_from: r.effective_from,
            effective_to: r.effective_to,
        })
        .collect();

    Ok(Json(result))
}

/// POST /api/shift-pattern-assignments
pub async fn create_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreatePatternAssignmentRequest>,
) -> Result<Json<ShiftPatternAssignment>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify user belongs to org
    let user_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND org_id = $2 AND is_active = true)",
        req.user_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;
    if user_exists != Some(true) {
        return Err(AppError::NotFound("User not found".into()));
    }

    // Verify pattern belongs to org
    let pattern_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM shift_patterns WHERE id = $1 AND org_id = $2 AND is_active = true)",
        req.pattern_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;
    if pattern_exists != Some(true) {
        return Err(AppError::NotFound("Shift pattern not found".into()));
    }

    // Validate: new effective_from must not predate any existing active assignment's effective_from
    let existing = sqlx::query!(
        r#"
        SELECT id, effective_from
        FROM shift_pattern_assignments
        WHERE user_id = $1 AND org_id = $2 AND effective_to IS NULL
        "#,
        req.user_id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?;

    if let Some(ref ex) = existing {
        if req.effective_from < ex.effective_from {
            return Err(AppError::BadRequest(
                "effective_from cannot be earlier than the current assignment's effective_from".into(),
            ));
        }
    }

    // Wrap close-old + insert-new in a transaction
    let mut tx = pool.begin().await?;

    // End any existing active assignment for this user (only those starting on or before new date)
    sqlx::query!(
        r#"
        UPDATE shift_pattern_assignments
        SET effective_to = $3, updated_at = NOW()
        WHERE user_id = $1 AND org_id = $2 AND effective_to IS NULL
          AND effective_from <= $3
        "#,
        req.user_id,
        auth.org_id,
        req.effective_from,
    )
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as!(
        ShiftPatternAssignment,
        r#"
        INSERT INTO shift_pattern_assignments (id, org_id, user_id, pattern_id, effective_from, effective_to)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, org_id, user_id, pattern_id, effective_from, effective_to, created_at, updated_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.user_id,
        req.pattern_id,
        req.effective_from,
        req.effective_to,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

/// DELETE /api/shift-pattern-assignments/:id
pub async fn delete_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "DELETE FROM shift_pattern_assignments WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Assignment not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
