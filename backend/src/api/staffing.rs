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

use crate::services::availability::compute_available_employees;

#[derive(Debug, Deserialize)]
pub struct AvailableQuery {
    pub date: time::Date,
    pub shift_template_id: Uuid,
    pub classification_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct BlockAvailableQuery {
    pub date: time::Date,
    pub classification_id: Uuid,
    pub block_start: String,
    pub block_end: String,
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
            // No scheduled_shift exists for this template+date.
            // Look up template info for the response, but do NOT auto-create
            // a scheduled_shift row (GET should not have write side-effects).
            let tmpl = sqlx::query!(
                "SELECT name, start_time, end_time, duration_minutes FROM shift_templates WHERE id = $1 AND org_id = $2",
                params.shift_template_id,
                auth.org_id,
            )
            .fetch_optional(&pool)
            .await?
            .ok_or_else(|| AppError::NotFound("Shift template not found".into()))?;

            return Ok(Json(StaffingAvailableResponse {
                employees: Vec::new(),
                scheduled_shift_id: Uuid::nil(),
                shift_template_name: tmpl.name,
                shift_start_time: tmpl.start_time,
                shift_end_time: tmpl.end_time,
                shift_duration_minutes: tmpl.duration_minutes,
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

/// GET /api/staffing/block-available
///
/// Returns available employees for a specific time block (e.g. 14:00-16:00).
/// Finds the shift template whose time range best covers the block, then
/// delegates to `compute_available_employees`.
pub async fn block_available(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<BlockAvailableQuery>,
) -> Result<Json<StaffingAvailableResponse>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let fmt = time::format_description::parse("[hour]:[minute]")
        .map_err(|_| AppError::BadRequest("invalid time format".into()))?;
    let block_start = time::Time::parse(&params.block_start, &fmt)
        .map_err(|_| AppError::BadRequest(format!("invalid block_start: {}", params.block_start)))?;
    let block_end = time::Time::parse(&params.block_end, &fmt)
        .map_err(|_| AppError::BadRequest(format!("invalid block_end: {}", params.block_end)))?;

    // Find shift templates that overlap this block
    let block_start_min = block_start.hour() as i32 * 60 + block_start.minute() as i32;
    let block_end_min = block_end.hour() as i32 * 60 + block_end.minute() as i32;

    let templates = sqlx::query!(
        r#"
        SELECT id, name, start_time, end_time, duration_minutes, crosses_midnight
        FROM shift_templates
        WHERE org_id = $1 AND is_active = true
        ORDER BY start_time
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    // Find the best overlapping template
    let mut best: Option<(Uuid, String, time::Time, time::Time, i32)> = None;
    let mut best_overlap = 0i32;

    for t in &templates {
        let t_start = t.start_time.hour() as i32 * 60 + t.start_time.minute() as i32;
        let t_end_raw = t.end_time.hour() as i32 * 60 + t.end_time.minute() as i32;

        let overlap = if t.crosses_midnight {
            // Midnight-crossing shift spans two intervals:
            //   evening portion: [t_start, 1440)  and  morning portion: [0, t_end_raw)
            let evening_overlap = {
                let os = t_start.max(block_start_min);
                let oe = 1440i32.min(block_end_min);
                (oe - os).max(0)
            };
            let morning_overlap = {
                let os = 0i32.max(block_start_min);
                let oe = t_end_raw.min(block_end_min);
                (oe - os).max(0)
            };
            evening_overlap + morning_overlap
        } else {
            let os = t_start.max(block_start_min);
            let oe = t_end_raw.min(block_end_min);
            (oe - os).max(0)
        };

        if overlap > best_overlap {
            best_overlap = overlap;
            best = Some((t.id, t.name.clone(), t.start_time, t.end_time, t.duration_minutes));
        }
    }

    let (template_id, template_name, start_time, end_time, duration_minutes) = best
        .ok_or_else(|| AppError::NotFound("No shift template overlaps this time block".into()))?;

    // Find or create scheduled_shift for this template + date
    let ss = sqlx::query!(
        "SELECT id FROM scheduled_shifts WHERE org_id = $1 AND shift_template_id = $2 AND date = $3",
        auth.org_id,
        template_id,
        params.date,
    )
    .fetch_optional(&pool)
    .await?;

    let scheduled_shift_id = match ss {
        Some(r) => r.id,
        None => {
            // No scheduled_shift exists for this template+date.
            // Return empty result rather than auto-creating (GET should not write).
            return Ok(Json(StaffingAvailableResponse {
                employees: Vec::new(),
                scheduled_shift_id: Uuid::nil(),
                shift_template_name: template_name,
                shift_start_time: start_time,
                shift_end_time: end_time,
                shift_duration_minutes: duration_minutes,
                existing_callout: None,
                existing_ot_requests: Vec::new(),
            }));
        }
    };

    let employees = compute_available_employees(
        &pool,
        auth.org_id,
        &auth.org_timezone,
        scheduled_shift_id,
        params.classification_id,
        params.date,
        start_time,
        duration_minutes,
    )
    .await?;

    // Check for active callout on this shift + classification
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
        scheduled_shift_id,
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

    // Check for OT requests on this date + classification that overlap this block
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
          AND (
            (otr.end_time >= otr.start_time AND otr.start_time < $5 AND otr.end_time > $4)
            OR
            (otr.end_time < otr.start_time AND (otr.start_time < $5 OR otr.end_time > $4))
          )
        ORDER BY otr.start_time
        "#,
        auth.org_id,
        params.date,
        params.classification_id,
        block_start,
        block_end,
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
        scheduled_shift_id,
        shift_template_name: template_name,
        shift_start_time: start_time,
        shift_end_time: end_time,
        shift_duration_minutes: duration_minutes,
        existing_callout,
        existing_ot_requests,
    }))
}

#[derive(Debug, Deserialize)]
pub struct MandatoryOtOrderQuery {
    pub classification_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct MandatoryOtOrderEntry {
    pub user_id: Uuid,
    pub last_mandatory_at: Option<String>,
}

/// GET /api/staffing/mandatory-ot-order
///
/// CBA (VCCEA Article 15): Mandatory OT distributed in inverse seniority order
/// (least senior first). Least senior = most recent bargaining_unit_seniority_date
/// = called first. NULL seniority date = no date = least senior = called first.
/// Used by MandatoryOTDialog to order the employee dropdown.
pub async fn mandatory_ot_order(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<MandatoryOtOrderQuery>,
) -> Result<Json<Vec<MandatoryOtOrderEntry>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        r#"
        SELECT
            u.id AS user_id,
            MAX(ora.assigned_at)::TEXT AS "last_mandatory_at?"
        FROM users u
        LEFT JOIN seniority_records sr ON sr.user_id = u.id
        LEFT JOIN ot_request_assignments ora ON ora.user_id = u.id
            AND ora.ot_type = 'mandatory'
            AND ora.cancelled_at IS NULL
        LEFT JOIN ot_requests otr ON otr.id = ora.ot_request_id
            AND otr.org_id = $1
        WHERE u.org_id = $1
          AND u.is_active = true
          AND u.classification_id = $2
        GROUP BY u.id, sr.bargaining_unit_seniority_date
        -- CBA: Mandatory OT distributed in inverse seniority order (least senior first)
        ORDER BY sr.bargaining_unit_seniority_date DESC NULLS FIRST
        "#,
        auth.org_id,
        params.classification_id,
    )
    .fetch_all(&pool)
    .await?;

    let entries: Vec<MandatoryOtOrderEntry> = rows
        .into_iter()
        .map(|r| MandatoryOtOrderEntry {
            user_id: r.user_id,
            last_mandatory_at: r.last_mandatory_at,
        })
        .collect();

    Ok(Json(entries))
}
