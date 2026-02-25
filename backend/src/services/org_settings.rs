//! Helpers for reading org_settings with typed defaults.

use sqlx::PgPool;
use uuid::Uuid;

/// Get an org setting value as a string, falling back to the default.
pub async fn get_str(pool: &PgPool, org_id: Uuid, key: &str, default: &str) -> String {
    sqlx::query_scalar!(
        "SELECT value::TEXT FROM org_settings WHERE org_id = $1 AND key = $2",
        org_id,
        key,
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .flatten()
    .unwrap_or_else(|| default.to_string())
}

/// Get an org setting value as i64, falling back to the default.
pub async fn get_i64(pool: &PgPool, org_id: Uuid, key: &str, default: i64) -> i64 {
    get_str(pool, org_id, key, &default.to_string())
        .await
        .parse()
        .unwrap_or(default)
}

/// Get an org setting value as bool, falling back to the default.
pub async fn get_bool(pool: &PgPool, org_id: Uuid, key: &str, default: bool) -> bool {
    let s = get_str(pool, org_id, key, &default.to_string()).await;
    matches!(s.as_str(), "true" | "1" | "yes")
}
