// models/common.rs
use serde::{Deserialize, Serialize};
use std::fmt;

/// Serde module: serialize/deserialize `time::Time` as "HH:MM:SS" strings.
pub mod time_format {
    time::serde::format_description!(inner, Time, "[hour]:[minute]:[second]");
    pub use inner::{deserialize, serialize};
}

/// Serde module: serialize/deserialize `Option<time::Time>` as optional "HH:MM:SS" strings.
pub mod time_format_option {
    use serde::{self, Deserialize, Deserializer, Serializer};
    use time::macros::format_description;
    use time::Time;

    const FMT: &[time::format_description::FormatItem<'static>] =
        format_description!("[hour]:[minute]:[second]");

    pub fn serialize<S>(time: &Option<Time>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match time {
            Some(t) => {
                let s = t.format(FMT).map_err(serde::ser::Error::custom)?;
                serializer.serialize_some(&s)
            }
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<Time>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt: Option<String> = Option::deserialize(deserializer)?;
        match opt {
            Some(s) => Time::parse(&s, FMT)
                .map(Some)
                .map_err(serde::de::Error::custom),
            None => Ok(None),
        }
    }
}

/// Deserializes a field as `Some(value)` when present (even if null) and `None` when absent.
/// Used for the double-Option pattern: `None` = field not sent, `Some(None)` = explicitly null,
/// `Some(Some(v))` = set to value.
pub fn deserialize_optional_field<'de, T, D>(
    deserializer: D,
) -> std::result::Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

/// Shared pagination behavior for query param structs with `limit`/`offset` fields.
/// `limit` defaults to 100, capped at [1, 500]. `offset` defaults to 0.
pub trait Paginated {
    fn raw_limit(&self) -> Option<i64>;
    fn raw_offset(&self) -> Option<i64>;

    fn limit(&self) -> i64 {
        self.raw_limit().unwrap_or(100).clamp(1, 500)
    }

    fn offset(&self) -> i64 {
        self.raw_offset().unwrap_or(0).max(0)
    }
}

/// Pagination query params shared across list endpoints.
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl Paginated for PaginationParams {
    fn raw_limit(&self) -> Option<i64> { self.limit }
    fn raw_offset(&self) -> Option<i64> { self.offset }
}

/// Optional date-range filter for list endpoints.
#[derive(Debug, Deserialize)]
pub struct DateRangeParams {
    pub start_date: Option<time::Date>,
    pub end_date: Option<time::Date>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl Paginated for DateRangeParams {
    fn raw_limit(&self) -> Option<i64> { self.limit }
    fn raw_offset(&self) -> Option<i64> { self.offset }
}

// ---------------------------------------------------------------------------
// Shared domain enums (stored as VARCHAR in the DB, typed in Rust)
// ---------------------------------------------------------------------------

/// OT assignment type -- stored in `assignments.ot_type` and `ot_request_assignments.ot_type`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OtType {
    Voluntary,
    Mandatory,
    MandatoryDayOff,
    FixedCoverage,
    Elective,
}

impl fmt::Display for OtType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Voluntary => f.write_str("voluntary"),
            Self::Mandatory => f.write_str("mandatory"),
            Self::MandatoryDayOff => f.write_str("mandatory_day_off"),
            Self::FixedCoverage => f.write_str("fixed_coverage"),
            Self::Elective => f.write_str("elective"),
        }
    }
}

/// Supervisor review action for leave donation, leave sellback, and trade requests.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReviewAction {
    Approved,
    Denied,
    Cancelled,
}

impl fmt::Display for ReviewAction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Approved => f.write_str("approved"),
            Self::Denied => f.write_str("denied"),
            Self::Cancelled => f.write_str("cancelled"),
        }
    }
}
