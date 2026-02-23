use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

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

#[derive(Debug, Deserialize)]
pub struct CreateHolidayRequest {
    pub date: time::Date,
    pub name: String,
    pub is_premium_pay: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateHolidayRequest {
    pub name: Option<String>,
    pub is_premium_pay: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct HolidayQuery {
    pub year: Option<i32>,
}
