use serde::{Deserialize, Serialize};
use time::{Date, OffsetDateTime};
use uuid::Uuid;

use crate::models::common::deserialize_optional_field;

#[derive(Debug, Clone, Serialize)]
pub struct SpecialAssignment {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub user_first_name: String,
    pub user_last_name: String,
    pub assignment_type: String,
    pub start_date: Date,
    pub end_date: Option<Date>,
    pub notes: Option<String>,
    pub assigned_by: Option<Uuid>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateSpecialAssignmentRequest {
    pub user_id: Uuid,
    pub assignment_type: String,
    pub start_date: Date,
    pub end_date: Option<Date>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSpecialAssignmentRequest {
    pub assignment_type: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub end_date: Option<Option<Date>>,
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub notes: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
pub struct SpecialAssignmentListParams {
    pub user_id: Option<Uuid>,
    pub assignment_type: Option<String>,
    pub active_on: Option<Date>,
}
