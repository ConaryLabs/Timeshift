use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::auth::Role;

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
    pub password_hash: String,
    pub role: Role,
    pub classification_id: Option<Uuid>,
    pub employee_type: EmployeeType,
    pub hire_date: Option<time::Date>,
    pub seniority_date: Option<time::Date>,
    pub is_active: bool,
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

/// Subset returned to the client (no password hash).
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
    pub hire_date: Option<time::Date>,
    pub seniority_date: Option<time::Date>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub employee_id: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: Option<String>,
    pub role: Role,
    pub classification_id: Option<Uuid>,
    pub employee_type: Option<EmployeeType>,
    pub hire_date: Option<time::Date>,
    pub seniority_date: Option<time::Date>,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserProfile,
}
