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

/// Parse a "YYYY-MM-DD" date string, returning an `AppError::BadRequest` on failure.
pub fn parse_date(date_str: &str) -> Result<Date, AppError> {
    let format = time::format_description::parse("[year]-[month]-[day]")
        .map_err(|_| AppError::BadRequest("invalid date format".into()))?;
    Date::parse(date_str, &format)
        .map_err(|_| AppError::BadRequest(format!("invalid date: {date_str}")))
}

/// Convert a shift's start/end times (with crosses_midnight flag) into a half-hour
/// slot range `(start_slot, end_slot)` where each slot is 0..=47.
///
/// The end_slot is inclusive: a shift covering 06:00-14:00 returns (12, 27).
pub fn time_to_slot_range(
    start_time: time::Time,
    end_time: time::Time,
    crosses_midnight: bool,
) -> (i16, i16) {
    let start_min = start_time.hour() as i32 * 60 + start_time.minute() as i32;
    let end_min = if crosses_midnight {
        24 * 60
    } else {
        end_time.hour() as i32 * 60 + end_time.minute() as i32
    };
    let start_slot = (start_min / 30) as i16;
    let end_slot = if end_min % 30 == 0 {
        (end_min / 30 - 1) as i16
    } else {
        (end_min / 30) as i16
    };
    (start_slot, end_slot.clamp(0, 47))
}

/// For an overnight shift that ends at `end_time` on the next day, compute the
/// inclusive end slot (0..=47) for the morning contribution. Returns `None` if
/// `end_time` is exactly midnight (no morning contribution).
pub fn overnight_end_slot(end_time: time::Time) -> Option<i16> {
    let end_min = end_time.hour() as i32 * 60 + end_time.minute() as i32;
    if end_min == 0 {
        return None;
    }
    let end_slot = if end_min % 30 == 0 {
        (end_min / 30 - 1) as i16
    } else {
        (end_min / 30) as i16
    };
    Some(end_slot.clamp(0, 47))
}
