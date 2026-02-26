use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use std::collections::{HashMap, HashSet};

use crate::{
    api::coverage_plans::{coverage_required_for_shifts, fetch_slot_totals, resolve_plan_id},
    auth::AuthUser,
    error::{AppError, Result},
    models::bidding::BidPeriodStatus,
    models::common::PaginationParams,
    models::schedule::{
        AnnotationQuery, Assignment, AssignmentView, CreateAnnotationRequest,
        CreateAssignmentRequest, DashboardData, DayViewEntry, GridAssignment, GridCell,
        ScheduleAnnotation, StaffingQuery,
    },
    models::shift::{
        CreateSchedulePeriodRequest, CreateSlotAssignmentRequest, SchedulePeriod, SlotAssignment,
        SlotAssignmentView, UpdateSchedulePeriodRequest,
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
          AND a.cancelled_at IS NULL
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
    use validator::Validate;
    req.validate()?;

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
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<SchedulePeriod>>> {
    let rows = sqlx::query_as!(
        SchedulePeriod,
        r#"
        SELECT id, org_id, name, start_date, end_date, is_active,
               status AS "status: BidPeriodStatus",
               bid_opens_at, bid_closes_at,
               bargaining_unit,
               created_at, updated_at
        FROM schedule_periods
        WHERE org_id = $1
        ORDER BY start_date DESC
        LIMIT $2 OFFSET $3
        "#,
        auth.org_id,
        params.limit(),
        params.offset(),
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn get_period(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<SchedulePeriod>> {
    let row = sqlx::query_as!(
        SchedulePeriod,
        r#"
        SELECT id, org_id, name, start_date, end_date, is_active,
               status AS "status: BidPeriodStatus",
               bid_opens_at, bid_closes_at,
               bargaining_unit,
               created_at, updated_at
        FROM schedule_periods
        WHERE id = $1 AND org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Schedule period not found".into()))?;

    Ok(Json(row))
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
        INSERT INTO schedule_periods (id, org_id, name, start_date, end_date, bargaining_unit)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, org_id, name, start_date, end_date, is_active,
                  status AS "status: BidPeriodStatus",
                  bid_opens_at, bid_closes_at,
                  bargaining_unit,
                  created_at, updated_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name,
        req.start_date,
        req.end_date,
        req.bargaining_unit,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn update_period(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateSchedulePeriodRequest>,
) -> Result<Json<SchedulePeriod>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_period(&pool, id, auth.org_id).await?;

    // Reject whitespace-only names
    if let Some(ref name) = req.name {
        if name.trim().is_empty() {
            return Err(AppError::BadRequest("Name cannot be blank".into()));
        }
    }

    // If dates are being changed, check that no slot_assignments exist for this period
    if req.start_date.is_some() || req.end_date.is_some() {
        let has_assignments = sqlx::query_scalar!(
            r#"SELECT EXISTS(SELECT 1 FROM slot_assignments WHERE period_id = $1) AS "exists!""#,
            id,
        )
        .fetch_one(&pool)
        .await?;

        if has_assignments {
            return Err(AppError::Conflict(
                "Cannot change dates for a period that has slot assignments. Remove assignments first.".into(),
            ));
        }
    }

    // Fetch existing period to resolve effective dates for validation
    let existing = sqlx::query!(
        "SELECT start_date, end_date FROM schedule_periods WHERE id = $1",
        id,
    )
    .fetch_one(&pool)
    .await?;

    let effective_start = req.start_date.unwrap_or(existing.start_date);
    let effective_end = req.end_date.unwrap_or(existing.end_date);

    if effective_end <= effective_start {
        return Err(AppError::BadRequest("End date must be after start date".into()));
    }

    let name_provided = req.name.is_some();
    let name_val = req.name.unwrap_or_default();
    let start_provided = req.start_date.is_some();
    let end_provided = req.end_date.is_some();
    let bu_provided = req.bargaining_unit.is_some();
    // Empty string means "clear to null"
    let bu_val = req.bargaining_unit.and_then(|s| if s.is_empty() { None } else { Some(s) });

    let row = sqlx::query_as!(
        SchedulePeriod,
        r#"
        UPDATE schedule_periods
        SET name            = CASE WHEN $3 THEN $4 ELSE name END,
            start_date      = CASE WHEN $5 THEN $6 ELSE start_date END,
            end_date        = CASE WHEN $7 THEN $8 ELSE end_date END,
            bargaining_unit = CASE WHEN $9 THEN $10 ELSE bargaining_unit END,
            updated_at = NOW()
        WHERE id = $1 AND org_id = $2
        RETURNING id, org_id, name, start_date, end_date, is_active,
                  status AS "status: BidPeriodStatus",
                  bid_opens_at, bid_closes_at,
                  bargaining_unit,
                  created_at, updated_at
        "#,
        id,
        auth.org_id,
        name_provided,
        name_val,
        start_provided,
        effective_start,
        end_provided,
        effective_end,
        bu_provided,
        bu_val as Option<String>,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Schedule period not found".into()))?;

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
          AND a.cancelled_at IS NULL
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
          AND lr.org_id = $1
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

    // Resolve coverage from coverage plans for all dates in range
    let shift_templates = sqlx::query!(
        r#"
        SELECT id, start_time, end_time, crosses_midnight
        FROM shift_templates
        WHERE org_id = $1 AND is_active = true
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let shift_info: Vec<(Uuid, time::Time, time::Time, bool)> = shift_templates
        .iter()
        .map(|t| (t.id, t.start_time, t.end_time, t.crosses_midnight))
        .collect();

    // Batch resolve plans: fetch all assignments overlapping the range
    let plan_assignments = sqlx::query!(
        r#"
        SELECT cpa.plan_id, cpa.start_date, cpa.end_date AS "end_date?"
        FROM coverage_plan_assignments cpa
        JOIN coverage_plans cp ON cp.id = cpa.plan_id
        WHERE cpa.org_id = $1
          AND cpa.start_date <= $2
          AND (cpa.end_date IS NULL OR cpa.end_date >= $3)
          AND cp.is_active = TRUE
        ORDER BY cpa.start_date DESC
        "#,
        auth.org_id,
        q.end_date,
        q.start_date,
    )
    .fetch_all(&pool)
    .await?;

    let default_plan_id = sqlx::query_scalar!(
        r#"
        SELECT id AS "id!"
        FROM coverage_plans
        WHERE org_id = $1 AND is_default = TRUE AND is_active = TRUE
        LIMIT 1
        "#,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?;

    // Build date -> plan_id mapping in memory
    let pa_tuples: Vec<(Uuid, time::Date, Option<time::Date>)> = plan_assignments
        .iter()
        .map(|r| (r.plan_id, r.start_date, r.end_date))
        .collect();

    let mut plan_dows: HashSet<(Uuid, i16)> = HashSet::new();
    let mut date_plan: HashMap<time::Date, Option<Uuid>> = HashMap::new();

    let mut d = q.start_date;
    while d <= q.end_date {
        let plan = pa_tuples
            .iter()
            .find(|(_, start, end)| *start <= d && end.is_none_or(|e| e >= d))
            .map(|(pid, _, _)| *pid)
            .or(default_plan_id);
        if let Some(pid) = plan {
            let dow = d.weekday().number_days_from_sunday() as i16;
            plan_dows.insert((pid, dow));
        }
        date_plan.insert(d, plan);
        d = match d.next_day() {
            Some(next) => next,
            None => break,
        };
    }

    // Fetch slot totals for each unique (plan_id, dow) and compute per-shift coverage
    let mut coverage_cache: HashMap<(Uuid, i16), HashMap<Uuid, i32>> = HashMap::new();
    for (pid, dow) in &plan_dows {
        let slot_totals = fetch_slot_totals(&pool, *pid, *dow).await?;
        let per_shift = coverage_required_for_shifts(&slot_totals, &shift_info);
        coverage_cache.insert((*pid, *dow), per_shift);
    }

    let mut cells_map: HashMap<(time::Date, Uuid), GridCell> = HashMap::new();

    for r in rows {
        let key = (r.date, r.shift_template_id);
        let cell = cells_map.entry(key).or_insert_with(|| {
            let dow = r.date.weekday().number_days_from_sunday() as i16;
            let required = date_plan
                .get(&r.date)
                .and_then(|plan| *plan)
                .and_then(|pid| coverage_cache.get(&(pid, dow)))
                .and_then(|m| m.get(&r.shift_template_id))
                .copied()
                .unwrap_or(0);
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
            notes: None,
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
    Path(date_str): Path<String>,
) -> Result<Json<Vec<DayViewEntry>>> {
    let format = time::format_description::parse("[year]-[month]-[day]")
        .map_err(|_| AppError::BadRequest("invalid date format".into()))?;
    let date = time::Date::parse(&date_str, &format)
        .map_err(|_| AppError::BadRequest(format!("invalid date: {date_str}")))?;
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
            a.is_trade,
            a.notes AS "notes?"
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates st  ON st.id = ss.shift_template_id
        JOIN users u             ON u.id  = a.user_id
        LEFT JOIN classifications cl ON cl.id = u.classification_id
        WHERE ss.org_id = $1 AND ss.date = $2
          AND a.cancelled_at IS NULL
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
                notes: a.notes,
            });
    }

    let dow = date.weekday().number_days_from_sunday() as i16;

    // Resolve coverage from coverage plans
    let coverage_map: HashMap<Uuid, i32> =
        if let Some(plan_id) = resolve_plan_id(&pool, auth.org_id, date).await? {
            let slot_totals = fetch_slot_totals(&pool, plan_id, dow).await?;
            let shift_info: Vec<(Uuid, time::Time, time::Time, bool)> = templates
                .iter()
                .map(|t| (t.id, t.start_time, t.end_time, t.crosses_midnight))
                .collect();
            coverage_required_for_shifts(&slot_totals, &shift_info)
        } else {
            HashMap::new()
        };

    let entries: Vec<DayViewEntry> = templates
        .into_iter()
        .map(|t| {
            let assigns = assignment_map.remove(&t.id).unwrap_or_default();
            let actual = assigns.len() as i32;
            let required = coverage_map.get(&t.id).copied().unwrap_or(0);
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
    let today = crate::services::timezone::org_today(&auth.org_timezone);

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
          AND a.cancelled_at IS NULL
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
                notes: None,
            });
    }

    let dow = today.weekday().number_days_from_sunday() as i16;

    // Resolve coverage from coverage plans
    let coverage_map: HashMap<Uuid, i32> =
        if let Some(plan_id) = resolve_plan_id(&pool, auth.org_id, today).await? {
            let slot_totals = fetch_slot_totals(&pool, plan_id, dow).await?;
            let shift_info: Vec<(Uuid, time::Time, time::Time, bool)> = templates
                .iter()
                .map(|t| (t.id, t.start_time, t.end_time, t.crosses_midnight))
                .collect();
            coverage_required_for_shifts(&slot_totals, &shift_info)
        } else {
            HashMap::new()
        };

    let current_coverage: Vec<DayViewEntry> = templates
        .into_iter()
        .map(|t| {
            let assigns = assignment_map.remove(&t.id).unwrap_or_default();
            let actual = assigns.len() as i32;
            let required = coverage_map.get(&t.id).copied().unwrap_or(0);
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
        WHERE lr.org_id = $1 AND lr.status = 'pending'
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
    use validator::Validate;
    req.validate()?;

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
