use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

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
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
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

#[derive(Debug, Deserialize, Validate)]
pub struct CreateAssignmentRequest {
    pub scheduled_shift_id: Uuid,
    pub user_id: Uuid,
    #[validate(length(max = 100))]
    pub position: Option<String>,
    #[serde(default)]
    pub is_overtime: bool,
    #[serde(default)]
    pub is_trade: bool,
    #[validate(length(max = 2000))]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StaffingQuery {
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub team_id: Option<Uuid>,
}

// -- Coverage Requirements --

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CoverageRequirement {
    pub id: Uuid,
    pub org_id: Uuid,
    pub shift_template_id: Uuid,
    pub classification_id: Uuid,
    pub day_of_week: i32,
    pub min_headcount: i32,
    pub target_headcount: i32,
    pub max_headcount: i32,
    pub effective_date: time::Date,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateCoverageRequirementRequest {
    pub shift_template_id: Uuid,
    pub classification_id: Uuid,
    pub day_of_week: i32,
    pub min_headcount: i32,
    pub target_headcount: i32,
    pub max_headcount: i32,
    pub effective_date: Option<time::Date>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCoverageRequirementRequest {
    pub min_headcount: Option<i32>,
    pub target_headcount: Option<i32>,
    pub max_headcount: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CoverageQuery {
    pub shift_template_id: Option<Uuid>,
    pub classification_id: Option<Uuid>,
}

// -- Schedule Annotations --

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScheduleAnnotation {
    pub id: Uuid,
    pub org_id: Uuid,
    pub date: time::Date,
    pub shift_template_id: Option<Uuid>,
    pub content: String,
    pub annotation_type: String,
    pub created_by: Uuid,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateAnnotationRequest {
    pub date: time::Date,
    pub shift_template_id: Option<Uuid>,
    #[validate(length(max = 5000))]
    pub content: String,
    #[validate(length(max = 50))]
    pub annotation_type: String,
}

#[derive(Debug, Deserialize)]
pub struct AnnotationQuery {
    pub start_date: time::Date,
    pub end_date: time::Date,
}

// -- Grid View Types --

#[derive(Debug, Serialize)]
pub struct GridCell {
    pub date: time::Date,
    pub shift_template_id: Uuid,
    pub shift_name: String,
    pub shift_color: String,
    pub assignments: Vec<GridAssignment>,
    pub leave_count: i64,
    pub coverage_required: i32,
    pub coverage_actual: i32,
}

#[derive(Debug, Serialize)]
pub struct GridAssignment {
    pub assignment_id: Uuid,
    pub user_id: Uuid,
    pub employee_id: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub classification_abbreviation: Option<String>,
    pub is_overtime: bool,
    pub is_trade: bool,
}

// -- Day View Types --

#[derive(Debug, Serialize)]
pub struct DayViewEntry {
    pub shift_template_id: Uuid,
    pub shift_name: String,
    pub shift_color: String,
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub end_time: time::Time,
    pub crosses_midnight: bool,
    pub assignments: Vec<GridAssignment>,
    pub coverage_required: i32,
    pub coverage_actual: i32,
    pub coverage_status: String,
}

// -- Dashboard Types --

#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub current_coverage: Vec<DayViewEntry>,
    pub pending_leave_count: i64,
    pub open_callout_count: i64,
    pub annotations: Vec<ScheduleAnnotation>,
}
