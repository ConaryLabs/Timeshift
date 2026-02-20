use async_trait::async_trait;
use axum::{
    extract::{FromRef, FromRequestParts},
    http::{request::Parts, HeaderMap},
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::error::AppError;
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "app_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Admin,
    Supervisor,
    Employee,
}

impl Role {
    pub fn can_manage_schedule(&self) -> bool {
        matches!(self, Role::Admin | Role::Supervisor)
    }

    pub fn can_approve_leave(&self) -> bool {
        matches!(self, Role::Admin | Role::Supervisor)
    }

    pub fn is_admin(&self) -> bool {
        matches!(self, Role::Admin)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,    // user id
    pub org_id: Uuid, // organization id
    pub role: Role,
    pub exp: i64,
    pub iat: i64,
}

pub struct AuthUser {
    pub id: Uuid,
    pub org_id: Uuid,
    pub role: Role,
}

/// Internal row type for the auth DB check query.
struct AuthUserRow {
    role: Role,
    is_active: bool,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);
        let headers = &parts.headers;
        let token = extract_bearer_token(headers).ok_or(AppError::Unauthorized)?;

        let key = DecodingKey::from_secret(app_state.jwt_secret.as_bytes());
        let claims = decode::<Claims>(&token, &key, &Validation::new(Algorithm::HS256))
            .map_err(|e| {
                tracing::warn!("JWT decode failed: {}", e);
                AppError::Unauthorized
            })?
            .claims;

        // Verify user is still active and fetch current role from the database
        let row = sqlx::query_as!(
            AuthUserRow,
            r#"SELECT role AS "role: Role", is_active FROM users WHERE id = $1 AND org_id = $2"#,
            claims.sub,
            claims.org_id
        )
        .fetch_optional(&app_state.pool)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Auth DB check failed: {}", e)))?
        .ok_or(AppError::Unauthorized)?;

        if !row.is_active {
            return Err(AppError::Unauthorized);
        }

        Ok(AuthUser {
            id: claims.sub,
            org_id: claims.org_id,
            role: row.role,
        })
    }
}

fn extract_bearer_token(headers: &HeaderMap) -> Option<String> {
    let auth = headers.get("Authorization")?.to_str().ok()?;
    let token = auth.strip_prefix("Bearer ")?;
    Some(token.to_string())
}

pub fn create_token(
    user_id: Uuid,
    org_id: Uuid,
    role: Role,
    secret: &str,
    expiry_hours: u64,
) -> anyhow::Result<String> {
    use jsonwebtoken::{encode, EncodingKey, Header};

    let now = OffsetDateTime::now_utc();
    let exp = now + time::Duration::hours(expiry_hours as i64);

    let claims = Claims {
        sub: user_id,
        org_id,
        role,
        exp: exp.unix_timestamp(),
        iat: now.unix_timestamp(),
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;

    Ok(token)
}
