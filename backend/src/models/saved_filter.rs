use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SavedFilter {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub page: String,
    pub filters: serde_json::Value,
    pub is_default: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct SavedFilterQuery {
    pub page: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateSavedFilterRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(length(min = 1, max = 100))]
    pub page: String,
    pub filters: serde_json::Value,
    #[serde(default)]
    pub is_default: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetDefaultRequest {
    pub is_default: bool,
}
