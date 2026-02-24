use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

use crate::models::common::deserialize_optional_field;

// ---------------------------------------------------------------------------
// OT Request
// ---------------------------------------------------------------------------

/// OT request row with joined display fields for list queries.
#[derive(Debug, Clone, Serialize)]
pub struct OtRequestRow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub date: time::Date,
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub end_time: time::Time,
    pub hours: f64,
    pub classification_id: Uuid,
    pub classification_name: String,
    pub ot_reason_id: Option<Uuid>,
    pub ot_reason_name: Option<String>,
    pub location: Option<String>,
    pub is_fixed_coverage: bool,
    pub notes: Option<String>,
    pub status: String,
    pub created_by: Uuid,
    pub created_by_name: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option"
    )]
    pub cancelled_at: Option<OffsetDateTime>,
    pub cancelled_by: Option<Uuid>,
    pub volunteer_count: i64,
    pub assignment_count: i64,
}

/// Single OT request detail with nested volunteers and assignments.
#[derive(Debug, Clone, Serialize)]
pub struct OtRequestDetail {
    pub id: Uuid,
    pub org_id: Uuid,
    pub date: time::Date,
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub end_time: time::Time,
    pub hours: f64,
    pub classification_id: Uuid,
    pub classification_name: String,
    pub ot_reason_id: Option<Uuid>,
    pub ot_reason_name: Option<String>,
    pub location: Option<String>,
    pub is_fixed_coverage: bool,
    pub notes: Option<String>,
    pub status: String,
    pub created_by: Uuid,
    pub created_by_name: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option"
    )]
    pub cancelled_at: Option<OffsetDateTime>,
    pub cancelled_by: Option<Uuid>,
    pub volunteers: Vec<OtRequestVolunteerRow>,
    pub assignments: Vec<OtRequestAssignmentRow>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateOtRequest {
    pub date: time::Date,
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub end_time: time::Time,
    pub classification_id: Uuid,
    pub ot_reason_id: Option<Uuid>,
    #[validate(length(max = 500))]
    pub location: Option<String>,
    pub is_fixed_coverage: Option<bool>,
    #[validate(length(max = 2000))]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateOtRequest {
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub ot_reason_id: Option<Option<Uuid>>,
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub location: Option<Option<String>>,
    pub is_fixed_coverage: Option<bool>,
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub notes: Option<Option<String>>,
    pub status: Option<String>,
}

/// Query params for listing OT requests.
#[derive(Debug, Deserialize)]
pub struct OtRequestQuery {
    pub status: Option<String>,
    pub date_from: Option<time::Date>,
    pub date_to: Option<time::Date>,
    pub classification_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl OtRequestQuery {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(100).clamp(1, 500)
    }

    pub fn offset(&self) -> i64 {
        self.offset.unwrap_or(0).max(0)
    }
}

// ---------------------------------------------------------------------------
// OT Request Volunteers
// ---------------------------------------------------------------------------

/// Volunteer row with joined user info.
#[derive(Debug, Clone, Serialize)]
pub struct OtRequestVolunteerRow {
    pub id: Uuid,
    pub ot_request_id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub user_email: String,
    pub classification_name: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub volunteered_at: OffsetDateTime,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option"
    )]
    pub withdrawn_at: Option<OffsetDateTime>,
}

// ---------------------------------------------------------------------------
// OT Request Assignments
// ---------------------------------------------------------------------------

/// Assignment row with joined user info.
#[derive(Debug, Clone, Serialize)]
pub struct OtRequestAssignmentRow {
    pub id: Uuid,
    pub ot_request_id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub ot_type: String,
    pub assigned_by: Uuid,
    pub assigned_by_name: String,
    #[serde(with = "time::serde::rfc3339")]
    pub assigned_at: OffsetDateTime,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "time::serde::rfc3339::option"
    )]
    pub cancelled_at: Option<OffsetDateTime>,
    pub cancelled_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOtRequestAssignment {
    pub user_id: Uuid,
    pub ot_type: Option<String>,
}
