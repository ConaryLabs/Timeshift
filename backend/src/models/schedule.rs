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

// -- Coverage Plans (per-half-hour-slot system) --

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CoveragePlan {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub is_active: bool,
    pub created_by: Uuid,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Serialize)]
pub struct CoveragePlanView {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub is_active: bool,
    pub slot_count: i64,
    pub assignment_count: i64,
    pub created_by: Uuid,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CoveragePlanSlot {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub classification_id: Uuid,
    pub day_of_week: i16,
    pub slot_index: i16,
    pub min_headcount: i16,
    pub target_headcount: i16,
    pub max_headcount: i16,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CoveragePlanAssignment {
    pub id: Uuid,
    pub org_id: Uuid,
    pub plan_id: Uuid,
    pub start_date: time::Date,
    pub end_date: Option<time::Date>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateCoveragePlanRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(length(max = 500))]
    pub description: Option<String>,
    #[serde(default)]
    pub is_default: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCoveragePlanRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_default: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SlotEntry {
    pub classification_id: Uuid,
    pub day_of_week: i16,
    pub slot_index: i16,
    pub min_headcount: i16,
    pub target_headcount: i16,
    pub max_headcount: i16,
}

#[derive(Debug, Deserialize)]
pub struct BulkUpsertSlotsRequest {
    pub slots: Vec<SlotEntry>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCoveragePlanAssignmentRequest {
    pub plan_id: Uuid,
    pub start_date: time::Date,
    pub end_date: Option<time::Date>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SlotCoverage {
    pub slot_index: i16,
    pub classification_id: Uuid,
    pub classification_abbreviation: String,
    pub min_headcount: i16,
    pub target_headcount: i16,
    pub max_headcount: i16,
    pub actual_headcount: i32,
    pub status: String,
}

// -- Classification Gap (per-shift coverage shortage) --

#[derive(Debug, Serialize)]
pub struct ClassificationGap {
    pub classification_id: Uuid,
    pub classification_abbreviation: String,
    pub shift_template_id: Uuid,
    pub shift_name: String,
    pub shift_color: String,
    pub target: i16,
    pub actual: i16,
    pub shortage: i16,
}

// -- Block-level coverage gaps (contiguous time ranges per classification) --

#[derive(Debug, Clone, Serialize)]
pub struct CoverageGapBlock {
    pub start_time: String,
    pub end_time: String,
    pub shortage: i32,
}

#[derive(Debug, Serialize)]
pub struct ClassificationGapBlocks {
    pub classification_id: Uuid,
    pub classification_abbreviation: String,
    pub blocks: Vec<CoverageGapBlock>,
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

// -- Per-classification coverage detail (included in API responses) --

#[derive(Debug, Clone, Serialize)]
pub struct ClassificationCoverageDetail {
    pub classification_abbreviation: String,
    pub shortage: i32,
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
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub coverage_by_classification: Vec<ClassificationCoverageDetail>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
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
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub coverage_by_classification: Vec<ClassificationCoverageDetail>,
}

// -- Day Grid Types (coverage day view with employee-level detail) --

#[derive(Debug, Serialize)]
pub struct DayGridResponse {
    pub date: String,
    pub classifications: Vec<DayGridClassification>,
    pub blocks: Vec<CoverageBlock>,
}

#[derive(Debug, Serialize)]
pub struct DayGridClassification {
    pub classification_id: Uuid,
    pub abbreviation: String,
    pub blocks: Vec<ClassificationBlock>,
}

#[derive(Debug, Serialize)]
pub struct ClassificationBlock {
    pub block_index: u8,
    pub start_time: String,
    pub end_time: String,
    pub min: i16,
    pub target: i16,
    pub actual: i32,
    pub status: String,
    pub employees: Vec<BlockEmployee>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BlockEmployee {
    pub user_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub shift_name: String,
    pub shift_start: String,
    pub shift_end: String,
    pub is_overtime: bool,
    pub assignment_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct CoverageBlock {
    pub block_index: u8,
    pub total_target: i32,
    pub total_actual: i32,
    pub status: String,
}

// -- Dashboard Types --

#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub current_coverage: Vec<DayViewEntry>,
    pub pending_leave_count: i64,
    pub open_callout_count: i64,
    pub annotations: Vec<ScheduleAnnotation>,
}
