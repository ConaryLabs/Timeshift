use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct VacationBidPeriod {
    pub id: Uuid,
    pub org_id: Uuid,
    pub year: i32,
    pub round: i32,
    // TODO: convert to typed enum
    pub status: String,
    #[serde(default, with = "time::serde::rfc3339::option")]
    pub opens_at: Option<OffsetDateTime>,
    #[serde(default, with = "time::serde::rfc3339::option")]
    pub closes_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    pub allowance_hours: Option<i32>,
    pub min_block_hours: Option<i32>,
    pub bargaining_unit: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVacationBidPeriodRequest {
    pub year: i32,
    pub round: i32,
    pub allowance_hours: Option<i32>,
    pub min_block_hours: Option<i32>,
    pub bargaining_unit: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VacationBidWindow {
    pub id: Uuid,
    pub vacation_bid_period_id: Uuid,
    pub user_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub seniority_rank: i32,
    #[serde(with = "time::serde::rfc3339")]
    pub opens_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub closes_at: OffsetDateTime,
    #[serde(default, with = "time::serde::rfc3339::option")]
    pub submitted_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct VacationBid {
    pub id: Uuid,
    pub vacation_bid_window_id: Uuid,
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub preference_rank: i32,
    pub awarded: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct OpenVacationBiddingRequest {
    pub window_duration_hours: i64,
    pub start_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitVacationBidRequest {
    pub picks: Vec<VacationPick>,
}

#[derive(Debug, Deserialize)]
pub struct VacationPick {
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub preference_rank: i32,
}

#[derive(Debug, Serialize)]
pub struct VacationWindowDetail {
    pub window: VacationBidWindow,
    pub round: i32,
    pub year: i32,
    pub bids: Vec<VacationBid>,
    pub dates_taken: Vec<time::Date>,
    pub allowance_hours: Option<i32>,
    pub min_block_hours: Option<i32>,
    pub hours_used: f64,
}

#[derive(Debug, Deserialize)]
pub struct VacationBidPeriodQuery {
    pub year: Option<i32>,
}
