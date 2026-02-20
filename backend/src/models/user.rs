use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

use crate::auth::Role;
use crate::models::common::deserialize_optional_field;

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
    pub hire_date: Option<time::Date>,
    pub seniority_date: Option<time::Date>,
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
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub hire_date: Option<Option<time::Date>>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub seniority_date: Option<Option<time::Date>>,
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
