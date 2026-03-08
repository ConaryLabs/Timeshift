// models/leave_balance.rs
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

use crate::models::common::Paginated;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct LeaveBalance {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub leave_type_id: Uuid,
    pub balance_hours: f64,
    pub as_of_date: time::Date,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Serialize)]
pub struct LeaveBalanceView {
    pub leave_type_id: Uuid,
    pub leave_type_code: String,
    pub leave_type_name: String,
    pub balance_hours: f64,
    pub as_of_date: time::Date,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct AccrualSchedule {
    pub id: Uuid,
    pub org_id: Uuid,
    pub leave_type_id: Uuid,
    pub employee_type: String,
    /// NULL means the schedule applies to all bargaining units.
    pub bargaining_unit: Option<String>,
    pub years_of_service_min: i32,
    pub years_of_service_max: Option<i32>,
    pub hours_per_pay_period: f64,
    pub max_balance_hours: Option<f64>,
    pub effective_date: time::Date,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateAccrualScheduleRequest {
    pub leave_type_id: Uuid,
    #[validate(length(max = 100))]
    pub employee_type: Option<String>,
    /// bargaining_unit to target (null = applies to all units)
    pub bargaining_unit: Option<String>,
    pub years_of_service_min: Option<i32>,
    pub years_of_service_max: Option<i32>,
    pub hours_per_pay_period: f64,
    pub max_balance_hours: Option<f64>,
    pub effective_date: Option<time::Date>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccrualScheduleRequest {
    pub hours_per_pay_period: Option<f64>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "crate::models::common::deserialize_optional_field")]
    pub max_balance_hours: Option<Option<f64>>,
    pub years_of_service_min: Option<i32>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "crate::models::common::deserialize_optional_field")]
    pub years_of_service_max: Option<Option<i32>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AccrualTransaction {
    pub id: Uuid,
    pub user_id: Uuid,
    pub leave_type_id: Uuid,
    pub hours: f64,
    pub reason: String,
    pub reference_id: Option<Uuid>,
    pub note: Option<String>,
    pub created_by: Uuid,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct AdjustBalanceRequest {
    pub user_id: Uuid,
    pub leave_type_id: Uuid,
    pub hours: f64,
    #[validate(length(max = 2000))]
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BalanceHistoryQuery {
    pub leave_type_id: Option<Uuid>,
    pub start_date: Option<time::Date>,
    pub end_date: Option<time::Date>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl Paginated for BalanceHistoryQuery {
    fn raw_limit(&self) -> Option<i64> { self.limit }
    fn raw_offset(&self) -> Option<i64> { self.offset }
}

#[derive(Debug, Clone, Serialize)]
pub struct LeaveRequestLineWithRequestId {
    pub id: Uuid,
    pub leave_request_id: Uuid,
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
