use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct CoverageReport {
    pub date: time::Date,
    pub shift_template_id: Uuid,
    pub shift_name: String,
    pub required_headcount: i32,
    pub actual_headcount: i64,
    pub coverage_percent: f64,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct OtSummaryReport {
    pub user_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub classification_name: Option<String>,
    pub hours_worked: f64,
    pub hours_declined: f64,
    pub total_hours: f64,
}

#[derive(Debug, Serialize)]
pub struct LeaveSummaryReport {
    pub leave_type_code: String,
    pub leave_type_name: String,
    pub total_requests: i64,
    pub approved_count: i64,
    pub denied_count: i64,
    pub pending_count: i64,
    pub total_hours: f64,
}

#[derive(Debug, serde::Deserialize)]
pub struct ReportQuery {
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub team_id: Option<Uuid>,
}

#[derive(Debug, serde::Deserialize)]
pub struct OtReportQuery {
    pub fiscal_year: Option<i32>,
    pub classification_id: Option<Uuid>,
}

#[derive(Debug, serde::Deserialize)]
pub struct LeaveReportQuery {
    pub start_date: time::Date,
    pub end_date: time::Date,
}

// -- New report types --

#[derive(Debug, serde::Deserialize)]
pub struct OtByPeriodQuery {
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub classification_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct OtByPeriodEntry {
    pub date: time::Date,
    pub hours: f64,
    pub ot_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OtByPeriodReport {
    pub user_id: Uuid,
    pub user_name: String,
    pub classification_name: Option<String>,
    pub total_hours: f64,
    pub assignments: Vec<OtByPeriodEntry>,
}

#[derive(Debug, serde::Deserialize)]
pub struct WorkSummaryQuery {
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub user_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct WorkSummaryReport {
    pub user_id: Uuid,
    pub user_name: String,
    pub period: String,
    pub regular_shifts: i64,
    pub ot_shifts: i64,
    pub leave_days: i64,
    pub total_hours: f64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct OrgSetting {
    pub id: Uuid,
    pub org_id: Uuid,
    pub key: String,
    pub value: serde_json::Value,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, serde::Deserialize)]
pub struct SetOrgSettingRequest {
    pub key: String,
    pub value: serde_json::Value,
}
