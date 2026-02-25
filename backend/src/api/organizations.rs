use axum::{extract::State, Json};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::organization::{Organization, UpdateOrganizationRequest},
    models::report::{OrgSetting, SetOrgSettingRequest},
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
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Validate timezone is a real IANA timezone recognized by chrono-tz
    if let Some(ref tz) = req.timezone {
        crate::services::timezone::parse_tz(tz).map_err(|_| {
            AppError::BadRequest(
                "Invalid timezone. Must be a valid IANA timezone (e.g. 'America/Los_Angeles')"
                    .into(),
            )
        })?;
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

/// List all org settings (admin only).
pub async fn list_settings(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<OrgSetting>>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query_as!(
        OrgSetting,
        r#"
        SELECT id, org_id, key, value, updated_at
        FROM org_settings
        WHERE org_id = $1
        ORDER BY key
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

/// Set/update an org setting (admin only). Upserts by key.
pub async fn set_setting(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<SetOrgSettingRequest>,
) -> Result<Json<OrgSetting>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    if req.key.is_empty() || req.key.len() > 100 {
        return Err(AppError::BadRequest("key must be 1-100 characters".into()));
    }

    // Cap value payload at 64KB
    if req.value.to_string().len() > 65_536 {
        return Err(AppError::BadRequest(
            "Setting value too large (max 64KB)".into(),
        ));
    }

    let row = sqlx::query_as!(
        OrgSetting,
        r#"
        INSERT INTO org_settings (id, org_id, key, value, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (org_id, key) DO UPDATE
        SET value = $4, updated_at = NOW()
        RETURNING id, org_id, key, value, updated_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.key,
        req.value,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}
