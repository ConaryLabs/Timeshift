use std::sync::LazyLock;

use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
};
use axum::http::StatusCode;
use axum::{extract::State, http::header, response::IntoResponse, Json};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

/// Pre-computed Argon2 hash for timing equalization on failed lookups.
/// When a login attempt uses a non-existent email, we still run an Argon2 verify
/// against this dummy hash to prevent email enumeration via timing side-channels.
static DUMMY_HASH: LazyLock<String> = LazyLock::new(|| {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(b"dummy", &salt)
        .unwrap()
        .to_string()
});

use crate::{
    api::users::fetch_user_profile,
    auth::{create_token, AuthUser, RefreshTokenCookie, Role},
    error::{AppError, Result},
    models::user::{EmployeeStatus, EmployeeType, LoginRequest, LoginResponse, User, UserProfile},
    AppState,
};

/// Hash a raw refresh token with SHA-256 for secure storage.
fn hash_token(raw: &str) -> String {
    hex::encode(Sha256::digest(raw.as_bytes()))
}

pub async fn login(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse> {
    // Extract IP and User-Agent for audit logging
    let ip_address = headers
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').next().unwrap_or(v).trim().to_string());
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Reject oversized passwords early to prevent Argon2 DoS (before any DB or hash work).
    // Legitimate passwords are at most 128 chars; anything longer is malicious.
    if req.password.len() > 128 {
        return Err(AppError::Unauthorized(Some(
            "Incorrect email or password".into(),
        )));
    }

    // Multi-org login: if org_slug is provided, filter by it.
    // If not provided, verify only one user matches the email.
    let user = if let Some(ref slug) = req.org_slug {
        sqlx::query_as!(
            User,
            r#"
            SELECT u.id, u.org_id, u.employee_id, u.first_name, u.last_name, u.email, u.phone,
                   u.password_hash,
                   u.role AS "role: Role",
                   u.classification_id,
                   u.employee_type AS "employee_type: EmployeeType",
                   u.bargaining_unit,
                   u.hire_date, u.cto_designation,
                   u.admin_training_supervisor_since,
                   u.employee_status AS "employee_status: EmployeeStatus",
                   u.medical_ot_exempt,
                   u.is_active, u.leave_accrual_paused_at,
                   u.created_at, u.updated_at
            FROM users u
            JOIN organizations o ON o.id = u.org_id
            WHERE u.email = $1 AND u.is_active = true AND o.slug = $2
            "#,
            req.email,
            slug,
        )
        .fetch_optional(&state.pool)
        .await?
    } else {
        // No org_slug: check for ambiguity
        let matches = sqlx::query_as!(
            User,
            r#"
            SELECT id, org_id, employee_id, first_name, last_name, email, phone,
                   password_hash,
                   role AS "role: Role",
                   classification_id,
                   employee_type AS "employee_type: EmployeeType",
                   bargaining_unit,
                   hire_date, cto_designation,
                   admin_training_supervisor_since,
                   employee_status AS "employee_status: EmployeeStatus",
                   medical_ot_exempt,
                   is_active, leave_accrual_paused_at,
                   created_at, updated_at
            FROM users
            WHERE email = $1 AND is_active = true
            LIMIT 2
            "#,
            req.email,
        )
        .fetch_all(&state.pool)
        .await?;

        if matches.len() > 1 {
            return Err(AppError::BadRequest(
                "Multiple accounts found for this email. Please specify your organization.".into(),
            ));
        }
        matches.into_iter().next()
    };

    // Extract user and hash for Argon2 verification.
    // For invalid emails, we use a dummy hash to prevent timing side-channels.
    let (found_user, hash_to_verify) = match user {
        Some(u) => {
            let hash = u.password_hash.clone();
            (Some(u), hash)
        }
        None => (None, DUMMY_HASH.clone()),
    };

    // If user was not found, run Argon2 on dummy hash (timing equalization), log and return.
    let found_user = match found_user {
        Some(u) => u,
        None => {
            let parsed = PasswordHash::new(&hash_to_verify)
                .map_err(|_| AppError::Internal(anyhow::anyhow!("Invalid stored hash")))?;
            let _ = Argon2::default().verify_password(req.password.as_bytes(), &parsed);
            log_audit(&state.pool, None, None, "login_failed", ip_address.as_deref(), user_agent.as_deref()).await;
            return Err(AppError::Unauthorized(Some(
                "Incorrect email or password".into(),
            )));
        }
    };

    // Account lockout — check BEFORE Argon2 to avoid wasting CPU on locked accounts.
    // This is safe because we already handled the "user not found" case above with timing
    // equalization, so an attacker cannot distinguish locked vs non-existent by timing.
    let recent_failures = sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!" FROM login_audit_log
         WHERE user_id = $1 AND event_type = 'login_failed'
         AND created_at > NOW() - INTERVAL '15 minutes'"#,
        found_user.id,
    )
    .fetch_one(&state.pool)
    .await?;

    if recent_failures >= 5 {
        return Err(AppError::TooManyRequests(
            "Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.".into(),
        ));
    }

    // Run Argon2 verification (only for non-locked, existing users)
    let parsed = PasswordHash::new(&found_user.password_hash)
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Invalid stored hash")))?;

    let password_valid = Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed)
        .is_ok();

    if !password_valid {
        log_audit(
            &state.pool,
            Some(found_user.id),
            Some(found_user.org_id),
            "login_failed",
            ip_address.as_deref(),
            user_agent.as_deref(),
        )
        .await;
        return Err(AppError::Unauthorized(Some(
            "Incorrect email or password".into(),
        )));
    }

    // Rename for clarity in the rest of the handler
    let user = found_user;

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
    let family_id = Uuid::new_v4();
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
        "INSERT INTO refresh_tokens (user_id, org_id, token, expires_at, family_id) VALUES ($1, $2, $3, $4, $5)",
        user.id,
        user.org_id,
        refresh_hash,
        refresh_expires,
        family_id,
    )
    .execute(&state.pool)
    .await?;

    log_audit(
        &state.pool,
        Some(user.id),
        Some(user.org_id),
        "login_success",
        ip_address.as_deref(),
        user_agent.as_deref(),
    )
    .await;

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
        sqlx::query_scalar!(
            "SELECT name FROM classifications WHERE id = $1 AND org_id = $2",
            cid,
            user.org_id,
        )
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
    // Cookie format: "{family_id}:{raw_token}" — family_id enables revocation of
    // all tokens in a family when token reuse is detected (theft detection).
    let refresh_cookie = format!(
        "refresh_token={}:{}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={}{}",
        family_id,
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
                bargaining_unit_seniority_date: seniority
                    .as_ref()
                    .and_then(|s| s.bargaining_unit_seniority_date),
                classification_seniority_date: seniority
                    .as_ref()
                    .and_then(|s| s.classification_seniority_date),
                cto_designation: user.cto_designation,
                admin_training_supervisor_since: user.admin_training_supervisor_since,
                employee_status: user.employee_status,
                accrual_paused_since: seniority.as_ref().and_then(|s| s.accrual_pause_started_at),
                leave_accrual_paused_at: user.leave_accrual_paused_at,
                medical_ot_exempt: user.medical_ot_exempt,
                is_active: user.is_active,
                updated_at: user.updated_at,
            },
        }),
    ))
}

pub async fn logout(
    State(state): State<AppState>,
    refresh: Option<RefreshTokenCookie>,
) -> Result<impl IntoResponse> {
    let mut logout_user_id = None;
    let mut logout_org_id = None;

    if let Some(RefreshTokenCookie(raw)) = refresh {
        // Cookie format: "{family_id}:{raw_token}" (new) or just "{raw_token}" (legacy).
        // Must parse before hashing, just like the refresh handler does.
        let (cookie_family_id, raw_token) = if let Some(idx) = raw.find(':') {
            let fam = Uuid::parse_str(&raw[..idx]).ok();
            (fam, raw[idx + 1..].to_string())
        } else {
            (None, raw.clone())
        };

        let hashed = hash_token(&raw_token);
        // Look up user before deleting, for audit log
        if let Ok(Some(row)) = sqlx::query!(
            "SELECT user_id, org_id FROM refresh_tokens WHERE token = $1",
            hashed
        )
        .fetch_optional(&state.pool)
        .await
        {
            logout_user_id = Some(row.user_id);
            logout_org_id = Some(row.org_id);
        }
        // Delete the specific token
        if let Err(e) = sqlx::query!("DELETE FROM refresh_tokens WHERE token = $1", hashed)
            .execute(&state.pool)
            .await
        {
            tracing::warn!("Failed to delete refresh token on logout: {e}");
        }
        // Also revoke entire token family so no other device can refresh with tokens from
        // this login session (defense in depth -- user explicitly chose to log out)
        if let Some(fam_id) = cookie_family_id {
            if let Err(e) = sqlx::query!(
                "DELETE FROM refresh_tokens WHERE family_id = $1",
                fam_id
            )
            .execute(&state.pool)
            .await
            {
                tracing::warn!("Failed to revoke token family on logout: {e}");
            }
        }
    }

    log_audit(&state.pool, logout_user_id, logout_org_id, "logout", None, None).await;

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
    // Cookie format: "{family_id}:{raw_token}" (new) or just "{raw_token}" (legacy).
    // Extracting the family_id enables full-family revocation on token reuse.
    let (cookie_family_id, raw_token) = if let Some(idx) = raw.find(':') {
        let fam = Uuid::parse_str(&raw[..idx]).ok();
        (fam, raw[idx + 1..].to_string())
    } else {
        (None, raw.clone())
    };

    let hashed = hash_token(&raw_token);

    struct RefreshRow {
        user_id: Uuid,
        org_id: Uuid,
        family_id: Uuid,
        expires_at: time::OffsetDateTime,
        created_at: time::OffsetDateTime,
    }

    // Atomically consume the refresh token: DELETE ... RETURNING ensures that
    // concurrent requests with the same token cannot both succeed (only one gets the row).
    let row = sqlx::query_as!(
        RefreshRow,
        r#"DELETE FROM refresh_tokens WHERE token = $1
           RETURNING user_id, org_id, family_id, expires_at, created_at"#,
        hashed
    )
    .fetch_optional(&state.pool)
    .await?;

    let row = match row {
        Some(r) => r,
        None => {
            // Token not found — likely reuse of an already-rotated token (theft indicator).
            // Revoke the entire token family to invalidate any stolen tokens.
            if let Some(fam_id) = cookie_family_id {
                tracing::warn!(
                    family_id = %fam_id,
                    "Refresh token reuse detected; revoking entire family"
                );
                if let Err(e) = sqlx::query!(
                    "DELETE FROM refresh_tokens WHERE family_id = $1",
                    fam_id
                )
                .execute(&state.pool)
                .await
                {
                    tracing::warn!("Failed to revoke token family {fam_id}: {e}");
                }
            }
            return Err(AppError::Unauthorized(None));
        }
    };

    if row.expires_at < time::OffsetDateTime::now_utc() {
        return Err(AppError::Unauthorized(None));
    }

    // Verify user still active and check password_changed_at (defense in depth)
    struct UserRow {
        role: Role,
        is_active: bool,
        password_changed_at: Option<time::OffsetDateTime>,
    }
    let user = sqlx::query_as!(
        UserRow,
        r#"SELECT role AS "role: Role", is_active, password_changed_at
           FROM users WHERE id = $1 AND org_id = $2"#,
        row.user_id,
        row.org_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized(None))?;

    if !user.is_active {
        return Err(AppError::Unauthorized(None));
    }

    // Reject refresh tokens created at or before the last password change.
    // Primary defense is that change_password deletes all refresh tokens,
    // but this catches any race conditions.
    if let Some(changed_at) = user.password_changed_at {
        if row.created_at <= changed_at {
            return Err(AppError::Unauthorized(None));
        }
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

    // Issue new refresh token inheriting the same family_id
    let new_refresh_raw = Uuid::new_v4().to_string();
    let new_refresh_hash = hash_token(&new_refresh_raw);
    let refresh_expires = time::OffsetDateTime::now_utc()
        + time::Duration::days(state.refresh_token_expiry_days as i64);

    sqlx::query!(
        "INSERT INTO refresh_tokens (user_id, org_id, token, expires_at, family_id) VALUES ($1, $2, $3, $4, $5)",
        row.user_id,
        row.org_id,
        new_refresh_hash,
        refresh_expires,
        row.family_id,
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

    log_audit(&state.pool, Some(row.user_id), Some(row.org_id), "refresh", None, None).await;

    let secure_flag = if state.cookie_secure { "; Secure" } else { "" };

    let auth_cookie = format!(
        "auth_token={}; HttpOnly; SameSite=Strict; Path=/; Max-Age={}{}",
        access_token,
        state.access_token_expiry_minutes * 60,
        secure_flag,
    );
    let refresh_cookie = format!(
        "refresh_token={}:{}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={}{}",
        row.family_id,
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
    let profile = fetch_user_profile(&pool, auth.id, auth.org_id).await?;
    Ok(Json(profile))
}

/// Best-effort audit log insert. Errors are logged but never propagated.
async fn log_audit(
    pool: &PgPool,
    user_id: Option<Uuid>,
    org_id: Option<Uuid>,
    event_type: &str,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) {
    if let Err(e) = sqlx::query!(
        "INSERT INTO login_audit_log (user_id, org_id, event_type, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)",
        user_id,
        org_id,
        event_type,
        ip_address,
        user_agent,
    )
    .execute(pool)
    .await
    {
        tracing::warn!("Failed to write audit log ({event_type}): {e}");
    }
}
