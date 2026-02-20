use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

/// An assignment of a specific employee to a specific scheduled shift.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Assignment {
    pub id: Uuid,
    pub scheduled_shift_id: Uuid,
    pub user_id: Uuid,
    pub position: Option<String>,
    pub is_overtime: bool,
    pub is_trade: bool,
    pub notes: Option<String>,
    pub created_by: Uuid,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

/// Rich view joining assignment + shift + user for the staffing board.
#[derive(Debug, Clone, Serialize)]
pub struct AssignmentView {
    pub assignment_id: Uuid,
    pub date: time::Date,
    pub shift_name: String,
    pub shift_color: String,
    pub start_time: time::Time,
    pub end_time: time::Time,
    pub crosses_midnight: bool,
    pub user_id: Uuid,
    pub employee_id: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub position: Option<String>,
    pub is_overtime: bool,
    pub is_trade: bool,
    pub team_name: Option<String>,
    pub classification_abbreviation: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssignmentRequest {
    pub scheduled_shift_id: Uuid,
    pub user_id: Uuid,
    pub position: Option<String>,
    #[serde(default)]
    pub is_overtime: bool,
    #[serde(default)]
    pub is_trade: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StaffingQuery {
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub team_id: Option<Uuid>,
}
