use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::http::StatusCode;
use axum::{extract::State, http::header, response::IntoResponse, Json};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::{create_token, AuthUser, RefreshTokenCookie, Role},
    error::{AppError, Result},
    models::user::{
        BargainingUnit, EmployeeStatus, EmployeeType, LoginRequest, LoginResponse, User,
        UserProfile,
    },
    AppState,
};

/// Hash a raw refresh token with SHA-256 for secure storage.
fn hash_token(raw: &str) -> String {
    hex::encode(Sha256::digest(raw.as_bytes()))
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse> {
    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, org_id, employee_id, first_name, last_name, email, phone,
               password_hash,
               role AS "role: Role",
               classification_id,
               employee_type AS "employee_type: EmployeeType",
               bargaining_unit AS "bargaining_unit: BargainingUnit",
               hire_date, cto_designation,
               admin_training_supervisor_since,
               employee_status AS "employee_status: EmployeeStatus",
               is_active,
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

    let token = create_token(
        user.id,
        user.org_id,
        user.role.clone(),
        &state.jwt_secret,
        state.access_token_expiry_minutes,
    )
    .map_err(AppError::Internal)?;

    // Generate and store refresh token (store SHA-256 hash, send raw as cookie)
    let refresh_raw = Uuid::new_v4().to_string();
    let refresh_hash = hash_token(&refresh_raw);
    let refresh_expires = time::OffsetDateTime::now_utc()
        + time::Duration::days(state.refresh_token_expiry_days as i64);

    // Clean up expired refresh tokens for this user (best-effort)
    if let Err(e) = sqlx::query!(
        "DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()",
        user.id
    )
    .execute(&state.pool)
    .await
    {
        tracing::warn!("Failed to clean up expired refresh tokens: {e}");
    }

    sqlx::query!(
        "INSERT INTO refresh_tokens (user_id, org_id, token, expires_at) VALUES ($1, $2, $3, $4)",
        user.id,
        user.org_id,
        refresh_hash,
        refresh_expires,
    )
    .execute(&state.pool)
    .await?;

    // Cap refresh tokens per user (keep most recent 10)
    if let Err(e) = sqlx::query!(
        r#"
        DELETE FROM refresh_tokens WHERE user_id = $1 AND id NOT IN (
            SELECT id FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
        )
        "#,
        user.id
    )
    .execute(&state.pool)
    .await
    {
        tracing::warn!("Failed to cap refresh tokens: {e}");
    }

    // Fetch classification name if set
    let classification_name = if let Some(cid) = user.classification_id {
        sqlx::query_scalar!("SELECT name FROM classifications WHERE id = $1", cid)
            .fetch_optional(&state.pool)
            .await?
    } else {
        None
    };

    // Fetch seniority record
    let seniority = sqlx::query!(
        "SELECT overall_seniority_date, bargaining_unit_seniority_date, classification_seniority_date,
                accrual_pause_started_at
         FROM seniority_records WHERE user_id = $1",
        user.id
    )
    .fetch_optional(&state.pool)
    .await?;

    let secure_flag = if state.cookie_secure { "; Secure" } else { "" };

    let auth_cookie = format!(
        "auth_token={}; HttpOnly; SameSite=Strict; Path=/; Max-Age={}{}",
        token,
        state.access_token_expiry_minutes * 60,
        secure_flag,
    );
    let refresh_cookie = format!(
        "refresh_token={}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={}{}",
        refresh_raw,
        state.refresh_token_expiry_days * 86400,
        secure_flag,
    );

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        auth_cookie.parse().map_err(|_| {
            AppError::Internal(anyhow::anyhow!("Failed to build Set-Cookie header"))
        })?,
    );
    headers.append(
        header::SET_COOKIE,
        refresh_cookie.parse().map_err(|_| {
            AppError::Internal(anyhow::anyhow!("Failed to build Set-Cookie header"))
        })?,
    );

    Ok((
        headers,
        Json(LoginResponse {
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
                bargaining_unit: user.bargaining_unit,
                hire_date: user.hire_date,
                overall_seniority_date: seniority.as_ref().and_then(|s| s.overall_seniority_date),
                bargaining_unit_seniority_date: seniority.as_ref().and_then(|s| s.bargaining_unit_seniority_date),
                classification_seniority_date: seniority.as_ref().and_then(|s| s.classification_seniority_date),
                cto_designation: user.cto_designation,
                admin_training_supervisor_since: user.admin_training_supervisor_since,
                employee_status: user.employee_status,
                accrual_paused_since: seniority.as_ref().and_then(|s| s.accrual_pause_started_at),
                is_active: user.is_active,
            },
        }),
    ))
}

pub async fn logout(
    State(state): State<AppState>,
    refresh: Option<RefreshTokenCookie>,
) -> Result<impl IntoResponse> {
    if let Some(RefreshTokenCookie(raw)) = refresh {
        let hashed = hash_token(&raw);
        if let Err(e) = sqlx::query!("DELETE FROM refresh_tokens WHERE token = $1", hashed)
            .execute(&state.pool)
            .await
        {
            tracing::warn!("Failed to delete refresh token on logout: {e}");
        }
    }

    let secure_flag = if state.cookie_secure { "; Secure" } else { "" };
    let clear_auth = format!(
        "auth_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0{}",
        secure_flag
    );
    let clear_refresh = format!(
        "refresh_token=; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=0{}",
        secure_flag
    );

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        clear_auth.parse().map_err(|_| {
            AppError::Internal(anyhow::anyhow!("Failed to build Set-Cookie header"))
        })?,
    );
    headers.append(
        header::SET_COOKIE,
        clear_refresh.parse().map_err(|_| {
            AppError::Internal(anyhow::anyhow!("Failed to build Set-Cookie header"))
        })?,
    );

    Ok((headers, StatusCode::NO_CONTENT))
}

pub async fn refresh(
    State(state): State<AppState>,
    RefreshTokenCookie(raw): RefreshTokenCookie,
) -> Result<impl IntoResponse> {
    let hashed = hash_token(&raw);

    struct RefreshRow {
        id: Uuid,
        user_id: Uuid,
        org_id: Uuid,
        expires_at: time::OffsetDateTime,
    }

    let row = sqlx::query_as!(
        RefreshRow,
        r#"SELECT id, user_id, org_id, expires_at FROM refresh_tokens WHERE token = $1"#,
        hashed
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    if row.expires_at < time::OffsetDateTime::now_utc() {
        if let Err(e) = sqlx::query!("DELETE FROM refresh_tokens WHERE id = $1", row.id)
            .execute(&state.pool)
            .await
        {
            tracing::warn!("Failed to delete expired refresh token: {e}");
        }
        return Err(AppError::Unauthorized);
    }

    // Consume old token (rotation)
    sqlx::query!("DELETE FROM refresh_tokens WHERE id = $1", row.id)
        .execute(&state.pool)
        .await?;

    // Verify user still active
    struct UserRow {
        role: Role,
        is_active: bool,
    }
    let user = sqlx::query_as!(
        UserRow,
        r#"SELECT role AS "role: Role", is_active FROM users WHERE id = $1 AND org_id = $2"#,
        row.user_id,
        row.org_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    if !user.is_active {
        return Err(AppError::Unauthorized);
    }

    // Issue new access token
    let access_token = create_token(
        row.user_id,
        row.org_id,
        user.role,
        &state.jwt_secret,
        state.access_token_expiry_minutes,
    )
    .map_err(AppError::Internal)?;

    // Issue new refresh token (store hash, send raw as cookie)
    let new_refresh_raw = Uuid::new_v4().to_string();
    let new_refresh_hash = hash_token(&new_refresh_raw);
    let refresh_expires = time::OffsetDateTime::now_utc()
        + time::Duration::days(state.refresh_token_expiry_days as i64);

    sqlx::query!(
        "INSERT INTO refresh_tokens (user_id, org_id, token, expires_at) VALUES ($1, $2, $3, $4)",
        row.user_id,
        row.org_id,
        new_refresh_hash,
        refresh_expires,
    )
    .execute(&state.pool)
    .await?;

    // Cap refresh tokens per user (keep most recent 10)
    if let Err(e) = sqlx::query!(
        r#"
        DELETE FROM refresh_tokens WHERE user_id = $1 AND id NOT IN (
            SELECT id FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
        )
        "#,
        row.user_id
    )
    .execute(&state.pool)
    .await
    {
        tracing::warn!("Failed to cap refresh tokens: {e}");
    }

    let secure_flag = if state.cookie_secure { "; Secure" } else { "" };

    let auth_cookie = format!(
        "auth_token={}; HttpOnly; SameSite=Strict; Path=/; Max-Age={}{}",
        access_token,
        state.access_token_expiry_minutes * 60,
        secure_flag,
    );
    let refresh_cookie = format!(
        "refresh_token={}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={}{}",
        new_refresh_raw,
        state.refresh_token_expiry_days * 86400,
        secure_flag,
    );

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        auth_cookie.parse().map_err(|_| {
            AppError::Internal(anyhow::anyhow!("Failed to build Set-Cookie header"))
        })?,
    );
    headers.append(
        header::SET_COOKIE,
        refresh_cookie.parse().map_err(|_| {
            AppError::Internal(anyhow::anyhow!("Failed to build Set-Cookie header"))
        })?,
    );

    Ok((headers, StatusCode::NO_CONTENT))
}

pub async fn me(State(pool): State<PgPool>, auth: AuthUser) -> Result<Json<UserProfile>> {
    let row = sqlx::query!(
        r#"
        SELECT u.id, u.org_id, u.employee_id, u.first_name, u.last_name, u.email, u.phone,
               u.role AS "role: Role",
               u.classification_id,
               c.name AS "classification_name?",
               u.employee_type AS "employee_type: EmployeeType",
               u.bargaining_unit AS "bargaining_unit: BargainingUnit",
               u.hire_date, u.cto_designation,
               u.admin_training_supervisor_since,
               u.employee_status AS "employee_status: EmployeeStatus",
               u.is_active,
               sr.overall_seniority_date AS "overall_seniority_date?",
               sr.bargaining_unit_seniority_date AS "bargaining_unit_seniority_date?",
               sr.classification_seniority_date AS "classification_seniority_date?",
               sr.accrual_pause_started_at AS "accrual_paused_since?"
        FROM users u
        LEFT JOIN classifications c ON c.id = u.classification_id
        LEFT JOIN seniority_records sr ON sr.user_id = u.id
        WHERE u.id = $1 AND u.org_id = $2
        "#,
        auth.id,
        auth.org_id
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
        bargaining_unit: row.bargaining_unit,
        hire_date: row.hire_date,
        overall_seniority_date: row.overall_seniority_date,
        bargaining_unit_seniority_date: row.bargaining_unit_seniority_date,
        classification_seniority_date: row.classification_seniority_date,
        cto_designation: row.cto_designation,
        admin_training_supervisor_since: row.admin_training_supervisor_since,
        employee_status: row.employee_status,
        accrual_paused_since: row.accrual_paused_since,
        is_active: row.is_active,
    }))
}
