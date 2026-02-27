use axum::{extract::Query, extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::{
        callout::{CalloutListEntry, CalloutStatus},
        ot::CalloutStep,
    },
};

use super::callout::compute_available_employees;

#[derive(Debug, Deserialize)]
pub struct AvailableQuery {
    pub date: time::Date,
    pub shift_template_id: Uuid,
    pub classification_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct StaffingAvailableResponse {
    pub employees: Vec<CalloutListEntry>,
    pub scheduled_shift_id: Uuid,
    pub shift_template_name: String,
    #[serde(with = "crate::models::common::time_format")]
    pub shift_start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub shift_end_time: time::Time,
    pub shift_duration_minutes: i32,
    pub existing_callout: Option<CalloutEventSummary>,
    pub existing_ot_requests: Vec<OtRequestSummary>,
}

#[derive(Debug, Serialize)]
pub struct CalloutEventSummary {
    pub id: Uuid,
    pub status: CalloutStatus,
    pub current_step: Option<CalloutStep>,
}

#[derive(Debug, Serialize)]
pub struct OtRequestSummary {
    pub id: Uuid,
    pub status: String,
    pub volunteer_count: i64,
    pub assignment_count: i64,
    #[serde(with = "crate::models::common::time_format")]
    pub start_time: time::Time,
    #[serde(with = "crate::models::common::time_format")]
    pub end_time: time::Time,
}

pub async fn available_employees(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<AvailableQuery>,
) -> Result<Json<StaffingAvailableResponse>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Look up the scheduled shift and shift template info.
    // If no scheduled_shift exists yet for this template+date, auto-create one
    // (the monthly coverage grid shows gaps based on coverage plans, so the
    // scheduled_shift may not have been created yet).
    let shift_info = sqlx::query!(
        r#"
        SELECT ss.id AS scheduled_shift_id,
               st.name AS shift_template_name,
               st.start_time,
               st.end_time,
               st.duration_minutes
        FROM scheduled_shifts ss
        JOIN shift_templates st ON st.id = ss.shift_template_id
        WHERE ss.org_id = $1
          AND ss.shift_template_id = $2
          AND ss.date = $3
        "#,
        auth.org_id,
        params.shift_template_id,
        params.date,
    )
    .fetch_optional(&pool)
    .await?;

    let shift_info = match shift_info {
        Some(info) => info,
        None => {
            // Verify the shift template exists and belongs to this org
            let tmpl = sqlx::query!(
                "SELECT name, start_time, end_time, duration_minutes FROM shift_templates WHERE id = $1 AND org_id = $2",
                params.shift_template_id,
                auth.org_id,
            )
            .fetch_optional(&pool)
            .await?
            .ok_or_else(|| AppError::NotFound("Shift template not found".into()))?;

            // Auto-create the scheduled_shift
            let new_id = Uuid::new_v4();
            sqlx::query!(
                "INSERT INTO scheduled_shifts (id, org_id, shift_template_id, date) VALUES ($1, $2, $3, $4)",
                new_id,
                auth.org_id,
                params.shift_template_id,
                params.date,
            )
            .execute(&pool)
            .await?;

            // Return the same shape as the query above
            struct ShiftInfo {
                scheduled_shift_id: Uuid,
                shift_template_name: String,
                start_time: time::Time,
                end_time: time::Time,
                duration_minutes: i32,
            }
            let info = ShiftInfo {
                scheduled_shift_id: new_id,
                shift_template_name: tmpl.name,
                start_time: tmpl.start_time,
                end_time: tmpl.end_time,
                duration_minutes: tmpl.duration_minutes,
            };

            // Re-query to get the same anonymous struct type sqlx expects
            // (can't return a different type from match arms)
            return Ok(Json(StaffingAvailableResponse {
                employees: compute_available_employees(
                    &pool,
                    auth.org_id,
                    &auth.org_timezone,
                    info.scheduled_shift_id,
                    params.classification_id,
                    params.date,
                    info.start_time,
                    info.duration_minutes,
                )
                .await?,
                scheduled_shift_id: info.scheduled_shift_id,
                shift_template_name: info.shift_template_name,
                shift_start_time: info.start_time,
                shift_end_time: info.end_time,
                shift_duration_minutes: info.duration_minutes,
                existing_callout: None,
                existing_ot_requests: Vec::new(),
            }));
        }
    };

    // Compute the available employees list
    let employees = compute_available_employees(
        &pool,
        auth.org_id,
        &auth.org_timezone,
        shift_info.scheduled_shift_id,
        params.classification_id,
        params.date,
        shift_info.start_time,
        shift_info.duration_minutes,
    )
    .await?;

    // Check for active callout events on this shift + classification
    let existing_callout = sqlx::query!(
        r#"
        SELECT ce.id,
               ce.status AS "status: CalloutStatus",
               ce.current_step AS "current_step?: CalloutStep"
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        WHERE ce.scheduled_shift_id = $1
          AND ce.classification_id = $2
          AND ce.status = 'open'
          AND ss.org_id = $3
        ORDER BY ce.created_at DESC
        LIMIT 1
        "#,
        shift_info.scheduled_shift_id,
        params.classification_id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .map(|r| CalloutEventSummary {
        id: r.id,
        status: r.status,
        current_step: r.current_step,
    });

    // Check for OT requests on this date + classification
    let ot_rows = sqlx::query!(
        r#"
        SELECT otr.id,
               otr.status::TEXT AS "status!",
               otr.start_time,
               otr.end_time,
               (SELECT COUNT(*) FROM ot_request_volunteers v WHERE v.ot_request_id = otr.id) AS "volunteer_count!",
               (SELECT COUNT(*) FROM ot_request_assignments a WHERE a.ot_request_id = otr.id AND a.cancelled_at IS NULL) AS "assignment_count!"
        FROM ot_requests otr
        WHERE otr.org_id = $1
          AND otr.date = $2
          AND otr.classification_id = $3
          AND otr.status != 'cancelled'
        ORDER BY otr.start_time
        "#,
        auth.org_id,
        params.date,
        params.classification_id,
    )
    .fetch_all(&pool)
    .await?;

    let existing_ot_requests = ot_rows
        .into_iter()
        .map(|r| OtRequestSummary {
            id: r.id,
            status: r.status,
            volunteer_count: r.volunteer_count,
            assignment_count: r.assignment_count,
            start_time: r.start_time,
            end_time: r.end_time,
        })
        .collect();

    Ok(Json(StaffingAvailableResponse {
        employees,
        scheduled_shift_id: shift_info.scheduled_shift_id,
        shift_template_name: shift_info.shift_template_name,
        shift_start_time: shift_info.start_time,
        shift_end_time: shift_info.end_time,
        shift_duration_minutes: shift_info.duration_minutes,
        existing_callout,
        existing_ot_requests,
    }))
}
