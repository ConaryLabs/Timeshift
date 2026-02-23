use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "callout_step", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CalloutStep {
    Volunteers,
    LowOtHours,
    InverseSeniority,
    EqualOtHours,
    Mandatory,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct OtQueuePosition {
    pub id: Uuid,
    pub org_id: Uuid,
    pub classification_id: Uuid,
    pub user_id: Uuid,
    /// Timestamp of the last OT callout contact. NULL = never contacted (front of queue).
    pub last_ot_event_at: Option<OffsetDateTime>,
    pub fiscal_year: i32,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Serialize)]
pub struct OtQueueView {
    pub user_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub employee_id: Option<String>,
    /// Timestamp of last OT contact for this classification/year. NULL = never contacted.
    #[serde(
        serialize_with = "time::serde::rfc3339::option::serialize",
        rename = "last_ot_event_at"
    )]
    pub last_ot_event_at: Option<OffsetDateTime>,
    pub ot_hours_worked: f64,
    pub ot_hours_declined: f64,
}

#[derive(Debug, Deserialize)]
pub struct OtQueueQuery {
    pub classification_id: Uuid,
    pub fiscal_year: Option<i32>,
}

/// Set or clear a user's last_ot_event_at timestamp to control their queue position.
/// Setting last_ot_event_at = null moves them to the front (as if never contacted).
#[derive(Debug, Deserialize)]
pub struct SetQueuePositionRequest {
    pub classification_id: Uuid,
    pub fiscal_year: Option<i32>,
    pub user_id: Uuid,
    /// null = move to front (never contacted); provide a timestamp to set a specific position.
    pub last_ot_event_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OtHoursView {
    pub user_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub classification_id: Option<Uuid>,
    pub classification_name: Option<String>,
    pub fiscal_year: i32,
    pub hours_worked: f64,
    pub hours_declined: f64,
}

#[derive(Debug, Deserialize)]
pub struct OtHoursQuery {
    pub user_id: Option<Uuid>,
    pub fiscal_year: Option<i32>,
    pub classification_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AdjustOtHoursRequest {
    pub user_id: Uuid,
    pub fiscal_year: i32,
    pub classification_id: Option<Uuid>,
    pub hours_worked_delta: Option<f64>,
    pub hours_declined_delta: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OtVolunteer {
    pub id: Uuid,
    pub callout_event_id: Uuid,
    pub user_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    #[serde(with = "time::serde::rfc3339")]
    pub volunteered_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct AdvanceStepRequest {
    pub step: CalloutStep,
}
