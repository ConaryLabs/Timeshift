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
        common::DateRangeParams,
        shift::{
            CreateScheduledShiftRequest, CreateShiftTemplateRequest, ScheduledShift, ShiftTemplate,
            UpdateShiftTemplateRequest,
        },
    },
    org_guard,
};

// -- Shift Templates --

pub async fn list_templates(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<ShiftTemplate>>> {
    let templates = sqlx::query_as!(
        ShiftTemplate,
        r#"
        SELECT id, org_id, name, start_time, end_time, crosses_midnight,
               duration_minutes, color, is_active, created_at
        FROM shift_templates
        WHERE org_id = $1 AND is_active = true
        ORDER BY start_time
        "#,
        auth.org_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(templates))
}

pub async fn get_template(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ShiftTemplate>> {
    let t = sqlx::query_as!(
        ShiftTemplate,
        r#"
        SELECT id, org_id, name, start_time, end_time, crosses_midnight,
               duration_minutes, color, is_active, created_at
        FROM shift_templates WHERE id = $1 AND org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Shift template not found".into()))?;

    Ok(Json(t))
}

pub async fn create_template(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateShiftTemplateRequest>,
) -> Result<Json<ShiftTemplate>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let crosses = req.end_time < req.start_time;
    let duration = if crosses {
        ((24 * 60) - req.start_time.hour() as i32 * 60 - req.start_time.minute() as i32)
            + req.end_time.hour() as i32 * 60
            + req.end_time.minute() as i32
    } else {
        (req.end_time.hour() as i32 - req.start_time.hour() as i32) * 60
            + req.end_time.minute() as i32
            - req.start_time.minute() as i32
    };

    if duration <= 0 {
        return Err(AppError::BadRequest(
            "start_time and end_time must differ".into(),
        ));
    }

    let color = req.color.unwrap_or_else(|| "#4f86c6".into());

    let t = sqlx::query_as!(
        ShiftTemplate,
        r#"
        INSERT INTO shift_templates (id, org_id, name, start_time, end_time, crosses_midnight, duration_minutes, color)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, org_id, name, start_time, end_time, crosses_midnight, duration_minutes, color, is_active, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name,
        req.start_time,
        req.end_time,
        crosses,
        duration,
        color,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(t))
}

pub async fn update_template(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateShiftTemplateRequest>,
) -> Result<Json<ShiftTemplate>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let t = sqlx::query_as!(
        ShiftTemplate,
        r#"
        UPDATE shift_templates
        SET name       = COALESCE($2, name),
            color      = COALESCE($3, color),
            is_active  = COALESCE($4, is_active)
        WHERE id = $1 AND org_id = $5
        RETURNING id, org_id, name, start_time, end_time, crosses_midnight, duration_minutes, color, is_active, created_at
        "#,
        id,
        req.name.as_deref(),
        req.color.as_deref(),
        req.is_active,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Shift template not found".into()))?;

    Ok(Json(t))
}

// -- Scheduled Shifts --

pub async fn list_scheduled(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<Vec<ScheduledShift>>> {
    let shifts = sqlx::query_as!(
        ScheduledShift,
        r#"
        SELECT id, org_id, shift_template_id, date, required_headcount, slot_id, notes, created_at
        FROM scheduled_shifts
        WHERE org_id = $1
          AND ($2::DATE IS NULL OR date >= $2)
          AND ($3::DATE IS NULL OR date <= $3)
        ORDER BY date
        LIMIT $4 OFFSET $5
        "#,
        auth.org_id,
        params.start_date,
        params.end_date,
        params.limit(),
        params.offset(),
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(shifts))
}

pub async fn get_scheduled(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ScheduledShift>> {
    let s = sqlx::query_as!(
        ScheduledShift,
        r#"
        SELECT id, org_id, shift_template_id, date, required_headcount, slot_id, notes, created_at
        FROM scheduled_shifts WHERE id = $1 AND org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Scheduled shift not found".into()))?;

    Ok(Json(s))
}

pub async fn create_scheduled(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateScheduledShiftRequest>,
) -> Result<Json<ScheduledShift>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify shift_template belongs to caller's org
    org_guard::verify_shift_template(&pool, req.shift_template_id, auth.org_id).await?;
    // Verify optional slot belongs to caller's org
    if let Some(slot_id) = req.slot_id {
        org_guard::verify_slot(&pool, slot_id, auth.org_id).await?;
    }

    let headcount = req.required_headcount.unwrap_or(1);

    let s = sqlx::query_as!(
        ScheduledShift,
        r#"
        INSERT INTO scheduled_shifts (id, org_id, shift_template_id, date, required_headcount, slot_id, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, org_id, shift_template_id, date, required_headcount, slot_id, notes, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.shift_template_id,
        req.date,
        headcount,
        req.slot_id,
        req.notes,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(s))
}

pub async fn delete_scheduled(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "DELETE FROM scheduled_shifts WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Scheduled shift not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
