//! Helpers for reading org_settings with typed defaults.

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Get an org setting value as a string, falling back to the default.
///
/// The `value` column is JSONB, so `::TEXT` returns JSON-encoded text (e.g. `"hello"` with
/// surrounding quotes for strings). We strip those quotes so callers (and `get_i64` /
/// `get_bool`) receive the plain value.
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
    .map(|s| s.trim_matches('"').to_string())
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

/// Seed default org_settings for a new organization.
/// Uses ON CONFLICT DO NOTHING so it is safe to call multiple times.
pub async fn seed_defaults(pool: &PgPool, org_id: Uuid) -> Result<(), AppError> {
    let defaults: Vec<(&str, serde_json::Value)> = vec![
        ("fiscal_year_start_month", serde_json::Value::String("1".into())),
        ("bump_deadline_hours", serde_json::Value::String("24".into())),
        ("voluntary_ot_cancel_hours", serde_json::Value::String("24".into())),
        ("trade_approval_cutoff_minutes", serde_json::Value::String("60".into())),
        ("trade_require_same_period", serde_json::Value::String("true".into())),
        ("ot_cross_class_window_days", serde_json::Value::String("10".into())),
        ("max_concurrent_vacation", serde_json::Value::String("3".into())),
        ("sellback_periods", serde_json::Value::String("june,december".into())),
        ("default_hours_per_vacation_day", serde_json::Value::String("8".into())),
        ("enable_bump_requests", serde_json::Value::String("true".into())),
    ];
    for (key, value) in defaults {
        sqlx::query!(
            "INSERT INTO org_settings (id, org_id, key, value, updated_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (org_id, key) DO NOTHING",
            Uuid::new_v4(),
            org_id,
            key,
            value,
        )
        .execute(pool)
        .await
        .map_err(AppError::from)?;
    }
    Ok(())
}
