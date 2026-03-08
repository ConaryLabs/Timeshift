use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

use crate::models::common::ReviewAction;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct HolidaySellbackRequest {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub fiscal_year: i32,
    pub period: String,
    pub hours_requested: f64,
    pub status: String,
    pub reviewed_by: Option<Uuid>,
    pub reviewer_notes: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateSellbackRequest {
    pub fiscal_year: i32,
    /// "june" or "december"
    pub period: String,
    pub hours_requested: f64,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ReviewSellbackRequest {
    pub status: ReviewAction,
    #[validate(length(max = 2000))]
    pub reviewer_notes: Option<String>,
}
