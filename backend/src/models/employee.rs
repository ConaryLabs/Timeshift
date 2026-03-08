use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct EmployeePreferences {
    pub id: Uuid,
    pub user_id: Uuid,
    pub notification_email: bool,
    pub notification_sms: bool,
    pub preferred_view: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePreferencesRequest {
    pub notification_email: Option<bool>,
    pub notification_sms: Option<bool>,
    pub preferred_view: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MyScheduleEntry {
    pub date: time::Date,
    pub shift_name: String,
    pub shift_color: String,
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub end_time: time::Time,
    pub crosses_midnight: bool,
    pub team_name: Option<String>,
    pub position: Option<String>,
    pub is_overtime: bool,
    pub is_trade: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MyDashboardData {
    pub today_shift: Option<MyScheduleEntry>,
    pub next_shift: Option<MyScheduleEntry>,
    pub upcoming_shifts: Vec<MyScheduleEntry>,
    pub leave_balances: Vec<LeaveBalanceSummary>,
    pub pending_leave_count: i64,
    pub pending_trade_count: i64,
}

#[derive(Debug, Serialize)]
pub struct LeaveBalanceSummary {
    pub leave_type_code: String,
    pub leave_type_name: String,
    pub balance_hours: f64,
}

#[derive(Debug, Deserialize)]
pub struct MyScheduleQuery {
    pub start_date: time::Date,
    pub end_date: time::Date,
}
