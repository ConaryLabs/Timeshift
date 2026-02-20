use serde::Deserialize;

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
