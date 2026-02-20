use axum::{
    extract::{Path, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::classification::{
        Classification, CreateClassificationRequest, UpdateClassificationRequest,
    },
};

pub async fn list(State(pool): State<PgPool>, auth: AuthUser) -> Result<Json<Vec<Classification>>> {
    let rows = sqlx::query_as!(
        Classification,
        r#"
        SELECT id, org_id, name, abbreviation, display_order, is_active, created_at
        FROM classifications
        WHERE org_id = $1 AND is_active = true
        ORDER BY display_order, name
        "#,
        auth.org_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateClassificationRequest>,
) -> Result<Json<Classification>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let display_order = req.display_order.unwrap_or(0);

    let row = sqlx::query_as!(
        Classification,
        r#"
        INSERT INTO classifications (id, org_id, name, abbreviation, display_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, org_id, name, abbreviation, display_order, is_active, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name,
        req.abbreviation,
        display_order,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn update(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateClassificationRequest>,
) -> Result<Json<Classification>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let row = sqlx::query_as!(
        Classification,
        r#"
        UPDATE classifications
        SET name          = COALESCE($2, name),
            abbreviation  = COALESCE($3, abbreviation),
            display_order = COALESCE($4, display_order),
            is_active     = COALESCE($5, is_active)
        WHERE id = $1 AND org_id = $6
        RETURNING id, org_id, name, abbreviation, display_order, is_active, created_at
        "#,
        id,
        req.name,
        req.abbreviation,
        req.display_order,
        req.is_active,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Classification not found".into()))?;

    Ok(Json(row))
}
