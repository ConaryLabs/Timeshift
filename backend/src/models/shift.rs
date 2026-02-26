use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

use crate::models::bidding::BidPeriodStatus;

/// A shift template -- defines what a shift looks like (not who works it).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ShiftTemplate {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub end_time: time::Time,
    pub crosses_midnight: bool,
    pub duration_minutes: i32,
    pub color: String,
    pub is_active: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateShiftTemplateRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
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
    pub status: BidPeriodStatus,
    #[serde(with = "time::serde::rfc3339::option")]
    pub bid_opens_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339::option")]
    pub bid_closes_at: Option<OffsetDateTime>,
    pub bargaining_unit: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateSchedulePeriodRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub bargaining_unit: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSchedulePeriodRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub start_date: Option<time::Date>,
    pub end_date: Option<time::Date>,
    pub bargaining_unit: Option<String>,
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
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateSlotAssignmentRequest {
    pub slot_id: Uuid,
    pub user_id: Uuid,
}

/// A slot with its assignment info for a period (user_* fields None when unassigned).
#[derive(Debug, Clone, Serialize)]
pub struct SlotAssignmentView {
    pub slot_id: Uuid,
    pub team_id: Uuid,
    pub team_name: String,
    pub shift_template_name: String,
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub end_time: time::Time,
    pub classification_id: Uuid,
    pub classification_name: String,
    pub classification_abbreviation: String,
    pub days_of_week: Vec<i32>,
    pub label: Option<String>,
    pub slot_is_active: bool,
    pub assignment_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub user_first_name: Option<String>,
    pub user_last_name: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateShiftTemplateRequest {
    #[validate(length(max = 100))]
    pub name: Option<String>,
    #[validate(length(max = 50))]
    pub color: Option<String>,
    pub is_active: Option<bool>,
    /// Optimistic locking: the `updated_at` timestamp from the last GET.
    /// If provided and the record has been modified since, returns 409 Conflict.
    #[serde(default)]
    pub expected_updated_at: Option<OffsetDateTime>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateScheduledShiftRequest {
    pub shift_template_id: Uuid,
    pub date: time::Date,
    pub required_headcount: Option<i32>,
    pub slot_id: Option<Uuid>,
    #[validate(length(max = 2000))]
    pub notes: Option<String>,
}
