use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;

#[derive(thiserror::Error, Debug)]
pub enum AppError {
    #[error("Authentication required")]
    Unauthorized,

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

    #[error("Not implemented")]
    NotImplemented,

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match &self {
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
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
            AppError::NotImplemented => (StatusCode::NOT_IMPLEMENTED, self.to_string()),
            AppError::Database(e) => {
                // Map constraint violations to 409 Conflict
                if let sqlx::Error::Database(ref db_err) = e {
                    if let Some(code) = db_err.code() {
                        match code.as_ref() {
                            "23505" => {
                                // unique_violation
                                let detail = db_err.message().to_string();
                                tracing::warn!("Unique constraint violation: {}", detail);
                                return (
                                    StatusCode::CONFLICT,
                                    Json(json!({ "error": "A record with that value already exists" })),
                                )
                                    .into_response();
                            }
                            "23503" => {
                                // foreign_key_violation
                                tracing::warn!("Foreign key violation: {}", db_err.message());
                                return (
                                    StatusCode::CONFLICT,
                                    Json(json!({ "error": "Referenced record does not exist" })),
                                )
                                    .into_response();
                            }
                            _ => {}
                        }
                    }
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

pub type Result<T> = std::result::Result<T, AppError>;
