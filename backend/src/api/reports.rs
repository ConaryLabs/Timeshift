use axum::{
    extract::{Query, State},
    Json,
};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::report::{
        CoverageReport, LeaveReportQuery, LeaveSummaryReport, OtByPeriodEntry, OtByPeriodQuery,
        OtByPeriodReport, OtReportQuery, OtSummaryReport, ReportQuery, WorkSummaryQuery,
        WorkSummaryReport,
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

    if (q.end_date - q.start_date).whole_days() > 730 {
        return Err(AppError::BadRequest(
            "Date range cannot exceed 2 years".into(),
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
        LEFT JOIN assignments a ON a.scheduled_shift_id = ss.id AND a.cancelled_at IS NULL
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

    if (q.end_date - q.start_date).whole_days() > 730 {
        return Err(AppError::BadRequest(
            "Date range cannot exceed 2 years".into(),
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
          AND lr.org_id = $1
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

// -- OT by Time Period --

pub async fn ot_by_period(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<OtByPeriodQuery>,
) -> Result<Json<Vec<OtByPeriodReport>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if q.end_date < q.start_date {
        return Err(AppError::BadRequest(
            "end_date must be >= start_date".into(),
        ));
    }

    if (q.end_date - q.start_date).whole_days() > 730 {
        return Err(AppError::BadRequest(
            "Date range cannot exceed 2 years".into(),
        ));
    }

    let rows = sqlx::query!(
        r#"
        SELECT
            u.id AS user_id,
            u.first_name,
            u.last_name,
            c.name AS "classification_name?",
            ss.date,
            CAST(COALESCE(st.duration_minutes, 0) AS FLOAT8) / 60.0 AS "hours!",
            a.ot_type AS "ot_type?"
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        JOIN users u ON u.id = a.user_id
        LEFT JOIN classifications c ON c.id = u.classification_id
        WHERE ss.org_id = $1
          AND ss.date >= $2
          AND ss.date <= $3
          AND a.ot_type IS NOT NULL
          AND a.cancelled_at IS NULL
          AND ($4::uuid IS NULL OR u.classification_id = $4)
        ORDER BY u.last_name, u.first_name, ss.date
        "#,
        auth.org_id,
        q.start_date,
        q.end_date,
        q.classification_id,
    )
    .fetch_all(&pool)
    .await?;

    // Group by user
    let mut user_map: HashMap<Uuid, OtByPeriodReport> = HashMap::new();

    for r in rows {
        let entry = user_map
            .entry(r.user_id)
            .or_insert_with(|| OtByPeriodReport {
                user_id: r.user_id,
                user_name: format!("{} {}", r.first_name, r.last_name),
                classification_name: r.classification_name.clone(),
                total_hours: 0.0,
                assignments: Vec::new(),
            });
        entry.total_hours += r.hours;
        entry.assignments.push(OtByPeriodEntry {
            date: r.date,
            hours: r.hours,
            ot_type: r.ot_type,
        });
    }

    let mut result: Vec<OtByPeriodReport> = user_map.into_values().collect();
    result.sort_by(|a, b| {
        b.total_hours
            .partial_cmp(&a.total_hours)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(Json(result))
}

// -- Work Summary --

pub async fn work_summary(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<WorkSummaryQuery>,
) -> Result<Json<Vec<WorkSummaryReport>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if q.end_date < q.start_date {
        return Err(AppError::BadRequest(
            "end_date must be >= start_date".into(),
        ));
    }

    if (q.end_date - q.start_date).whole_days() > 730 {
        return Err(AppError::BadRequest(
            "Date range cannot exceed 2 years".into(),
        ));
    }

    let rows = sqlx::query!(
        r#"
        SELECT
            u.id AS user_id,
            u.first_name,
            u.last_name,
            COALESCE(regular.cnt, 0) AS "regular_shifts!",
            COALESCE(ot.cnt, 0) AS "ot_shifts!",
            COALESCE(leave.cnt, 0) AS "leave_days!",
            CAST(COALESCE(regular.total_hrs, 0) + COALESCE(ot.total_hrs, 0) AS FLOAT8) AS "total_hours!"
        FROM users u
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS cnt, SUM(st.duration_minutes::float8 / 60.0) AS total_hrs
            FROM assignments a
            JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
            JOIN shift_templates st ON st.id = ss.shift_template_id
            WHERE a.user_id = u.id
              AND ss.date >= $2
              AND ss.date <= $3
              AND a.ot_type IS NULL
              AND a.cancelled_at IS NULL
        ) regular ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS cnt, SUM(st.duration_minutes::float8 / 60.0) AS total_hrs
            FROM assignments a
            JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
            JOIN shift_templates st ON st.id = ss.shift_template_id
            WHERE a.user_id = u.id
              AND ss.date >= $2
              AND ss.date <= $3
              AND a.ot_type IS NOT NULL
              AND a.cancelled_at IS NULL
        ) ot ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(DISTINCT d::date) AS cnt
            FROM leave_requests lr
            CROSS JOIN LATERAL generate_series(
                GREATEST(lr.start_date::timestamp, $2::timestamp),
                LEAST(lr.end_date::timestamp, $3::timestamp),
                '1 day'::interval
            ) AS d
            WHERE lr.user_id = u.id
              AND lr.org_id = $1
              AND lr.status = 'approved'
              AND lr.start_date <= $3
              AND lr.end_date >= $2
        ) leave ON TRUE
        WHERE u.org_id = $1
          AND u.is_active = true
          AND ($4::uuid IS NULL OR u.id = $4)
          AND (COALESCE(regular.cnt, 0) + COALESCE(ot.cnt, 0) + COALESCE(leave.cnt, 0)) > 0
        ORDER BY u.last_name, u.first_name
        "#,
        auth.org_id,
        q.start_date,
        q.end_date,
        q.user_id,
    )
    .fetch_all(&pool)
    .await?;

    let period_str = format!("{} to {}", q.start_date, q.end_date);

    let result = rows
        .into_iter()
        .map(|r| WorkSummaryReport {
            user_id: r.user_id,
            user_name: format!("{} {}", r.first_name, r.last_name),
            period: period_str.clone(),
            regular_shifts: r.regular_shifts,
            ot_shifts: r.ot_shifts,
            leave_days: r.leave_days,
            total_hours: r.total_hours,
        })
        .collect();

    Ok(Json(result))
}
