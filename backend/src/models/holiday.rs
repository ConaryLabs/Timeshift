use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Holiday {
    pub id: Uuid,
    pub org_id: Uuid,
    pub date: time::Date,
    pub name: String,
    pub is_premium_pay: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateHolidayRequest {
    pub date: time::Date,
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub is_premium_pay: Option<bool>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateHolidayRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub is_premium_pay: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct HolidayQuery {
    pub year: Option<i32>,
}
