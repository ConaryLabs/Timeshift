use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::models::common::Paginated;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub link: Option<String>,
    pub source_type: Option<String>,
    pub source_id: Option<Uuid>,
    pub is_read: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option"
    )]
    pub read_at: Option<OffsetDateTime>,
}

#[derive(Debug, Serialize)]
pub struct NotificationListResponse {
    pub notifications: Vec<Notification>,
    pub total: i64,
    pub unread_count: i64,
}

#[derive(Debug, Serialize)]
pub struct UnreadCountResponse {
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct ReadAllResponse {
    pub updated: i64,
}

#[derive(Debug, Deserialize)]
pub struct NotificationListQuery {
    pub unread_only: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl Paginated for NotificationListQuery {
    fn raw_limit(&self) -> Option<i64> { self.limit }
    fn raw_offset(&self) -> Option<i64> { self.offset }

    fn limit(&self) -> i64 {
        self.raw_limit().unwrap_or(50).clamp(1, 200)
    }
}
