use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub timezone: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateOrganizationRequest {
    #[validate(length(max = 100))]
    pub name: Option<String>,
    #[validate(length(max = 100))]
    pub timezone: Option<String>,
}

/// Key-value org configuration row from `org_settings` table.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct OrgSetting {
    pub id: Uuid,
    pub org_id: Uuid,
    pub key: String,
    pub value: serde_json::Value,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct SetOrgSettingRequest {
    #[validate(length(max = 100))]
    pub key: String,
    pub value: serde_json::Value,
}
