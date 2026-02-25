use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ShiftPattern {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub pattern_days: i32,
    pub work_days: i32,
    pub off_days: i32,
    pub anchor_date: time::Date,
    pub team_id: Option<Uuid>,
    pub is_active: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateShiftPatternRequest {
    pub name: String,
    pub pattern_days: i32,
    pub work_days: i32,
    pub off_days: i32,
    pub anchor_date: time::Date,
    pub team_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateShiftPatternRequest {
    pub name: Option<String>,
    pub pattern_days: Option<i32>,
    pub work_days: Option<i32>,
    pub off_days: Option<i32>,
    pub anchor_date: Option<time::Date>,
    pub team_id: Option<Option<Uuid>>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CycleDateQuery {
    pub date: time::Date,
}

#[derive(Debug, Serialize)]
pub struct CycleInfo {
    pub pattern_id: Uuid,
    pub pattern_name: String,
    pub date: time::Date,
    pub cycle_day: i32,
    pub is_work_day: bool,
    pub pattern_days: i32,
    pub work_days: i32,
    pub off_days: i32,
}
