use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

// ============================================================
// Duty Positions
// ============================================================

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DutyPosition {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub classification_id: Option<Uuid>,
    pub sort_order: i32,
    pub is_active: bool,
    pub board_date: Option<time::Date>,
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
    pub board_date: Option<time::Date>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateDutyPositionRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub classification_id: Option<Option<Uuid>>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

// ============================================================
// Duty Assignments (block-based)
// ============================================================

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DutyAssignment {
    pub id: Uuid,
    pub org_id: Uuid,
    pub duty_position_id: Uuid,
    pub user_id: Option<Uuid>,
    pub date: time::Date,
    pub block_index: Option<i16>,
    pub status: String,
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
    pub user_id: Option<Uuid>,
    pub user_first_name: Option<String>,
    pub user_last_name: Option<String>,
    pub date: time::Date,
    pub block_index: Option<i16>,
    pub status: String,
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
    #[validate(range(min = 0, max = 11))]
    pub block_index: Option<i16>,
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
}

// ============================================================
// Qualifications
// ============================================================

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Qualification {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateQualificationRequest {
    #[validate(length(min = 1, max = 50))]
    pub name: String,
    #[validate(length(max = 200))]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateQualificationRequest {
    #[validate(length(min = 1, max = 50))]
    pub name: Option<String>,
    #[validate(length(max = 200))]
    pub description: Option<Option<String>>,
}

// ============================================================
// Position Operating Hours
// ============================================================

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DutyPositionHours {
    pub id: Uuid,
    pub duty_position_id: Uuid,
    pub day_of_week: i16,
    #[serde(with = "crate::models::common::time_format")]
    pub open_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub close_time: time::Time,
    pub crosses_midnight: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreatePositionHoursRequest {
    pub day_of_week: i16,
    pub open_time: String,
    pub close_time: String,
    pub crosses_midnight: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePositionHoursRequest {
    pub open_time: Option<String>,
    pub close_time: Option<String>,
    pub crosses_midnight: Option<bool>,
}

// ============================================================
// Duty Board aggregate response types
// ============================================================

#[derive(Debug, Serialize)]
pub struct DutyBoardResponse {
    pub date: String,
    pub positions: Vec<BoardPosition>,
    pub assignments: Vec<BoardAssignment>,
}

#[derive(Debug, Serialize)]
pub struct BoardPosition {
    pub id: Uuid,
    pub name: String,
    pub classification_id: Option<Uuid>,
    pub classification_abbr: Option<String>,
    pub sort_order: i32,
    pub board_date: Option<time::Date>,
    pub open_blocks: Vec<bool>,
    pub required_qualifications: Vec<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct BoardAssignment {
    pub id: Uuid,
    pub duty_position_id: Uuid,
    pub block_index: i16,
    pub user_id: Option<Uuid>,
    pub user_first_name: Option<String>,
    pub user_last_name: Option<String>,
    pub status: String,
}

// ============================================================
// Cell action (assign / mark_ot / clear)
// ============================================================

#[derive(Debug, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CellActionKind {
    Assign,
    MarkOt,
    Clear,
}

#[derive(Debug, Deserialize)]
pub struct CellAction {
    pub duty_position_id: Uuid,
    pub block_index: i16,
    pub action: CellActionKind,
    pub user_id: Option<Uuid>,
}

// ============================================================
// Available staff for a block
// ============================================================

#[derive(Debug, Deserialize)]
pub struct AvailableStaffQuery {
    pub block_index: i16,
    pub duty_position_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct AvailableEmployee {
    pub user_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub shift_name: String,
    pub shift_start: String,
    pub shift_end: String,
    pub is_overtime: bool,
    pub console_hours_this_month: f64,
    pub already_assigned_position: Option<String>,
}

// ============================================================
// Console hours report
// ============================================================

#[derive(Debug, Deserialize)]
pub struct ConsoleHoursQuery {
    pub start_date: time::Date,
    pub end_date: time::Date,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConsoleHoursEntry {
    pub user_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub position_id: Uuid,
    pub position_name: String,
    pub hours: i64,
}

// ============================================================
// Qualification mapping helpers
// ============================================================

#[derive(Debug, Deserialize)]
pub struct QualificationMappingRequest {
    pub qualification_id: Uuid,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct UserQualificationView {
    pub user_id: Uuid,
    pub qualification_id: Uuid,
    pub qualification_name: String,
    #[serde(with = "time::serde::rfc3339")]
    pub granted_at: OffsetDateTime,
}
