use axum::{extract::State, Json};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use sqlx::PgPool;

use crate::{
    auth::{create_token, AuthUser, Role},
    error::{AppError, Result},
    models::user::{EmployeeType, LoginRequest, LoginResponse, User, UserProfile},
    AppState,
};

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>> {
    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, org_id, employee_id, first_name, last_name, email, phone,
               password_hash,
               role AS "role: Role",
               classification_id,
               employee_type AS "employee_type: EmployeeType",
               hire_date, seniority_date, is_active,
               created_at, updated_at
        FROM users
        WHERE email = $1 AND is_active = true
        "#,
        req.email
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let parsed = PasswordHash::new(&user.password_hash)
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Invalid stored hash")))?;

    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed)
        .map_err(|_| AppError::Unauthorized)?;

    let expiry: u64 = std::env::var("JWT_EXPIRY_HOURS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(12);

    let token = create_token(user.id, user.org_id, user.role.clone(), &state.jwt_secret, expiry)
        .map_err(AppError::Internal)?;

    // Fetch classification name if set
    let classification_name = if let Some(cid) = user.classification_id {
        sqlx::query_scalar!("SELECT name FROM classifications WHERE id = $1", cid)
            .fetch_optional(&state.pool)
            .await?
    } else {
        None
    };

    Ok(Json(LoginResponse {
        token,
        user: UserProfile {
            id: user.id,
            org_id: user.org_id,
            employee_id: user.employee_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            classification_id: user.classification_id,
            classification_name,
            employee_type: user.employee_type,
            hire_date: user.hire_date,
            seniority_date: user.seniority_date,
            is_active: user.is_active,
        },
    }))
}

pub async fn me(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<UserProfile>> {
    let row = sqlx::query!(
        r#"
        SELECT u.id, u.org_id, u.employee_id, u.first_name, u.last_name, u.email, u.phone,
               u.role AS "role: Role",
               u.classification_id,
               c.name AS "classification_name?",
               u.employee_type AS "employee_type: EmployeeType",
               u.hire_date, u.seniority_date, u.is_active
        FROM users u
        LEFT JOIN classifications c ON c.id = u.classification_id
        WHERE u.id = $1
        "#,
        auth.id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(UserProfile {
        id: row.id,
        org_id: row.org_id,
        employee_id: row.employee_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        classification_id: row.classification_id,
        classification_name: row.classification_name,
        employee_type: row.employee_type,
        hire_date: row.hire_date,
        seniority_date: row.seniority_date,
        is_active: row.is_active,
    }))
}
