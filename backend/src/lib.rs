pub mod api;
pub mod auth;
pub mod config;
pub mod error;
pub mod models;
pub mod org_guard;

use sqlx::PgPool;

/// Shared application state available to all handlers via axum's State extractor.
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt_secret: String,
    pub jwt_expiry_hours: u64,
}

impl axum::extract::FromRef<AppState> for PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.pool.clone()
    }
}
