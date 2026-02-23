use serde::Deserialize;

/// Serde module: serialize/deserialize `time::Time` as "HH:MM:SS" strings.
pub mod time_format {
    time::serde::format_description!(inner, Time, "[hour]:[minute]:[second]");
    pub use inner::{deserialize, serialize};
}

/// Serde module: serialize/deserialize `Option<time::Time>` as optional "HH:MM:SS" strings.
pub mod time_format_option {
    use serde::{self, Deserialize, Deserializer, Serializer};
    use time::format_description;
    use time::Time;

    pub fn serialize<S>(time: &Option<Time>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match time {
            Some(t) => {
                let fmt =
                    format_description::parse("[hour]:[minute]:[second]").expect("valid format");
                let s = t.format(&fmt).map_err(serde::ser::Error::custom)?;
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
            Some(s) => {
                let fmt = format_description::parse("[hour]:[minute]:[second]")
                    .map_err(serde::de::Error::custom)?;
                Time::parse(&s, &fmt)
                    .map(Some)
                    .map_err(serde::de::Error::custom)
            }
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

/// Pagination query params shared across list endpoints.
/// `limit` defaults to 100, capped at 500. `offset` defaults to 0.
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl PaginationParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(100).clamp(1, 500)
    }

    pub fn offset(&self) -> i64 {
        self.offset.unwrap_or(0).max(0)
    }
}

/// Optional date-range filter for list endpoints.
#[derive(Debug, Deserialize)]
pub struct DateRangeParams {
    pub start_date: Option<time::Date>,
    pub end_date: Option<time::Date>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl DateRangeParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(100).clamp(1, 500)
    }

    pub fn offset(&self) -> i64 {
        self.offset.unwrap_or(0).max(0)
    }
}
