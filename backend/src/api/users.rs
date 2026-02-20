use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use rand_core::OsRng;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::{AuthUser, Role},
    error::{AppError, Result},
    models::{
        common::PaginationParams,
        user::{CreateUserRequest, EmployeeType, UpdateUserRequest, UserProfile},
    },
    org_guard,
};

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<UserProfile>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        r#"
        SELECT u.id, u.org_id, u.employee_id, u.first_name, u.last_name, u.email, u.phone,
               u.role AS "role: Role",
               u.classification_id,
               c.name AS "classification_name?",
               u.employee_type AS "employee_type: EmployeeType",
               u.hire_date, u.seniority_date, u.is_active
        FROM users u
        LEFT JOIN classifications c ON c.id = u.classification_id
        WHERE u.org_id = $1 AND u.is_active = true
        ORDER BY u.last_name, u.first_name
        LIMIT $2 OFFSET $3
        "#,
        auth.org_id,
        params.limit(),
        params.offset(),
    )
    .fetch_all(&pool)
    .await?;

    let profiles = rows
        .into_iter()
        .map(|r| UserProfile {
            id: r.id,
            org_id: r.org_id,
            employee_id: r.employee_id,
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
            phone: r.phone,
            role: r.role,
            classification_id: r.classification_id,
            classification_name: r.classification_name,
            employee_type: r.employee_type,
            hire_date: r.hire_date,
            seniority_date: r.seniority_date,
            is_active: r.is_active,
        })
        .collect();

    Ok(Json(profiles))
}

pub async fn get_one(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<UserProfile>> {
    if !auth.role.can_manage_schedule() && auth.id != id {
        return Err(AppError::Forbidden);
    }

    let r = sqlx::query!(
        r#"
        SELECT u.id, u.org_id, u.employee_id, u.first_name, u.last_name, u.email, u.phone,
               u.role AS "role: Role",
               u.classification_id,
               c.name AS "classification_name?",
               u.employee_type AS "employee_type: EmployeeType",
               u.hire_date, u.seniority_date, u.is_active
        FROM users u
        LEFT JOIN classifications c ON c.id = u.classification_id
        WHERE u.id = $1 AND u.org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(UserProfile {
        id: r.id,
        org_id: r.org_id,
        employee_id: r.employee_id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        classification_id: r.classification_id,
        classification_name: r.classification_name,
        employee_type: r.employee_type,
        hire_date: r.hire_date,
        seniority_date: r.seniority_date,
        is_active: r.is_active,
    }))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateUserRequest>,
) -> Result<Json<UserProfile>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Verify optional classification belongs to caller's org
    if let Some(cid) = req.classification_id {
        org_guard::verify_classification(&pool, cid, auth.org_id).await?;
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hashing failed: {}", e)))?
        .to_string();

    let employee_type = req.employee_type.unwrap_or(EmployeeType::RegularFullTime);

    let r = sqlx::query!(
        r#"
        INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, phone,
                           password_hash, role, classification_id, employee_type, hire_date, seniority_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, org_id, employee_id, first_name, last_name, email, phone,
                  role AS "role: Role",
                  classification_id,
                  employee_type AS "employee_type: EmployeeType",
                  hire_date, seniority_date, is_active
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.employee_id,
        req.first_name,
        req.last_name,
        req.email,
        req.phone,
        hash,
        req.role as Role,
        req.classification_id,
        employee_type as EmployeeType,
        req.hire_date,
        req.seniority_date,
    )
    .fetch_one(&pool)
    .await?;

    // Fetch classification name if set
    let classification_name = if let Some(cid) = r.classification_id {
        sqlx::query_scalar!("SELECT name FROM classifications WHERE id = $1", cid)
            .fetch_optional(&pool)
            .await?
    } else {
        None
    };

    Ok(Json(UserProfile {
        id: r.id,
        org_id: r.org_id,
        employee_id: r.employee_id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        classification_id: r.classification_id,
        classification_name,
        employee_type: r.employee_type,
        hire_date: r.hire_date,
        seniority_date: r.seniority_date,
        is_active: r.is_active,
    }))
}

pub async fn update(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateUserRequest>,
) -> Result<Json<UserProfile>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Verify optional classification belongs to caller's org
    if let Some(Some(cid)) = req.classification_id {
        org_guard::verify_classification(&pool, cid, auth.org_id).await?;
    }

    // For nullable fields using double-Option:
    //   None         => field not sent, keep existing  ($provided = false)
    //   Some(None)   => explicitly null, clear value   ($provided = true, $value = NULL)
    //   Some(Some(v))=> set to v                       ($provided = true, $value = v)
    let phone_provided = req.phone.is_some();
    let phone_val = req.phone.flatten();
    let class_provided = req.classification_id.is_some();
    let class_val = req.classification_id.flatten();
    let hire_provided = req.hire_date.is_some();
    let hire_val = req.hire_date.flatten();
    let seniority_provided = req.seniority_date.is_some();
    let seniority_val = req.seniority_date.flatten();

    let r = sqlx::query!(
        r#"
        UPDATE users
        SET first_name        = COALESCE($2, first_name),
            last_name         = COALESCE($3, last_name),
            email             = COALESCE($4, email),
            phone             = CASE WHEN $5 THEN $6 ELSE phone END,
            classification_id = CASE WHEN $7 THEN $8 ELSE classification_id END,
            employee_id       = COALESCE($9, employee_id),
            role              = COALESCE($10, role),
            employee_type     = COALESCE($11, employee_type),
            hire_date         = CASE WHEN $12 THEN $13 ELSE hire_date END,
            seniority_date    = CASE WHEN $14 THEN $15 ELSE seniority_date END,
            updated_at        = NOW()
        WHERE id = $1 AND org_id = $16
        RETURNING id, org_id, employee_id, first_name, last_name, email, phone,
                  role AS "role: Role",
                  classification_id,
                  employee_type AS "employee_type: EmployeeType",
                  hire_date, seniority_date, is_active
        "#,
        id,
        req.first_name.as_deref(),
        req.last_name.as_deref(),
        req.email.as_deref(),
        phone_provided,
        phone_val.as_deref(),
        class_provided,
        class_val,
        req.employee_id.as_deref(),
        req.role as Option<Role>,
        req.employee_type as Option<EmployeeType>,
        hire_provided,
        hire_val,
        seniority_provided,
        seniority_val,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    let classification_name = if let Some(cid) = r.classification_id {
        sqlx::query_scalar!("SELECT name FROM classifications WHERE id = $1", cid)
            .fetch_optional(&pool)
            .await?
    } else {
        None
    };

    Ok(Json(UserProfile {
        id: r.id,
        org_id: r.org_id,
        employee_id: r.employee_id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        classification_id: r.classification_id,
        classification_name,
        employee_type: r.employee_type,
        hire_date: r.hire_date,
        seniority_date: r.seniority_date,
        is_active: r.is_active,
    }))
}

pub async fn deactivate(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("User not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
