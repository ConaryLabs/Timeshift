use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::saved_filter::{
        CreateSavedFilterRequest, SavedFilter, SavedFilterQuery, SetDefaultRequest,
    },
};

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<SavedFilterQuery>,
) -> Result<Json<Vec<SavedFilter>>> {
    let rows = sqlx::query_as!(
        SavedFilter,
        r#"
        SELECT id, org_id, user_id, name, page, filters, is_default, created_at
        FROM saved_filters
        WHERE org_id = $1 AND user_id = $2 AND page = $3
        ORDER BY is_default DESC, name
        "#,
        auth.org_id,
        auth.id,
        q.page,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateSavedFilterRequest>,
) -> Result<Json<SavedFilter>> {
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("Name is required".into()));
    }

    let valid_pages = ["schedule", "coverage", "duty_board"];
    if !valid_pages.contains(&req.page.as_str()) {
        return Err(AppError::BadRequest(
            "page must be 'schedule', 'coverage', or 'duty_board'".into(),
        ));
    }

    let mut tx = pool.begin().await?;

    // If this is set as default, unset other defaults for the same page
    if req.is_default {
        sqlx::query!(
            r#"
            UPDATE saved_filters SET is_default = FALSE
            WHERE org_id = $1 AND user_id = $2 AND page = $3 AND is_default = TRUE
            "#,
            auth.org_id,
            auth.id,
            req.page,
        )
        .execute(&mut *tx)
        .await?;
    }

    let row = sqlx::query_as!(
        SavedFilter,
        r#"
        INSERT INTO saved_filters (id, org_id, user_id, name, page, filters, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, org_id, user_id, name, page, filters, is_default, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        auth.id,
        req.name.trim(),
        req.page,
        req.filters,
        req.is_default,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

pub async fn delete(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let rows = sqlx::query!(
        r#"
        DELETE FROM saved_filters
        WHERE id = $1 AND org_id = $2 AND user_id = $3
        "#,
        id,
        auth.org_id,
        auth.id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Saved filter not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn set_default(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<SetDefaultRequest>,
) -> Result<Json<serde_json::Value>> {
    let mut tx = pool.begin().await?;

    // Fetch filter to get the page
    let filter = sqlx::query!(
        r#"
        SELECT page FROM saved_filters
        WHERE id = $1 AND org_id = $2 AND user_id = $3
        "#,
        id,
        auth.org_id,
        auth.id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Saved filter not found".into()))?;

    if req.is_default {
        // Unset other defaults for the same page
        sqlx::query!(
            r#"
            UPDATE saved_filters SET is_default = FALSE
            WHERE org_id = $1 AND user_id = $2 AND page = $3 AND is_default = TRUE
            "#,
            auth.org_id,
            auth.id,
            filter.page,
        )
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query!(
        r#"
        UPDATE saved_filters SET is_default = $4
        WHERE id = $1 AND org_id = $2 AND user_id = $3
        "#,
        id,
        auth.org_id,
        auth.id,
        req.is_default,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
