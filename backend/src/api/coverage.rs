use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::schedule::{
        CoverageQuery, CoverageRequirement, CreateCoverageRequirementRequest,
        UpdateCoverageRequirementRequest,
    },
    org_guard,
};

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<CoverageQuery>,
) -> Result<Json<Vec<CoverageRequirement>>> {
    let rows = sqlx::query_as!(
        CoverageRequirement,
        r#"
        SELECT id, org_id, shift_template_id, classification_id, day_of_week,
               min_headcount, target_headcount, max_headcount, effective_date, created_at
        FROM coverage_requirements
        WHERE org_id = $1
          AND ($2::uuid IS NULL OR shift_template_id = $2)
          AND ($3::uuid IS NULL OR classification_id = $3)
        ORDER BY shift_template_id, classification_id, day_of_week
        "#,
        auth.org_id,
        q.shift_template_id,
        q.classification_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateCoverageRequirementRequest>,
) -> Result<Json<CoverageRequirement>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    if req.day_of_week < 0 || req.day_of_week > 6 {
        return Err(AppError::BadRequest("day_of_week must be 0-6".into()));
    }
    if req.min_headcount < 0 || req.target_headcount < 0 || req.max_headcount < 0 {
        return Err(AppError::BadRequest(
            "Headcounts must be non-negative".into(),
        ));
    }
    if req.min_headcount > req.target_headcount || req.target_headcount > req.max_headcount {
        return Err(AppError::BadRequest(
            "Must have min <= target <= max".into(),
        ));
    }

    org_guard::verify_shift_template(&pool, req.shift_template_id, auth.org_id).await?;
    org_guard::verify_classification(&pool, req.classification_id, auth.org_id).await?;

    let effective = req
        .effective_date
        .unwrap_or_else(|| time::OffsetDateTime::now_utc().date());

    let row = sqlx::query_as!(
        CoverageRequirement,
        r#"
        INSERT INTO coverage_requirements
            (id, org_id, shift_template_id, classification_id, day_of_week,
             min_headcount, target_headcount, max_headcount, effective_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, org_id, shift_template_id, classification_id, day_of_week,
                  min_headcount, target_headcount, max_headcount, effective_date, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.shift_template_id,
        req.classification_id,
        req.day_of_week,
        req.min_headcount,
        req.target_headcount,
        req.max_headcount,
        effective,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn update(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateCoverageRequirementRequest>,
) -> Result<Json<CoverageRequirement>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let mut tx = pool.begin().await?;

    let row = sqlx::query_as!(
        CoverageRequirement,
        r#"
        UPDATE coverage_requirements
        SET min_headcount = COALESCE($3, min_headcount),
            target_headcount = COALESCE($4, target_headcount),
            max_headcount = COALESCE($5, max_headcount)
        WHERE id = $1 AND org_id = $2
        RETURNING id, org_id, shift_template_id, classification_id, day_of_week,
                  min_headcount, target_headcount, max_headcount, effective_date, created_at
        "#,
        id,
        auth.org_id,
        req.min_headcount,
        req.target_headcount,
        req.max_headcount,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Coverage requirement not found".into()))?;

    if row.min_headcount < 0 || row.target_headcount < 0 || row.max_headcount < 0 {
        return Err(AppError::BadRequest(
            "Headcounts must be non-negative".into(),
        ));
    }
    if row.min_headcount > row.target_headcount || row.target_headcount > row.max_headcount {
        return Err(AppError::BadRequest(
            "Must have min <= target <= max".into(),
        ));
    }

    tx.commit().await?;

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
        "DELETE FROM coverage_requirements WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Coverage requirement not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
