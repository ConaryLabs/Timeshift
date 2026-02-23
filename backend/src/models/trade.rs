use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "trade_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TradeStatus {
    PendingPartner,
    PendingApproval,
    Approved,
    Denied,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
pub struct TradeRequest {
    pub id: Uuid,
    pub org_id: Uuid,
    pub requester_id: Uuid,
    pub requester_name: String,
    pub partner_id: Uuid,
    pub partner_name: String,
    pub requester_assignment_id: Uuid,
    pub partner_assignment_id: Uuid,
    pub requester_date: time::Date,
    pub partner_date: time::Date,
    pub status: TradeStatus,
    pub reviewed_by: Option<Uuid>,
    pub reviewer_notes: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateTradeRequest {
    pub partner_id: Uuid,
    pub requester_assignment_id: Uuid,
    pub partner_assignment_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct RespondTradeRequest {
    pub accept: bool,
}

#[derive(Debug, Deserialize)]
pub struct ReviewTradeRequest {
    pub approve: bool,
    pub reviewer_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TradeListQuery {
    pub status: Option<String>,
    pub user_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl TradeListQuery {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(100).clamp(1, 500)
    }

    pub fn offset(&self) -> i64 {
        self.offset.unwrap_or(0).max(0)
    }
}
