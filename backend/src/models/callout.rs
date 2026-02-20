use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

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
    pub classification_id: Option<Uuid>,
    pub status: CalloutStatus,
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
    pub seniority_date: Option<time::Date>,
    pub ot_hours: f64,
    pub is_available: bool,
    pub unavailable_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCalloutEventRequest {
    pub scheduled_shift_id: Uuid,
    pub ot_reason_id: Option<Uuid>,
    pub reason_text: Option<String>,
    pub classification_id: Option<Uuid>,
}

#[allow(dead_code)] // Fields used when record_attempt is implemented (currently 501)
#[derive(Debug, Deserialize)]
pub struct RecordAttemptRequest {
    pub response: String,
    pub notes: Option<String>,
}
