use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "leave_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LeaveStatus {
    Pending,
    Approved,
    Denied,
    Cancelled,
}

/// Org-configurable leave type reference record.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct LeaveTypeRecord {
    pub id: Uuid,
    pub org_id: Uuid,
    pub code: String,
    pub name: String,
    pub requires_approval: bool,
    pub is_reported: bool,
    pub draws_from: Option<String>,
    pub display_order: i32,
    pub is_active: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

/// One slice of a split/FMLA leave request drawing from a specific leave type balance.
#[derive(Debug, Clone, Serialize)]
pub struct LeaveSegment {
    pub id: Uuid,
    pub leave_type_id: Uuid,
    pub leave_type_code: String,
    pub leave_type_name: String,
    pub hours: f64,
    pub sort_order: i32,
}

/// Per-day breakdown line within a leave request.
#[derive(Debug, Clone, Serialize)]
pub struct LeaveRequestLine {
    pub id: Uuid,
    pub date: time::Date,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "crate::models::common::time_format_option"
    )]
    pub start_time: Option<time::Time>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "crate::models::common::time_format_option"
    )]
    pub end_time: Option<time::Time>,
    pub hours: f64,
}

/// Leave request with leave type info populated from join.
#[derive(Debug, Clone, Serialize)]
pub struct LeaveRequest {
    pub id: Uuid,
    pub user_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub leave_type_id: Uuid,
    pub leave_type_code: String,
    pub leave_type_name: String,
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub hours: Option<f64>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "crate::models::common::time_format_option"
    )]
    pub start_time: Option<time::Time>,
    pub scheduled_shift_id: Option<Uuid>,
    pub is_rdo: bool,
    pub reason: Option<String>,
    pub emergency_contact: Option<String>,
    pub bereavement_relationship: Option<String>,
    pub bereavement_name: Option<String>,
    pub status: LeaveStatus,
    pub reviewed_by: Option<Uuid>,
    pub reviewer_notes: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    /// FMLA or split-absence segments. Populated in get_one; empty in list.
    pub segments: Vec<LeaveSegment>,
    /// Per-day breakdown lines. Populated in get_one; empty in list.
    pub lines: Vec<LeaveRequestLine>,
}

/// User-supplied segment for manual split coding.
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateLeaveSegment {
    pub leave_type_id: Uuid,
    pub hours: f64,
}

/// Per-day line supplied by the client (optional; auto-generated if omitted).
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateLeaveRequestLine {
    pub date: time::Date,
    #[serde(default, with = "crate::models::common::time_format_option")]
    pub start_time: Option<time::Time>,
    #[serde(default, with = "crate::models::common::time_format_option")]
    pub end_time: Option<time::Time>,
    pub hours: f64,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateLeaveRequest {
    pub leave_type_id: Uuid,
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub hours: Option<f64>,
    #[serde(default, with = "crate::models::common::time_format_option")]
    pub start_time: Option<time::Time>,
    pub scheduled_shift_id: Option<Uuid>,
    #[serde(default)]
    pub is_rdo: bool,
    #[validate(length(max = 2000))]
    pub reason: Option<String>,
    #[validate(length(max = 500))]
    pub emergency_contact: Option<String>,
    #[validate(length(max = 200))]
    pub bereavement_relationship: Option<String>,
    #[validate(length(max = 200))]
    pub bereavement_name: Option<String>,
    /// Manual split coding segments (up to 5). If provided, overrides auto-FMLA.
    #[validate(length(max = 5))]
    pub segments: Option<Vec<CreateLeaveSegment>>,
    /// Per-day breakdown lines. If omitted, auto-generated from date range.
    pub lines: Option<Vec<CreateLeaveRequestLine>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ReviewLeaveRequest {
    pub status: LeaveStatus,
    #[validate(length(max = 2000))]
    pub reviewer_notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct BulkReviewLeaveRequest {
    pub ids: Vec<Uuid>,
    pub status: LeaveStatus,
    #[validate(length(max = 2000))]
    pub reviewer_notes: Option<String>,
}
