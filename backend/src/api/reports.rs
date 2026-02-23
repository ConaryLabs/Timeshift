use axum::{
    extract::{Query, State},
    Json,
};
use sqlx::PgPool;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::report::{
        CoverageReport, LeaveReportQuery, LeaveSummaryReport, OtReportQuery, OtSummaryReport,
        ReportQuery,
    },
};

pub async fn coverage(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<ReportQuery>,
) -> Result<Json<Vec<CoverageReport>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if q.end_date < q.start_date {
        return Err(AppError::BadRequest(
            "end_date must be >= start_date".into(),
        ));
    }

    let rows = sqlx::query!(
        r#"
        SELECT
            ss.date,
            ss.shift_template_id,
            st.name AS shift_name,
            ss.required_headcount,
            COUNT(a.id) AS "actual_headcount!"
        FROM scheduled_shifts ss
        JOIN shift_templates st ON st.id = ss.shift_template_id
        LEFT JOIN assignments a ON a.scheduled_shift_id = ss.id
        WHERE ss.org_id = $1
          AND ss.date >= $2
          AND ss.date <= $3
          AND ($4::uuid IS NULL OR ss.shift_template_id IN (
              SELECT shift_template_id FROM shift_slots WHERE team_id = $4
          ))
        GROUP BY ss.id, ss.date, ss.shift_template_id, st.name, ss.required_headcount
        ORDER BY ss.date, st.name
        "#,
        auth.org_id,
        q.start_date,
        q.end_date,
        q.team_id,
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| {
            let required = r.required_headcount;
            let actual = r.actual_headcount;
            let pct = if required > 0 {
                (actual as f64 / required as f64) * 100.0
            } else {
                100.0
            };
            let status = if pct > 100.0 {
                "over"
            } else if (pct - 100.0).abs() < f64::EPSILON {
                "met"
            } else if pct >= 50.0 {
                "under"
            } else {
                "critical"
            };
            CoverageReport {
                date: r.date,
                shift_template_id: r.shift_template_id,
                shift_name: r.shift_name,
                required_headcount: required,
                actual_headcount: actual,
                coverage_percent: (pct * 10.0).round() / 10.0,
                status: status.to_string(),
            }
        })
        .collect();

    Ok(Json(result))
}

pub async fn ot_summary(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<OtReportQuery>,
) -> Result<Json<Vec<OtSummaryReport>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let current_year = time::OffsetDateTime::now_utc().year();
    let fiscal_year = q.fiscal_year.unwrap_or(current_year);

    let rows = sqlx::query!(
        r#"
        SELECT
            u.id AS user_id,
            u.first_name,
            u.last_name,
            c.name AS "classification_name?",
            CAST(COALESCE(SUM(oh.hours_worked), 0) AS FLOAT8) AS "hours_worked!",
            CAST(COALESCE(SUM(oh.hours_declined), 0) AS FLOAT8) AS "hours_declined!",
            CAST(COALESCE(SUM(oh.hours_worked + oh.hours_declined), 0) AS FLOAT8) AS "total_hours!"
        FROM ot_hours oh
        JOIN users u ON u.id = oh.user_id
        LEFT JOIN classifications c ON c.id = oh.classification_id
        WHERE u.org_id = $1
          AND u.is_active = true
          AND oh.fiscal_year = $2
          AND ($3::uuid IS NULL OR oh.classification_id = $3)
        GROUP BY u.id, u.first_name, u.last_name, c.name
        ORDER BY "total_hours!" DESC
        "#,
        auth.org_id,
        fiscal_year,
        q.classification_id,
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| OtSummaryReport {
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            classification_name: r.classification_name,
            hours_worked: r.hours_worked,
            hours_declined: r.hours_declined,
            total_hours: r.total_hours,
        })
        .collect();

    Ok(Json(result))
}

pub async fn leave_summary(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<LeaveReportQuery>,
) -> Result<Json<Vec<LeaveSummaryReport>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if q.end_date < q.start_date {
        return Err(AppError::BadRequest(
            "end_date must be >= start_date".into(),
        ));
    }

    let rows = sqlx::query!(
        r#"
        SELECT
            lt.code AS leave_type_code,
            lt.name AS leave_type_name,
            COUNT(lr.id) AS "total_requests!",
            COUNT(lr.id) FILTER (WHERE lr.status = 'approved') AS "approved_count!",
            COUNT(lr.id) FILTER (WHERE lr.status = 'denied') AS "denied_count!",
            COUNT(lr.id) FILTER (WHERE lr.status = 'pending') AS "pending_count!",
            CAST(COALESCE(SUM(lr.hours) FILTER (WHERE lr.status = 'approved'), 0) AS FLOAT8) AS "total_hours!"
        FROM leave_requests lr
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        JOIN users u ON u.id = lr.user_id
        WHERE u.org_id = $1
          AND lr.start_date <= $3
          AND lr.end_date >= $2
        GROUP BY lt.id, lt.code, lt.name
        ORDER BY lt.name
        "#,
        auth.org_id,
        q.start_date,
        q.end_date,
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| LeaveSummaryReport {
            leave_type_code: r.leave_type_code,
            leave_type_name: r.leave_type_name,
            total_requests: r.total_requests,
            approved_count: r.approved_count,
            denied_count: r.denied_count,
            pending_count: r.pending_count,
            total_hours: r.total_hours,
        })
        .collect();

    Ok(Json(result))
}
