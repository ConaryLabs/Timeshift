use axum::{extract::State, Json};
use sqlx::PgPool;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::organization::{Organization, UpdateOrganizationRequest},
};

/// Get the caller's own organization.
pub async fn get_own(State(pool): State<PgPool>, auth: AuthUser) -> Result<Json<Organization>> {
    let org = sqlx::query_as!(
        Organization,
        "SELECT id, name, slug, timezone, created_at, updated_at
         FROM organizations WHERE id = $1",
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Organization not found".into()))?;

    Ok(Json(org))
}

/// Update the caller's own organization (admin only).
pub async fn update_own(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<UpdateOrganizationRequest>,
) -> Result<Json<Organization>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let org = sqlx::query_as!(
        Organization,
        r#"
        UPDATE organizations
        SET name     = COALESCE($2, name),
            timezone = COALESCE($3, timezone),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, slug, timezone, created_at, updated_at
        "#,
        auth.org_id,
        req.name.as_deref(),
        req.timezone.as_deref(),
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Organization not found".into()))?;

    Ok(Json(org))
}
