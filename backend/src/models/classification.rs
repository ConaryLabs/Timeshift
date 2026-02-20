use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Classification {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub abbreviation: String,
    pub display_order: i32,
    pub is_active: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateClassificationRequest {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    #[validate(length(min = 1, max = 20))]
    pub abbreviation: String,
    pub display_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateClassificationRequest {
    pub name: Option<String>,
    pub abbreviation: Option<String>,
    pub display_order: Option<i32>,
    pub is_active: Option<bool>,
}
