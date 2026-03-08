// backend/src/error.rs
use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;

#[derive(thiserror::Error, Debug)]
pub enum AppError {
    #[error("{}", .0.as_deref().unwrap_or("Authentication required"))]
    Unauthorized(Option<String>),

    #[error("Insufficient permissions")]
    Forbidden,

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Validation error: {0}")]
    Validation(#[from] validator::ValidationErrors),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Too many requests: {0}")]
    TooManyRequests(String),

    /// Soft contract limit -- can be bypassed by the caller with `force: true`.
    /// Returns 409 with `{"error": "...", "soft_limit": true}`.
    #[error("Soft limit: {0}")]
    SoftLimit(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match &self {
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
            AppError::TooManyRequests(msg) => (StatusCode::TOO_MANY_REQUESTS, msg.clone()),
            AppError::SoftLimit(msg) => {
                return (
                    StatusCode::CONFLICT,
                    Json(json!({ "error": msg, "soft_limit": true })),
                )
                    .into_response();
            }
            AppError::Validation(e) => {
                let messages: Vec<String> = e
                    .field_errors()
                    .into_iter()
                    .map(|(field, errors)| {
                        let msgs: Vec<&str> = errors
                            .iter()
                            .filter_map(|err| err.message.as_ref().map(|m| m.as_ref()))
                            .collect();
                        if msgs.is_empty() {
                            let codes: Vec<&str> =
                                errors.iter().map(|err| err.code.as_ref()).collect();
                            format!("{}: {}", field, codes.join(", "))
                        } else {
                            format!("{}: {}", field, msgs.join(", "))
                        }
                    })
                    .collect();
                (StatusCode::BAD_REQUEST, messages.join("; "))
            }
            AppError::Database(e) => {
                if let Some(resp) = map_db_error_response(e) {
                    return resp;
                }
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error".into())
            }
            AppError::Internal(e) => {
                tracing::error!("Internal error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".into(),
                )
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

/// Map well-known database errors to user-facing HTTP responses.
fn map_db_error_response(e: &sqlx::Error) -> Option<axum::response::Response> {
    if matches!(e, sqlx::Error::PoolTimedOut) {
        tracing::warn!("Database pool timed out");
        return Some(
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({ "error": "Service temporarily unavailable" })),
            )
                .into_response(),
        );
    }

    let db_err = match e {
        sqlx::Error::Database(ref db_err) => db_err,
        _ => return None,
    };

    let code = db_err.code()?;
    let (status, msg) = match code.as_ref() {
        "23505" => {
            tracing::warn!("Unique constraint violation: {}", db_err.message());
            (
                StatusCode::CONFLICT,
                "A record with that value already exists",
            )
        }
        "23503" => {
            tracing::warn!("Foreign key violation: {}", db_err.message());
            (StatusCode::CONFLICT, "Referenced record does not exist")
        }
        "23514" => {
            tracing::warn!("Check constraint violation: {}", db_err.message());
            (StatusCode::BAD_REQUEST, "Value violates a data constraint")
        }
        "23502" => {
            tracing::warn!("NOT NULL violation: {}", db_err.message());
            (StatusCode::BAD_REQUEST, "Required field is missing")
        }
        _ => return None,
    };

    Some((status, Json(json!({ "error": msg }))).into_response())
}

pub type Result<T> = std::result::Result<T, AppError>;
