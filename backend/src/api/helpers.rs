use axum::Json;
use serde_json::Value;
use time::Date;

use crate::error::AppError;

/// Standard success response for mutations that don't return data
pub fn json_ok() -> Json<Value> {
    Json(serde_json::json!({ "ok": true }))
}

/// Check that a DELETE/UPDATE affected at least one row, or return NotFound
pub fn ensure_rows_affected(rows: u64, entity: &str) -> Result<(), AppError> {
    if rows == 0 {
        return Err(AppError::NotFound(format!("{entity} not found")));
    }
    Ok(())
}

/// Validate that end_date >= start_date and optionally that the range doesn't exceed max_days
pub fn validate_date_range(
    start_date: Date,
    end_date: Date,
    max_days: Option<i64>,
) -> Result<(), AppError> {
    if end_date < start_date {
        return Err(AppError::BadRequest(
            "end_date must be on or after start_date".into(),
        ));
    }
    if let Some(max) = max_days {
        let diff = (end_date - start_date).whole_days();
        if diff > max {
            return Err(AppError::BadRequest(format!(
                "Date range cannot exceed {max} days"
            )));
        }
    }
    Ok(())
}
