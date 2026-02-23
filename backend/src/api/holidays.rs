use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::holiday::{CreateHolidayRequest, Holiday, HolidayQuery, UpdateHolidayRequest},
};

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<HolidayQuery>,
) -> Result<Json<Vec<Holiday>>> {
    let rows = sqlx::query_as!(
        Holiday,
        r#"
        SELECT id, org_id, date, name, is_premium_pay, created_at
        FROM holiday_calendar
        WHERE org_id = $1
          AND ($2::int IS NULL OR EXTRACT(YEAR FROM date) = $2)
        ORDER BY date
        "#,
        auth.org_id,
        q.year,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateHolidayRequest>,
) -> Result<Json<Holiday>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let premium = req.is_premium_pay.unwrap_or(false);

    let row = sqlx::query_as!(
        Holiday,
        r#"
        INSERT INTO holiday_calendar (id, org_id, date, name, is_premium_pay)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, org_id, date, name, is_premium_pay, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.date,
        req.name,
        premium,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn update(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateHolidayRequest>,
) -> Result<Json<Holiday>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let row = sqlx::query_as!(
        Holiday,
        r#"
        UPDATE holiday_calendar
        SET name = COALESCE($3, name),
            is_premium_pay = COALESCE($4, is_premium_pay)
        WHERE id = $1 AND org_id = $2
        RETURNING id, org_id, date, name, is_premium_pay, created_at
        "#,
        id,
        auth.org_id,
        req.name,
        req.is_premium_pay,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Holiday not found".into()))?;

    Ok(Json(row))
}

pub async fn delete(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "DELETE FROM holiday_calendar WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Holiday not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
