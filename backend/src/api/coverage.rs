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

    // Fetch existing row to compute effective values for validation
    let existing = sqlx::query_as!(
        CoverageRequirement,
        r#"
        SELECT id, org_id, shift_template_id, classification_id, day_of_week,
               min_headcount, target_headcount, max_headcount, effective_date, created_at
        FROM coverage_requirements
        WHERE id = $1 AND org_id = $2
        "#,
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Coverage requirement not found".into()))?;

    // Compute effective values: use request field if provided, otherwise existing value
    let eff_min = req.min_headcount.unwrap_or(existing.min_headcount);
    let eff_target = req.target_headcount.unwrap_or(existing.target_headcount);
    let eff_max = req.max_headcount.unwrap_or(existing.max_headcount);

    // Validate before UPDATE
    if eff_min < 0 || eff_target < 0 || eff_max < 0 {
        return Err(AppError::BadRequest(
            "Headcounts must be non-negative".into(),
        ));
    }
    if eff_min > eff_target || eff_target > eff_max {
        return Err(AppError::BadRequest(
            "Must have min <= target <= max".into(),
        ));
    }

    let row = sqlx::query_as!(
        CoverageRequirement,
        r#"
        UPDATE coverage_requirements
        SET min_headcount = $3,
            target_headcount = $4,
            max_headcount = $5
        WHERE id = $1 AND org_id = $2
        RETURNING id, org_id, shift_template_id, classification_id, day_of_week,
                  min_headcount, target_headcount, max_headcount, effective_date, created_at
        "#,
        id,
        auth.org_id,
        eff_min,
        eff_target,
        eff_max,
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
