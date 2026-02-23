use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SickLeaveDonation {
    pub id: Uuid,
    pub org_id: Uuid,
    pub donor_id: Uuid,
    pub recipient_id: Uuid,
    pub leave_type_id: Uuid,
    pub hours: f64,
    pub fiscal_year: i32,
    pub status: String,
    pub reviewed_by: Option<Uuid>,
    pub reviewer_notes: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateDonationRequest {
    pub recipient_id: Uuid,
    pub leave_type_id: Uuid,
    pub hours: f64,
    pub fiscal_year: i32,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ReviewDonationRequest {
    /// "approved", "denied", or "cancelled"
    pub status: String,
    #[validate(length(max = 2000))]
    pub reviewer_notes: Option<String>,
}
