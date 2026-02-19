use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

/// A shift template -- defines what a shift looks like (not who works it).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ShiftTemplate {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub start_time: time::Time,
    pub end_time: time::Time,
    pub crosses_midnight: bool,
    pub duration_minutes: i32,
    pub color: String,
    pub is_active: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateShiftTemplateRequest {
    pub name: String,
    pub start_time: time::Time,
    pub end_time: time::Time,
    pub color: Option<String>,
}

/// A scheduled shift occurrence on a specific date.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScheduledShift {
    pub id: Uuid,
    pub org_id: Uuid,
    pub shift_template_id: Uuid,
    pub date: time::Date,
    pub required_headcount: i32,
    pub slot_id: Option<Uuid>,
    pub notes: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

/// Schedule period (e.g. 6-month bid window).
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SchedulePeriod {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub is_active: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateSchedulePeriodRequest {
    pub name: String,
    pub start_date: time::Date,
    pub end_date: time::Date,
}

/// A slot assignment -- who holds a slot for a schedule period (result of bid).
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SlotAssignment {
    pub id: Uuid,
    pub slot_id: Uuid,
    pub user_id: Uuid,
    pub period_id: Uuid,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateSlotAssignmentRequest {
    pub slot_id: Uuid,
    pub user_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CreateScheduledShiftRequest {
    pub shift_template_id: Uuid,
    pub date: time::Date,
    pub required_headcount: Option<i32>,
    pub slot_id: Option<Uuid>,
    pub notes: Option<String>,
}
