use axum::{
    extract::{Path, State},
    Json,
};
use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use rand_core::OsRng;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::{AuthUser, Role},
    error::{AppError, Result},
    models::user::{CreateUserRequest, EmployeeType, UserProfile},
};

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
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
        "#,
        auth.org_id
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
    .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

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
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
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
    Json(req): Json<serde_json::Value>,
) -> Result<Json<UserProfile>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let classification_id: Option<Uuid> = req["classification_id"]
        .as_str()
        .and_then(|s| s.parse().ok());

    let r = sqlx::query!(
        r#"
        UPDATE users
        SET first_name        = COALESCE($2, first_name),
            last_name         = COALESCE($3, last_name),
            email             = COALESCE($4, email),
            phone             = COALESCE($5, phone),
            classification_id = COALESCE($6, classification_id),
            updated_at        = NOW()
        WHERE id = $1 AND org_id = $7
        RETURNING id, org_id, employee_id, first_name, last_name, email, phone,
                  role AS "role: Role",
                  classification_id,
                  employee_type AS "employee_type: EmployeeType",
                  hire_date, seniority_date, is_active
        "#,
        id,
        req["first_name"].as_str(),
        req["last_name"].as_str(),
        req["email"].as_str(),
        req["phone"].as_str(),
        classification_id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

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

    sqlx::query!(
        "UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id
    )
    .execute(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
