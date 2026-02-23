use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

use super::ot::CalloutStep;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "callout_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CalloutStatus {
    Open,
    Filled,
    Cancelled,
}

/// A callout event -- supervisor calls out for OT on a specific shift.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CalloutEvent {
    pub id: Uuid,
    pub scheduled_shift_id: Uuid,
    pub initiated_by: Uuid,
    pub ot_reason_id: Option<Uuid>,
    pub reason_text: Option<String>,
    /// Which classification list this callout draws from (required).
    pub classification_id: Uuid,
    pub classification_name: String,
    pub status: CalloutStatus,
    pub current_step: Option<CalloutStep>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option"
    )]
    pub step_started_at: Option<OffsetDateTime>,
    pub shift_template_name: Option<String>,
    pub shift_date: Option<time::Date>,
    pub team_name: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

/// An individual contact attempt within a callout event.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CalloutAttempt {
    pub id: Uuid,
    pub event_id: Uuid,
    pub user_id: Uuid,
    pub list_position: i32,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option"
    )]
    pub contacted_at: Option<OffsetDateTime>,
    pub response: Option<String>,
    pub ot_hours_at_contact: f64,
    pub notes: Option<String>,
}

/// The computed callout list entry for display.
#[derive(Debug, Clone, Serialize)]
pub struct CalloutListEntry {
    pub position: i32,
    pub user_id: Uuid,
    pub employee_id: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub classification_abbreviation: Option<String>,
    pub overall_seniority_date: Option<time::Date>,
    pub ot_hours: f64,
    pub is_available: bool,
    pub unavailable_reason: Option<String>,
    /// True when this employee is from a different classification than the primary OT list.
    /// Only possible when the shift is within the org's cross-class eligibility window.
    pub is_cross_class: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateCalloutEventRequest {
    pub scheduled_shift_id: Uuid,
    pub ot_reason_id: Option<Uuid>,
    #[validate(length(max = 2000))]
    pub reason_text: Option<String>,
    /// Required: specifies which OT list (COI / COII / Supervisor) to call from.
    pub classification_id: Uuid,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RecordAttemptRequest {
    pub user_id: Uuid,
    /// Must be one of: "accepted", "declined", "no_answer"
    #[validate(length(max = 50))]
    pub response: String,
    #[validate(length(max = 2000))]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct BumpRequest {
    pub id: Uuid,
    pub org_id: Uuid,
    pub event_id: Uuid,
    pub requesting_user_id: Uuid,
    pub displaced_user_id: Uuid,
    pub status: String,
    pub reason: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option"
    )]
    pub reviewed_at: Option<OffsetDateTime>,
    pub reviewed_by: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct BumpRequestWithNames {
    pub id: Uuid,
    pub event_id: Uuid,
    pub requesting_user_id: Uuid,
    pub requesting_user_first_name: String,
    pub requesting_user_last_name: String,
    pub displaced_user_id: Uuid,
    pub displaced_user_first_name: String,
    pub displaced_user_last_name: String,
    pub status: String,
    pub reason: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option"
    )]
    pub reviewed_at: Option<OffsetDateTime>,
    pub reviewed_by: Option<Uuid>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateBumpRequest {
    pub displaced_user_id: Uuid,
    #[validate(length(max = 2000))]
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ReviewBumpRequest {
    pub approved: bool,
    #[validate(length(max = 2000))]
    pub reason: Option<String>,
}
