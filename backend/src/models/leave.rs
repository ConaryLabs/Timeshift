use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
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
    pub reason: Option<String>,
    pub status: LeaveStatus,
    pub reviewed_by: Option<Uuid>,
    pub reviewer_notes: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateLeaveRequest {
    pub leave_type_id: Uuid,
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub hours: Option<f64>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewLeaveRequest {
    pub status: LeaveStatus,
    pub reviewer_notes: Option<String>,
}
