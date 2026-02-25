use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DutyPosition {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub classification_id: Option<Uuid>,
    pub sort_order: i32,
    pub is_active: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateDutyPositionRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub classification_id: Option<Uuid>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateDutyPositionRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub classification_id: Option<Option<Uuid>>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DutyAssignment {
    pub id: Uuid,
    pub org_id: Uuid,
    pub duty_position_id: Uuid,
    pub user_id: Uuid,
    pub date: time::Date,
    pub shift_template_id: Option<Uuid>,
    pub notes: Option<String>,
    pub assigned_by: Option<Uuid>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize)]
pub struct DutyAssignmentView {
    pub id: Uuid,
    pub org_id: Uuid,
    pub duty_position_id: Uuid,
    pub duty_position_name: String,
    pub user_id: Uuid,
    pub user_first_name: String,
    pub user_last_name: String,
    pub date: time::Date,
    pub shift_template_id: Option<Uuid>,
    pub shift_template_name: Option<String>,
    pub notes: Option<String>,
    pub assigned_by: Option<Uuid>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateDutyAssignmentRequest {
    pub duty_position_id: Uuid,
    pub user_id: Uuid,
    pub date: time::Date,
    pub shift_template_id: Option<Uuid>,
    #[validate(length(max = 500))]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateDutyAssignmentRequest {
    pub user_id: Option<Uuid>,
    #[validate(length(max = 500))]
    pub notes: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
pub struct DutyAssignmentQuery {
    pub date: time::Date,
    pub shift_template_id: Option<Uuid>,
}
