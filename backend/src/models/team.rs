use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

use crate::models::common::deserialize_optional_field;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Team {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub supervisor_id: Option<Uuid>,
    pub is_active: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize)]
pub struct TeamSummary {
    pub id: Uuid,
    pub name: String,
    pub supervisor_id: Option<Uuid>,
    pub supervisor_name: Option<String>,
    pub is_active: bool,
    pub slot_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TeamWithSlots {
    #[serde(flatten)]
    pub team: Team,
    pub slots: Vec<ShiftSlotView>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShiftSlotView {
    pub id: Uuid,
    pub team_id: Uuid,
    pub shift_template_id: Uuid,
    pub shift_template_name: String,
    pub start_time: time::Time,
    pub end_time: time::Time,
    pub classification_id: Uuid,
    pub classification_abbreviation: String,
    pub days_of_week: Vec<i32>,
    pub label: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTeamRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub supervisor_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTeamRequest {
    pub name: Option<String>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub supervisor_id: Option<Option<Uuid>>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateShiftSlotRequest {
    pub shift_template_id: Uuid,
    pub classification_id: Uuid,
    pub days_of_week: Vec<i32>,
    pub label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateShiftSlotRequest {
    pub shift_template_id: Option<Uuid>,
    pub classification_id: Option<Uuid>,
    pub days_of_week: Option<Vec<i32>>,
    pub label: Option<String>,
    pub is_active: Option<bool>,
}
