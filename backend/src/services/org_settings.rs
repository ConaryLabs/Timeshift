//! Helpers for reading org_settings with typed defaults.

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

// org_settings key constants — use these instead of string literals
pub mod keys {
    pub const FISCAL_YEAR_START_MONTH: &str = "fiscal_year_start_month";
    pub const BUMP_DEADLINE_HOURS: &str = "bump_deadline_hours";
    pub const VOLUNTARY_OT_CANCEL_HOURS: &str = "voluntary_ot_cancel_hours";
    pub const TRADE_APPROVAL_CUTOFF_MINUTES: &str = "trade_approval_cutoff_minutes";
    pub const TRADE_REQUIRE_SAME_PERIOD: &str = "trade_require_same_period";
    pub const OT_CROSS_CLASS_WINDOW_DAYS: &str = "ot_cross_class_window_days";
    pub const MAX_CONCURRENT_VACATION: &str = "max_concurrent_vacation";
    pub const VACATION_HOURS_CHARGED_SEP_FEB: &str = "vacation_hours_charged_sep_feb";
    pub const FMLA_EXHAUSTION_ORDER: &str = "fmla_exhaustion_order";
    pub const SELLBACK_PERIODS: &str = "sellback_periods";
    pub const DEFAULT_HOURS_PER_VACATION_DAY: &str = "default_hours_per_vacation_day";
    pub const ENABLE_BUMP_REQUESTS: &str = "enable_bump_requests";
}

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
