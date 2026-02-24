use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

use crate::auth::Role;
use crate::models::common::deserialize_optional_field;

/// Current employment/leave status of a user.
/// Controls seniority accrual pause/resume logic.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "employee_status_enum", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EmployeeStatus {
    Active,
    /// Unpaid leave of absence — pauses seniority unless exception (OJI/maternity/military).
    UnpaidLoa,
    /// Leave without pay — pauses seniority unless exception.
    Lwop,
    /// Laid off; recall rights typically 18 months (VCSG); seniority paused.
    Layoff,
    /// Permanently separated from employment.
    Separated,
}

/// Full user record as stored in the database.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub org_id: Uuid,
    pub employee_id: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: Option<String>,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: Role,
    pub classification_id: Option<Uuid>,
    pub employee_type: EmployeeType,
    pub bargaining_unit: BargainingUnit,
    pub hire_date: Option<time::Date>,
    /// True when employee holds CTO (Communications Training Officer) designation.
    /// CTO is a pay modifier on top of COI/COII, not a separate classification.
    pub cto_designation: bool,
    /// Set to the start date of the rotational assignment when employee is currently
    /// serving as Admin Supervisor or Training Supervisor (VCSG only; 36-month rotations).
    pub admin_training_supervisor_since: Option<time::Date>,
    pub employee_status: EmployeeStatus,
    pub is_active: bool,
    pub leave_accrual_paused_at: Option<time::Date>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "employee_type_enum", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EmployeeType {
    RegularFullTime,
    JobShare,
    MedicalPartTime,
    TempPartTime,
}

/// Which bargaining unit an employee belongs to.
/// Drives contract-specific rules for OT callout order, leave caps, accrual rates, etc.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "bargaining_unit_enum", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BargainingUnit {
    /// VCCEA (Valley Communications Center Employees' Association) — COI / COII employees
    Vccea,
    /// VCSG (Valley Communications Supervisory Guild) — Supervisor I / Admin Sup / Training Sup
    Vcsg,
    /// Non-represented: management, temp/part-time, and other non-union staff
    NonRepresented,
}

/// Subset returned to the client (no password hash).
/// Seniority dates come from the seniority_records table (one row per user).
#[derive(Debug, Clone, Serialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub org_id: Uuid,
    pub employee_id: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: Option<String>,
    pub role: Role,
    pub classification_id: Option<Uuid>,
    pub classification_name: Option<String>,
    pub employee_type: EmployeeType,
    pub bargaining_unit: BargainingUnit,
    pub hire_date: Option<time::Date>,
    /// Total service at the organization — drives bid window ordering.
    pub overall_seniority_date: Option<time::Date>,
    /// Time in bargaining unit (VCCEA/VCSG) — drives inverse-seniority callout step.
    pub bargaining_unit_seniority_date: Option<time::Date>,
    /// Time in current classification — used in tie-breaking rules.
    pub classification_seniority_date: Option<time::Date>,
    pub cto_designation: bool,
    pub admin_training_supervisor_since: Option<time::Date>,
    pub employee_status: EmployeeStatus,
    /// Set when seniority accrual is currently paused (non-exception LOA/LWOP/layoff).
    /// The date the current pause began. Cleared on return to active status.
    pub accrual_paused_since: Option<time::Date>,
    /// Set when leave balance accruals are paused (same triggering conditions as seniority).
    /// Cleared when employee returns to active status.
    pub leave_accrual_paused_at: Option<time::Date>,
    pub is_active: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUserRequest {
    pub employee_id: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100))]
    pub last_name: String,
    #[validate(email)]
    pub email: String,
    pub phone: Option<String>,
    pub role: Role,
    pub classification_id: Option<Uuid>,
    pub employee_type: Option<EmployeeType>,
    pub bargaining_unit: Option<BargainingUnit>,
    pub hire_date: Option<time::Date>,
    pub overall_seniority_date: Option<time::Date>,
    pub bargaining_unit_seniority_date: Option<time::Date>,
    pub classification_seniority_date: Option<time::Date>,
    pub cto_designation: Option<bool>,
    pub admin_training_supervisor_since: Option<time::Date>,
    #[validate(length(min = 8, max = 128))]
    pub password: String,
}

/// Update request where nullable fields use `Option<Option<T>>` to distinguish
/// "not provided" (None) from "set to null" (Some(None)) vs "set to value" (Some(Some(v))).
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateUserRequest {
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub employee_id: Option<Option<String>>,
    #[validate(length(min = 1, max = 100))]
    pub first_name: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub last_name: Option<String>,
    #[validate(email)]
    pub email: Option<String>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub phone: Option<Option<String>>,
    pub role: Option<Role>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub classification_id: Option<Option<Uuid>>,
    pub employee_type: Option<EmployeeType>,
    pub bargaining_unit: Option<BargainingUnit>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub hire_date: Option<Option<time::Date>>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub overall_seniority_date: Option<Option<time::Date>>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub bargaining_unit_seniority_date: Option<Option<time::Date>>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub classification_seniority_date: Option<Option<time::Date>>,
    pub cto_designation: Option<bool>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub admin_training_supervisor_since: Option<Option<time::Date>>,
    pub employee_status: Option<EmployeeStatus>,
    /// When setting a pausing status (unpaid_loa / lwop / layoff), pass true to indicate
    /// the absence is an exception (OJI / pregnancy / military) so seniority is NOT paused.
    pub seniority_pause_exception: Option<bool>,
    /// Optimistic locking: the `updated_at` timestamp from the last GET.
    /// If provided and the record has been modified since, returns 409 Conflict.
    #[serde(default)]
    pub expected_updated_at: Option<OffsetDateTime>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub user: UserProfile,
}
