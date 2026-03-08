//! Timezone helpers: convert between org-local wall-clock times and UTC.

use chrono::{Datelike, TimeZone};
use chrono_tz::Tz;

use crate::error::{AppError, Result};

/// Parse an IANA timezone string (e.g. "America/Los_Angeles") into a Tz.
pub fn parse_tz(tz_str: &str) -> Result<Tz> {
    tz_str
        .parse::<Tz>()
        .map_err(|_| AppError::BadRequest(format!("Invalid timezone: {tz_str}")))
}

/// Get today's date in the given timezone.
pub fn org_today(tz_str: &str) -> time::Date {
    let tz = tz_str.parse::<Tz>().unwrap_or(chrono_tz::UTC);
    let local = chrono::Utc::now().with_timezone(&tz);
    time::Date::from_calendar_date(
        local.year(),
        time::Month::try_from(local.month() as u8).unwrap(),
        local.day() as u8,
    )
    .unwrap()
}

/// Compute fiscal year for a given date based on the org's fiscal year start month.
/// If fiscal year starts in month M (e.g. 7 = July), then dates before July belong
/// to the previous calendar year's fiscal year.
/// Example: start_month=7, date=2026-03-15 → FY 2025. date=2026-09-01 → FY 2026.
pub fn fiscal_year_for_date(date: time::Date, start_month: u32) -> i32 {
    if start_month <= 1 {
        return date.year();
    }
    let month = date.month() as u32;
    if month >= start_month {
        date.year()
    } else {
        date.year() - 1
    }
}

/// Get the current fiscal year in the org's timezone, given a fiscal year start month.
pub fn current_fiscal_year(tz_str: &str, start_month: u32) -> i32 {
    fiscal_year_for_date(org_today(tz_str), start_month)
}

/// Convert a local wall-clock date + time in the org's timezone to a UTC OffsetDateTime.
///
/// This is the correct replacement for `.assume_utc()` — shift times like "06:00"
/// are wall-clock times in the org's timezone, not UTC.
///
/// Handles DST edge cases:
/// - Ambiguous times (fall-back): uses the earlier (pre-transition) time.
/// - Gap times (spring-forward): advances past the gap.
pub fn local_to_utc(
    date: time::Date,
    local_time: time::Time,
    tz_str: &str,
) -> time::OffsetDateTime {
    let tz = tz_str.parse::<Tz>().unwrap_or(chrono_tz::UTC);
    let naive = chrono::NaiveDateTime::new(
        chrono::NaiveDate::from_ymd_opt(date.year(), date.month() as u32, date.day() as u32)
            .unwrap(),
        chrono::NaiveTime::from_hms_opt(
            local_time.hour() as u32,
            local_time.minute() as u32,
            local_time.second() as u32,
        )
        .unwrap(),
    );

    let utc_dt = match tz.from_local_datetime(&naive) {
        chrono::LocalResult::Single(dt) => dt.with_timezone(&chrono::Utc),
        chrono::LocalResult::Ambiguous(dt1, _) => dt1.with_timezone(&chrono::Utc),
        chrono::LocalResult::None => {
            // Spring-forward gap: advance 1 hour past the gap.
            let shifted = naive + chrono::Duration::hours(1);
            tz.from_local_datetime(&shifted)
                .earliest()
                .expect("shifted time should resolve")
                .with_timezone(&chrono::Utc)
        }
    };

    time::OffsetDateTime::from_unix_timestamp(utc_dt.timestamp()).unwrap()
}
