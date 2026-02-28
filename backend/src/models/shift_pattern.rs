use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

use crate::models::common::deserialize_optional_field;

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
    /// For complex patterns (e.g. Pitman): 1-indexed days in the cycle that are work days.
    /// When NULL, the simple work_days/off_days formula applies.
    pub work_days_in_cycle: Option<Vec<i32>>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

impl ShiftPattern {
    /// Determine if a given cycle_day (1-indexed) is a work day.
    pub fn is_work_day(&self, cycle_day: i32) -> bool {
        if let Some(ref mask) = self.work_days_in_cycle {
            mask.contains(&cycle_day)
        } else {
            cycle_day <= self.work_days
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateShiftPatternRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub pattern_days: i32,
    /// Required for simple patterns (N on, M off). Ignored when work_days_in_cycle is set.
    pub work_days: Option<i32>,
    /// Required for simple patterns (N on, M off). Ignored when work_days_in_cycle is set.
    pub off_days: Option<i32>,
    pub anchor_date: time::Date,
    pub team_id: Option<Uuid>,
    /// For complex non-contiguous patterns: 1-indexed days in the cycle that are work days.
    pub work_days_in_cycle: Option<Vec<i32>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateShiftPatternRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub pattern_days: Option<i32>,
    pub work_days: Option<i32>,
    pub off_days: Option<i32>,
    pub anchor_date: Option<time::Date>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub team_id: Option<Option<Uuid>>,
    pub is_active: Option<bool>,
    /// Double-option: None = keep, Some(None) = clear, Some(Some(v)) = set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub work_days_in_cycle: Option<Option<Vec<i32>>>,
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
    pub work_days_in_cycle: Option<Vec<i32>>,
}

// ---------------------------------------------------------------------------
// Shift Pattern Assignments
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ShiftPatternAssignment {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub pattern_id: Uuid,
    pub effective_from: time::Date,
    pub effective_to: Option<time::Date>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

/// Assignment row with joined names for list views.
#[derive(Debug, Serialize)]
pub struct ShiftPatternAssignmentRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub pattern_id: Uuid,
    pub pattern_name: String,
    pub effective_from: time::Date,
    pub effective_to: Option<time::Date>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePatternAssignmentRequest {
    pub user_id: Uuid,
    pub pattern_id: Uuid,
    pub effective_from: time::Date,
    pub effective_to: Option<time::Date>,
}
