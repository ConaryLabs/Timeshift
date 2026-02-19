use axum::{
    extract::{Path, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::organization::{CreateOrganizationRequest, Organization},
};

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<Organization>>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let orgs = sqlx::query_as!(
        Organization,
        "SELECT id, name, slug, timezone, created_at, updated_at
         FROM organizations ORDER BY name"
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(orgs))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateOrganizationRequest>,
) -> Result<Json<Organization>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let tz = req.timezone.unwrap_or_else(|| "America/Los_Angeles".into());

    let org = sqlx::query_as!(
        Organization,
        r#"
        INSERT INTO organizations (id, name, slug, timezone)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, slug, timezone, created_at, updated_at
        "#,
        Uuid::new_v4(),
        req.name,
        req.slug,
        tz,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(org))
}

pub async fn get(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Organization>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let org = sqlx::query_as!(
        Organization,
        "SELECT id, name, slug, timezone, created_at, updated_at
         FROM organizations WHERE id = $1",
        id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Organization {} not found", id)))?;

    Ok(Json(org))
}
