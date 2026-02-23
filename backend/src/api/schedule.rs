use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use std::collections::HashMap;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::bidding::BidPeriodStatus,
    models::schedule::{
        AnnotationQuery, Assignment, AssignmentView, CreateAnnotationRequest,
        CreateAssignmentRequest, DashboardData, DayViewEntry, GridAssignment, GridCell,
        ScheduleAnnotation, StaffingQuery,
    },
    models::shift::{
        CreateSchedulePeriodRequest, CreateSlotAssignmentRequest, SchedulePeriod, SlotAssignment,
        SlotAssignmentView,
    },
    org_guard,
};

/// Returns a staffing view for a date range.
pub async fn staffing_view(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<StaffingQuery>,
) -> Result<Json<Vec<AssignmentView>>> {
    if q.end_date < q.start_date {
        return Err(AppError::BadRequest(
            "end_date must be >= start_date".into(),
        ));
    }
    if (q.end_date - q.start_date).whole_days() > 90 {
        return Err(AppError::BadRequest(
            "Date range must not exceed 90 days".into(),
        ));
    }

    let rows = sqlx::query!(
        r#"
        SELECT
            a.id            AS assignment_id,
            ss.date,
            st.name         AS shift_name,
            st.color        AS shift_color,
            st.start_time,
            st.end_time,
            st.crosses_midnight,
            u.id            AS user_id,
            u.employee_id,
            u.first_name,
            u.last_name,
            a.position,
            a.is_overtime,
            a.is_trade,
            a.notes,
            t.name          AS "team_name?",
            cl.abbreviation AS "classification_abbreviation?"
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates  st ON st.id = ss.shift_template_id
        JOIN users            u  ON u.id  = a.user_id
        LEFT JOIN shift_slots sl ON sl.id = ss.slot_id
        LEFT JOIN teams       t  ON t.id  = sl.team_id
        LEFT JOIN classifications cl ON cl.id = u.classification_id
        WHERE ss.org_id = $1
          AND ss.date BETWEEN $2 AND $3
          AND st.is_active = true
          AND ($4::uuid IS NULL OR sl.team_id = $4)
        ORDER BY ss.date, st.start_time, u.last_name
        "#,
        auth.org_id,
        q.start_date,
        q.end_date,
        q.team_id,
    )
    .fetch_all(&pool)
    .await?;

    let views = rows
        .into_iter()
        .map(|r| AssignmentView {
            assignment_id: r.assignment_id,
            date: r.date,
            shift_name: r.shift_name,
            shift_color: r.shift_color,
            start_time: r.start_time,
            end_time: r.end_time,
            crosses_midnight: r.crosses_midnight,
            user_id: r.user_id,
            employee_id: r.employee_id,
            first_name: r.first_name,
            last_name: r.last_name,
            position: r.position,
            is_overtime: r.is_overtime,
            is_trade: r.is_trade,
            team_name: r.team_name,
            classification_abbreviation: r.classification_abbreviation,
            notes: r.notes,
        })
        .collect();

    Ok(Json(views))
}

pub async fn create_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateAssignmentRequest>,
) -> Result<Json<Assignment>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify both scheduled_shift and user belong to caller's org
    org_guard::verify_scheduled_shift(&pool, req.scheduled_shift_id, auth.org_id).await?;
    org_guard::verify_user(&pool, req.user_id, auth.org_id).await?;

    let a = sqlx::query_as!(
        Assignment,
        r#"
        INSERT INTO assignments (id, scheduled_shift_id, user_id, position, is_overtime, is_trade, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, scheduled_shift_id, user_id, position, is_overtime, is_trade, notes, created_by, created_at
        "#,
        Uuid::new_v4(),
        req.scheduled_shift_id,
        req.user_id,
        req.position,
        req.is_overtime,
        req.is_trade,
        req.notes,
        auth.id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(a))
}

pub async fn delete_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        r#"
        DELETE FROM assignments
        WHERE id = $1
          AND EXISTS (
              SELECT 1 FROM scheduled_shifts ss
              WHERE ss.id = assignments.scheduled_shift_id AND ss.org_id = $2
          )
        "#,
        id,
        auth.org_id
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Assignment not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// -- Schedule Periods --

pub async fn list_periods(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<SchedulePeriod>>> {
    let rows = sqlx::query_as!(
        SchedulePeriod,
        r#"
        SELECT id, org_id, name, start_date, end_date, is_active,
               status AS "status: BidPeriodStatus",
               bid_opens_at, bid_closes_at,
               created_at
        FROM schedule_periods
        WHERE org_id = $1
        ORDER BY start_date DESC
        "#,
        auth.org_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create_period(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateSchedulePeriodRequest>,
) -> Result<Json<SchedulePeriod>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let row = sqlx::query_as!(
        SchedulePeriod,
        r#"
        INSERT INTO schedule_periods (id, org_id, name, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, org_id, name, start_date, end_date, is_active,
                  status AS "status: BidPeriodStatus",
                  bid_opens_at, bid_closes_at,
                  created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name,
        req.start_date,
        req.end_date,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn assign_slot(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(period_id): Path<Uuid>,
    Json(req): Json<CreateSlotAssignmentRequest>,
) -> Result<Json<SlotAssignment>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify slot, user, and period all belong to caller's org
    org_guard::verify_slot(&pool, req.slot_id, auth.org_id).await?;
    org_guard::verify_user(&pool, req.user_id, auth.org_id).await?;
    org_guard::verify_period(&pool, period_id, auth.org_id).await?;

    let row = sqlx::query_as!(
        SlotAssignment,
        r#"
        INSERT INTO slot_assignments (id, slot_id, user_id, period_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (slot_id, period_id) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()
        RETURNING id, slot_id, user_id, period_id, created_at, updated_at
        "#,
        Uuid::new_v4(),
        req.slot_id,
        req.user_id,
        period_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn list_period_assignments(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(period_id): Path<Uuid>,
) -> Result<Json<Vec<SlotAssignmentView>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_period(&pool, period_id, auth.org_id).await?;

    let rows = sqlx::query!(
        r#"
        SELECT
            sl.id                   AS slot_id,
            sl.team_id,
            t.name                  AS team_name,
            st.name                 AS shift_template_name,
            st.start_time,
            st.end_time,
            cl.id                   AS classification_id,
            cl.name                 AS classification_name,
            cl.abbreviation         AS classification_abbreviation,
            sl.days_of_week,
            sl.label,
            sl.is_active            AS slot_is_active,
            sa.id                   AS "assignment_id?",
            sa.user_id              AS "user_id?",
            u.first_name            AS "user_first_name?",
            u.last_name             AS "user_last_name?"
        FROM shift_slots sl
        JOIN teams t ON t.id = sl.team_id
        JOIN shift_templates st ON st.id = sl.shift_template_id
        JOIN classifications cl ON cl.id = sl.classification_id
        LEFT JOIN slot_assignments sa ON sa.slot_id = sl.id AND sa.period_id = $2
        LEFT JOIN users u ON u.id = sa.user_id
        WHERE t.org_id = $1
          AND t.is_active = true
          AND sl.is_active = true
        ORDER BY t.name, st.start_time, cl.abbreviation
        "#,
        auth.org_id,
        period_id,
    )
    .fetch_all(&pool)
    .await?;

    let views = rows
        .into_iter()
        .map(|r| SlotAssignmentView {
            slot_id: r.slot_id,
            team_id: r.team_id,
            team_name: r.team_name,
            shift_template_name: r.shift_template_name,
            start_time: r.start_time,
            end_time: r.end_time,
            classification_id: r.classification_id,
            classification_name: r.classification_name,
            classification_abbreviation: r.classification_abbreviation,
            days_of_week: r.days_of_week,
            label: r.label,
            slot_is_active: r.slot_is_active,
            assignment_id: r.assignment_id,
            user_id: r.user_id,
            user_first_name: r.user_first_name,
            user_last_name: r.user_last_name,
        })
        .collect();

    Ok(Json(views))
}

pub async fn remove_slot_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((period_id, slot_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_period(&pool, period_id, auth.org_id).await?;
    org_guard::verify_slot(&pool, slot_id, auth.org_id).await?;

    let rows = sqlx::query!(
        r#"
        DELETE FROM slot_assignments
        WHERE slot_id = $1 AND period_id = $2
        "#,
        slot_id,
        period_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Assignment not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// -- Grid View --

#[derive(Debug, serde::Deserialize)]
pub struct GridQuery {
    pub start_date: time::Date,
    pub end_date: time::Date,
    pub team_id: Option<Uuid>,
}

pub async fn grid(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<GridQuery>,
) -> Result<Json<Vec<GridCell>>> {
    if q.end_date < q.start_date {
        return Err(AppError::BadRequest(
            "end_date must be >= start_date".into(),
        ));
    }
    if (q.end_date - q.start_date).whole_days() > 90 {
        return Err(AppError::BadRequest(
            "Date range must not exceed 90 days".into(),
        ));
    }

    let rows = sqlx::query!(
        r#"
        SELECT
            ss.date,
            st.id              AS shift_template_id,
            st.name            AS shift_name,
            st.color           AS shift_color,
            a.id               AS assignment_id,
            u.id               AS user_id,
            u.employee_id,
            u.first_name,
            u.last_name,
            cl.abbreviation    AS "classification_abbreviation?",
            a.is_overtime,
            a.is_trade
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates st  ON st.id = ss.shift_template_id
        JOIN users u             ON u.id  = a.user_id
        LEFT JOIN shift_slots sl ON sl.id = ss.slot_id
        LEFT JOIN classifications cl ON cl.id = u.classification_id
        WHERE ss.org_id = $1
          AND ss.date BETWEEN $2 AND $3
          AND st.is_active = true
          AND ($4::uuid IS NULL OR sl.team_id = $4)
        ORDER BY ss.date, st.start_time, u.last_name
        "#,
        auth.org_id,
        q.start_date,
        q.end_date,
        q.team_id,
    )
    .fetch_all(&pool)
    .await?;

    let leave_rows = sqlx::query!(
        r#"
        SELECT d::date AS "date!", COUNT(*) AS "count!"
        FROM leave_requests lr
        JOIN users u ON u.id = lr.user_id
        CROSS JOIN LATERAL generate_series(
            lr.start_date::timestamp,
            lr.end_date::timestamp,
            '1 day'::interval
        ) AS d
        WHERE u.org_id = $1
          AND lr.status = 'approved'
          AND d::date BETWEEN $2 AND $3
        GROUP BY d::date
        "#,
        auth.org_id,
        q.start_date,
        q.end_date,
    )
    .fetch_all(&pool)
    .await?;

    let leave_map: HashMap<time::Date, i64> =
        leave_rows.into_iter().map(|r| (r.date, r.count)).collect();

    let coverage_rows = sqlx::query!(
        r#"
        SELECT shift_template_id, day_of_week, SUM(target_headcount) AS "total!"
        FROM coverage_requirements
        WHERE org_id = $1
        GROUP BY shift_template_id, day_of_week
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let mut coverage_map: HashMap<(Uuid, i32), i64> = HashMap::new();
    for r in coverage_rows {
        coverage_map.insert((r.shift_template_id, r.day_of_week), r.total);
    }

    let mut cells_map: HashMap<(time::Date, Uuid), GridCell> = HashMap::new();

    for r in rows {
        let key = (r.date, r.shift_template_id);
        let cell = cells_map.entry(key).or_insert_with(|| {
            let dow = r.date.weekday().number_days_from_sunday() as i32;
            let required = coverage_map
                .get(&(r.shift_template_id, dow))
                .copied()
                .unwrap_or(0) as i32;
            GridCell {
                date: r.date,
                shift_template_id: r.shift_template_id,
                shift_name: r.shift_name.clone(),
                shift_color: r.shift_color.clone(),
                assignments: Vec::new(),
                leave_count: *leave_map.get(&r.date).unwrap_or(&0),
                coverage_required: required,
                coverage_actual: 0,
            }
        });

        cell.assignments.push(GridAssignment {
            assignment_id: r.assignment_id,
            user_id: r.user_id,
            employee_id: r.employee_id,
            first_name: r.first_name,
            last_name: r.last_name,
            classification_abbreviation: r.classification_abbreviation,
            is_overtime: r.is_overtime,
            is_trade: r.is_trade,
        });
        cell.coverage_actual = cell.assignments.len() as i32;
    }

    let mut cells: Vec<GridCell> = cells_map.into_values().collect();
    cells.sort_by(|a, b| a.date.cmp(&b.date).then(a.shift_name.cmp(&b.shift_name)));

    Ok(Json(cells))
}

// -- Day View --

pub async fn day_view(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(date): Path<time::Date>,
) -> Result<Json<Vec<DayViewEntry>>> {
    let templates = sqlx::query!(
        r#"
        SELECT id, name, color, start_time, end_time, crosses_midnight
        FROM shift_templates
        WHERE org_id = $1 AND is_active = true
        ORDER BY start_time
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let assignments = sqlx::query!(
        r#"
        SELECT
            st.id              AS shift_template_id,
            a.id               AS assignment_id,
            u.id               AS user_id,
            u.employee_id,
            u.first_name,
            u.last_name,
            cl.abbreviation    AS "classification_abbreviation?",
            a.is_overtime,
            a.is_trade
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates st  ON st.id = ss.shift_template_id
        JOIN users u             ON u.id  = a.user_id
        LEFT JOIN classifications cl ON cl.id = u.classification_id
        WHERE ss.org_id = $1 AND ss.date = $2
        ORDER BY st.start_time, u.last_name
        "#,
        auth.org_id,
        date,
    )
    .fetch_all(&pool)
    .await?;

    let mut assignment_map: HashMap<Uuid, Vec<GridAssignment>> = HashMap::new();
    for a in assignments {
        assignment_map
            .entry(a.shift_template_id)
            .or_default()
            .push(GridAssignment {
                assignment_id: a.assignment_id,
                user_id: a.user_id,
                employee_id: a.employee_id,
                first_name: a.first_name,
                last_name: a.last_name,
                classification_abbreviation: a.classification_abbreviation,
                is_overtime: a.is_overtime,
                is_trade: a.is_trade,
            });
    }

    let dow = date.weekday().number_days_from_sunday() as i32;
    let coverage_rows = sqlx::query!(
        r#"
        SELECT shift_template_id, SUM(target_headcount) AS "total!"
        FROM coverage_requirements
        WHERE org_id = $1 AND day_of_week = $2
        GROUP BY shift_template_id
        "#,
        auth.org_id,
        dow,
    )
    .fetch_all(&pool)
    .await?;

    let coverage_map: HashMap<Uuid, i64> = coverage_rows
        .into_iter()
        .map(|r| (r.shift_template_id, r.total))
        .collect();

    let entries: Vec<DayViewEntry> = templates
        .into_iter()
        .map(|t| {
            let assigns = assignment_map.remove(&t.id).unwrap_or_default();
            let actual = assigns.len() as i32;
            let required = coverage_map.get(&t.id).copied().unwrap_or(0) as i32;
            let status = if required == 0 || actual >= required {
                "green"
            } else if actual > 0 {
                "yellow"
            } else {
                "red"
            };

            DayViewEntry {
                shift_template_id: t.id,
                shift_name: t.name,
                shift_color: t.color,
                start_time: t.start_time,
                end_time: t.end_time,
                crosses_midnight: t.crosses_midnight,
                assignments: assigns,
                coverage_required: required,
                coverage_actual: actual,
                coverage_status: status.to_string(),
            }
        })
        .collect();

    Ok(Json(entries))
}

// -- Dashboard --

pub async fn dashboard(State(pool): State<PgPool>, auth: AuthUser) -> Result<Json<DashboardData>> {
    let today = time::OffsetDateTime::now_utc().date();

    let templates = sqlx::query!(
        r#"
        SELECT id, name, color, start_time, end_time, crosses_midnight
        FROM shift_templates
        WHERE org_id = $1 AND is_active = true
        ORDER BY start_time
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let assignments = sqlx::query!(
        r#"
        SELECT
            st.id              AS shift_template_id,
            a.id               AS assignment_id,
            u.id               AS user_id,
            u.employee_id,
            u.first_name,
            u.last_name,
            cl.abbreviation    AS "classification_abbreviation?",
            a.is_overtime,
            a.is_trade
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates st  ON st.id = ss.shift_template_id
        JOIN users u             ON u.id  = a.user_id
        LEFT JOIN classifications cl ON cl.id = u.classification_id
        WHERE ss.org_id = $1 AND ss.date = $2
        ORDER BY st.start_time, u.last_name
        "#,
        auth.org_id,
        today,
    )
    .fetch_all(&pool)
    .await?;

    let mut assignment_map: HashMap<Uuid, Vec<GridAssignment>> = HashMap::new();
    for a in assignments {
        assignment_map
            .entry(a.shift_template_id)
            .or_default()
            .push(GridAssignment {
                assignment_id: a.assignment_id,
                user_id: a.user_id,
                employee_id: a.employee_id,
                first_name: a.first_name,
                last_name: a.last_name,
                classification_abbreviation: a.classification_abbreviation,
                is_overtime: a.is_overtime,
                is_trade: a.is_trade,
            });
    }

    let dow = today.weekday().number_days_from_sunday() as i32;
    let coverage_rows = sqlx::query!(
        r#"
        SELECT shift_template_id, SUM(target_headcount) AS "total!"
        FROM coverage_requirements
        WHERE org_id = $1 AND day_of_week = $2
        GROUP BY shift_template_id
        "#,
        auth.org_id,
        dow,
    )
    .fetch_all(&pool)
    .await?;

    let coverage_map: HashMap<Uuid, i64> = coverage_rows
        .into_iter()
        .map(|r| (r.shift_template_id, r.total))
        .collect();

    let current_coverage: Vec<DayViewEntry> = templates
        .into_iter()
        .map(|t| {
            let assigns = assignment_map.remove(&t.id).unwrap_or_default();
            let actual = assigns.len() as i32;
            let required = coverage_map.get(&t.id).copied().unwrap_or(0) as i32;
            let status = if required == 0 || actual >= required {
                "green"
            } else if actual > 0 {
                "yellow"
            } else {
                "red"
            };

            DayViewEntry {
                shift_template_id: t.id,
                shift_name: t.name,
                shift_color: t.color,
                start_time: t.start_time,
                end_time: t.end_time,
                crosses_midnight: t.crosses_midnight,
                assignments: assigns,
                coverage_required: required,
                coverage_actual: actual,
                coverage_status: status.to_string(),
            }
        })
        .collect();

    let pending_leave_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM leave_requests lr
        JOIN users u ON u.id = lr.user_id
        WHERE u.org_id = $1 AND lr.status = 'pending'
        "#,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    let open_callout_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        WHERE ss.org_id = $1 AND ce.status = 'open'
        "#,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    let annotations = sqlx::query_as!(
        ScheduleAnnotation,
        r#"
        SELECT id, org_id, date, shift_template_id AS "shift_template_id?", content,
               annotation_type, created_by, created_at
        FROM schedule_annotations
        WHERE org_id = $1 AND date = $2
        ORDER BY created_at
        "#,
        auth.org_id,
        today,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(DashboardData {
        current_coverage,
        pending_leave_count,
        open_callout_count,
        annotations,
    }))
}

// -- Annotations --

pub async fn list_annotations(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(q): Query<AnnotationQuery>,
) -> Result<Json<Vec<ScheduleAnnotation>>> {
    let rows = sqlx::query_as!(
        ScheduleAnnotation,
        r#"
        SELECT id, org_id, date, shift_template_id AS "shift_template_id?", content,
               annotation_type, created_by, created_at
        FROM schedule_annotations
        WHERE org_id = $1 AND date BETWEEN $2 AND $3
        ORDER BY date, created_at
        "#,
        auth.org_id,
        q.start_date,
        q.end_date,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create_annotation(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateAnnotationRequest>,
) -> Result<Json<ScheduleAnnotation>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let valid_types = ["note", "alert", "holiday"];
    if !valid_types.contains(&req.annotation_type.as_str()) {
        return Err(AppError::BadRequest(
            "annotation_type must be 'note', 'alert', or 'holiday'".into(),
        ));
    }

    if let Some(template_id) = req.shift_template_id {
        org_guard::verify_shift_template(&pool, template_id, auth.org_id).await?;
    }

    let row = sqlx::query_as!(
        ScheduleAnnotation,
        r#"
        INSERT INTO schedule_annotations (id, org_id, date, shift_template_id, content, annotation_type, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, org_id, date, shift_template_id AS "shift_template_id?", content,
                  annotation_type, created_by, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.date,
        req.shift_template_id,
        req.content,
        req.annotation_type,
        auth.id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn delete_annotation(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "DELETE FROM schedule_annotations WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Annotation not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
