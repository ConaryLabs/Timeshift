// models/bidding.rs
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "bid_period_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BidPeriodStatus {
    Draft,
    Open,
    InProgress,
    Completed,
    Archived,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct BidWindow {
    pub id: Uuid,
    pub period_id: Uuid,
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
    #[serde(default, with = "time::serde::rfc3339::option")]
    pub unlocked_at: Option<OffsetDateTime>,
    #[serde(default, with = "time::serde::rfc3339::option")]
    pub approved_at: Option<OffsetDateTime>,
    pub approved_by: Option<Uuid>,
    pub is_job_share: bool,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option"
    )]
    pub auto_advanced_at: Option<OffsetDateTime>,
}

/// Type alias for backward compatibility -- `BidWindow` now directly derives `sqlx::FromRow`.
pub type BidWindowRow = BidWindow;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct BidSubmission {
    pub id: Uuid,
    pub bid_window_id: Uuid,
    pub slot_id: Uuid,
    pub preference_rank: i32,
    pub awarded: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Serialize)]
pub struct BidSubmissionView {
    pub id: Uuid,
    pub slot_id: Uuid,
    pub shift_template_name: String,
    pub team_name: String,
    pub classification_name: String,
    pub days_of_week: Vec<i32>,
    pub preference_rank: i32,
    pub awarded: bool,
}

#[derive(Debug, Deserialize)]
pub struct OpenBiddingRequest {
    pub window_duration_hours: i64,
    pub start_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitBidRequest {
    pub preferences: Vec<BidPreference>,
}

#[derive(Debug, Deserialize)]
pub struct BidPreference {
    pub slot_id: Uuid,
    pub preference_rank: i32,
}

#[derive(Debug, Serialize)]
pub struct AvailableSlot {
    pub slot_id: Uuid,
    pub team_name: String,
    pub shift_template_name: String,
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub end_time: time::Time,
    pub classification_name: String,
    pub classification_abbreviation: String,
    pub days_of_week: Vec<i32>,
    pub label: Option<String>,
    pub already_awarded: bool,
    pub is_flex: bool,
}

#[derive(Debug, Serialize)]
pub struct BidWindowDetail {
    pub window: BidWindow,
    pub available_slots: Vec<AvailableSlot>,
    pub submissions: Vec<BidSubmissionView>,
}
