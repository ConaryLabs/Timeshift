use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use crate::{
    api::helpers::{json_ok, validate_date_range},
    auth::AuthUser,
    error::{AppError, Result},
    models::duty_position::{
        AvailableEmployee, AvailableStaffQuery, BoardAssignment, BoardPosition, CellAction,
        CellActionKind, ConsoleHoursEntry, ConsoleHoursQuery, DutyBoardResponse,
    },
};

/// Compute which of the 12 two-hour blocks (0=00:00-02:00 .. 11=22:00-24:00)
/// are open for a position on a given day-of-week.
///
/// If no hours row exists for that day, all 12 blocks are open (24/7).
fn compute_open_blocks(
    open_time: Option<time::Time>,
    close_time: Option<time::Time>,
    crosses_midnight: bool,
) -> Vec<bool> {
    match (open_time, close_time) {
        (Some(open), Some(close)) => {
            let open_mins = open.hour() as i32 * 60 + open.minute() as i32;
            let close_mins = close.hour() as i32 * 60 + close.minute() as i32;

            (0..12)
                .map(|block| {
                    let block_start = block * 120; // minutes
                    let block_end = block_start + 120;

                    if crosses_midnight {
                        // e.g., open=12:00 (720), close=02:00 (120) → open from 720..1440 and 0..120
                        // Block is open if it overlaps [open_mins..1440) OR [0..close_mins)
                        (block_start < 1440 && block_end > open_mins)
                            || (block_start < close_mins && block_end > 0)
                    } else {
                        // Simple case: block overlaps [open_mins..close_mins)
                        block_start < close_mins && block_end > open_mins
                    }
                })
                .collect()
        }
        _ => vec![true; 12], // No hours row = open 24/7
    }
}

// ============================================================
// GET /api/duty-board/:date — Full board state
// ============================================================

/// Row type for the hours query
#[derive(sqlx::FromRow)]
struct PositionHoursRow {
    duty_position_id: Uuid,
    open_time: time::Time,
    close_time: time::Time,
    crosses_midnight: bool,
}

/// Row type for position qualifications
#[derive(sqlx::FromRow)]
struct PositionQualRow {
    duty_position_id: Uuid,
    qualification_name: String,
}

/// Row type for classification abbreviation
#[derive(sqlx::FromRow)]
struct PositionClassRow {
    id: Uuid,
    name: String,
    classification_id: Option<Uuid>,
    classification_abbr: Option<String>,
    sort_order: i32,
    board_date: Option<time::Date>,
}

pub async fn get_board(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(date): Path<time::Date>,
) -> Result<Json<DutyBoardResponse>> {
    // day_of_week: 0=Sunday..6=Saturday (matches PostgreSQL EXTRACT(DOW))
    let dow = date.weekday().number_days_from_sunday() as i16;

    // 1. Fetch all active positions with classification abbreviation
    let position_rows = sqlx::query_as!(
        PositionClassRow,
        r#"
        SELECT dp.id, dp.name, dp.classification_id,
               c.abbreviation AS "classification_abbr?"
        , dp.sort_order, dp.board_date
        FROM duty_positions dp
        LEFT JOIN classifications c ON c.id = dp.classification_id
        WHERE dp.org_id = $1 AND dp.is_active = true
          AND (dp.board_date IS NULL OR dp.board_date = $2)
        ORDER BY dp.sort_order, dp.name
        "#,
        auth.org_id,
        date,
    )
    .fetch_all(&pool)
    .await?;

    let position_ids: Vec<Uuid> = position_rows.iter().map(|p| p.id).collect();

    // 2-3-5. Fetch hours, qualifications, and assignments concurrently (all independent)
    let hours_fut = sqlx::query_as!(
        PositionHoursRow,
        r#"
        SELECT duty_position_id, open_time, close_time, crosses_midnight
        FROM duty_position_hours
        WHERE duty_position_id = ANY($1) AND day_of_week = $2
        "#,
        &position_ids,
        dow,
    )
    .fetch_all(&pool);

    let qual_fut = sqlx::query_as!(
        PositionQualRow,
        r#"
        SELECT dpq.duty_position_id, q.name AS qualification_name
        FROM duty_position_qualifications dpq
        JOIN qualifications q ON q.id = dpq.qualification_id
        WHERE dpq.duty_position_id = ANY($1)
        ORDER BY q.name
        "#,
        &position_ids,
    )
    .fetch_all(&pool);

    let assign_fut = sqlx::query_as!(
        BoardAssignment,
        r#"
        SELECT da.id, da.duty_position_id,
               da.block_index AS "block_index!",
               da.user_id AS "user_id?",
               u.first_name AS "user_first_name?",
               u.last_name AS "user_last_name?",
               da.status
        FROM duty_assignments da
        LEFT JOIN users u ON u.id = da.user_id
        WHERE da.org_id = $1 AND da.date = $2
        ORDER BY da.duty_position_id, da.block_index
        "#,
        auth.org_id,
        date,
    )
    .fetch_all(&pool);

    let (hours_rows, qual_rows, assignments) = tokio::try_join!(hours_fut, qual_fut, assign_fut)?;

    let hours_map: HashMap<Uuid, &PositionHoursRow> =
        hours_rows.iter().map(|h| (h.duty_position_id, h)).collect();

    let mut qual_map: HashMap<Uuid, Vec<String>> = HashMap::new();
    for qr in &qual_rows {
        qual_map
            .entry(qr.duty_position_id)
            .or_default()
            .push(qr.qualification_name.clone());
    }

    // 4. Build positions response
    let positions: Vec<BoardPosition> = position_rows
        .iter()
        .map(|p| {
            let hours = hours_map.get(&p.id);
            let open_blocks = compute_open_blocks(
                hours.map(|h| h.open_time),
                hours.map(|h| h.close_time),
                hours.map(|h| h.crosses_midnight).unwrap_or(false),
            );
            BoardPosition {
                id: p.id,
                name: p.name.clone(),
                classification_id: p.classification_id,
                classification_abbr: p.classification_abbr.clone(),
                sort_order: p.sort_order,
                board_date: p.board_date,
                open_blocks,
                required_qualifications: qual_map.get(&p.id).cloned().unwrap_or_default(),
            }
        })
        .collect();

    Ok(Json(DutyBoardResponse {
        date: date.to_string(),
        positions,
        assignments,
    }))
}

// ============================================================
// POST /api/duty-board/:date/cells — Assign/mark_ot/clear a cell
// ============================================================

pub async fn cell_action(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(date): Path<time::Date>,
    Json(req): Json<CellAction>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if req.block_index < 0 || req.block_index > 11 {
        return Err(AppError::BadRequest("block_index must be 0-11".into()));
    }

    // Verify position belongs to org
    crate::org_guard::verify_duty_position(&pool, req.duty_position_id, auth.org_id).await?;

    match req.action {
        CellActionKind::Assign => {
            let user_id = req
                .user_id
                .ok_or_else(|| AppError::BadRequest("user_id required for assign".into()))?;

            crate::org_guard::verify_user(&pool, user_id, auth.org_id).await?;

            sqlx::query!(
                r#"
                INSERT INTO duty_assignments (id, org_id, duty_position_id, user_id, date, block_index, status, assigned_by)
                VALUES ($1, $2, $3, $4, $5, $6, 'assigned', $7)
                ON CONFLICT (duty_position_id, date, block_index)
                DO UPDATE SET user_id = $4, status = 'assigned', assigned_by = $7, updated_at = NOW()
                "#,
                Uuid::new_v4(),
                auth.org_id,
                req.duty_position_id,
                user_id,
                date,
                req.block_index,
                auth.id,
            )
            .execute(&pool)
            .await?;
        }
        CellActionKind::MarkOt => {
            sqlx::query!(
                r#"
                INSERT INTO duty_assignments (id, org_id, duty_position_id, user_id, date, block_index, status, assigned_by)
                VALUES ($1, $2, $3, NULL, $4, $5, 'ot_needed', $6)
                ON CONFLICT (duty_position_id, date, block_index)
                DO UPDATE SET user_id = NULL, status = 'ot_needed', assigned_by = $6, updated_at = NOW()
                "#,
                Uuid::new_v4(),
                auth.org_id,
                req.duty_position_id,
                date,
                req.block_index,
                auth.id,
            )
            .execute(&pool)
            .await?;
        }
        CellActionKind::Clear => {
            sqlx::query!(
                r#"
                DELETE FROM duty_assignments
                WHERE duty_position_id = $1 AND date = $2 AND block_index = $3 AND org_id = $4
                "#,
                req.duty_position_id,
                date,
                req.block_index,
                auth.org_id,
            )
            .execute(&pool)
            .await?;
        }
    }

    Ok(json_ok())
}

// ============================================================
// GET /api/duty-board/:date/available — Available staff for a block
// ============================================================

#[derive(sqlx::FromRow)]
struct OnShiftEmployee {
    user_id: Uuid,
    first_name: String,
    last_name: String,
    shift_name: String,
    shift_start: String,
    shift_end: String,
    is_overtime: bool,
}

pub async fn available_staff(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(date): Path<time::Date>,
    Query(params): Query<AvailableStaffQuery>,
) -> Result<Json<Vec<AvailableEmployee>>> {
    if params.block_index < 0 || params.block_index > 11 {
        return Err(AppError::BadRequest("block_index must be 0-11".into()));
    }

    // Block time range in minutes
    let block_start_mins = params.block_index as i32 * 120;
    let block_end_mins = block_start_mins + 120;

    // 1. Get position info (classification_id + required qualifications) concurrently
    let pos_fut = sqlx::query!(
        r#"
        SELECT classification_id
        FROM duty_positions
        WHERE id = $1 AND org_id = $2 AND is_active = true
        "#,
        params.duty_position_id,
        auth.org_id,
    )
    .fetch_optional(&pool);

    let qual_fut = sqlx::query_scalar!(
        "SELECT qualification_id FROM duty_position_qualifications WHERE duty_position_id = $1",
        params.duty_position_id,
    )
    .fetch_all(&pool);

    let (position_opt, required_qual_ids) = tokio::try_join!(pos_fut, qual_fut)?;

    let position = position_opt
        .ok_or_else(|| AppError::NotFound("Duty position not found".into()))?;

    // 2. Find employees on shift during this block
    // We need people whose shift covers the block time range.
    // Regular assignments (from scheduled_shifts + assignments table)
    let prev_date = date
        - time::Duration::days(1);

    let on_shift_employees: Vec<OnShiftEmployee> = sqlx::query_as!(
        OnShiftEmployee,
        r#"
        SELECT DISTINCT ON (u.id)
            u.id AS user_id,
            u.first_name,
            u.last_name,
            st.name AS shift_name,
            TO_CHAR(st.start_time, 'HH24:MI') AS "shift_start!",
            TO_CHAR(st.end_time, 'HH24:MI') AS "shift_end!",
            COALESCE(a.ot_type IS NOT NULL, false) AS "is_overtime!"
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates st ON st.id = ss.shift_template_id
        JOIN users u ON u.id = a.user_id
        WHERE u.org_id = $1
          AND a.cancelled_at IS NULL
          AND u.is_active = true
          AND (
            -- Regular shifts on this date
            (ss.date = $2 AND NOT st.crosses_midnight
             AND CAST(EXTRACT(HOUR FROM st.start_time) * 60 + EXTRACT(MINUTE FROM st.start_time) AS INTEGER) < $4
             AND CAST(EXTRACT(HOUR FROM st.end_time) * 60 + EXTRACT(MINUTE FROM st.end_time) AS INTEGER) > $3)
            OR
            -- Regular shifts on this date that cross midnight (start before midnight)
            (ss.date = $2 AND st.crosses_midnight
             AND $3 < 1440
             AND $4 > CAST(EXTRACT(HOUR FROM st.start_time) * 60 + EXTRACT(MINUTE FROM st.start_time) AS INTEGER))
            OR
            -- Overnight shifts from previous date (end portion covering early morning blocks)
            (ss.date = $5 AND st.crosses_midnight
             AND $4 > 0
             AND $3 < CAST(EXTRACT(HOUR FROM st.end_time) * 60 + EXTRACT(MINUTE FROM st.end_time) AS INTEGER))
          )
        ORDER BY u.id, a.created_at DESC
        "#,
        auth.org_id,
        date,
        block_start_mins,
        block_end_mins,
        prev_date,
    )
    .fetch_all(&pool)
    .await?;

    // 3. Filter by classification if position requires one
    let mut candidates: Vec<OnShiftEmployee> = if let Some(class_id) = position.classification_id {
        let user_class_ids: HashSet<Uuid> = sqlx::query_scalar!(
            "SELECT id FROM users WHERE org_id = $1 AND classification_id = $2 AND is_active = true",
            auth.org_id,
            class_id,
        )
        .fetch_all(&pool)
        .await?
        .into_iter()
        .collect();

        on_shift_employees
            .into_iter()
            .filter(|e| user_class_ids.contains(&e.user_id))
            .collect()
    } else {
        on_shift_employees
    };

    // 4. Filter by qualifications
    if !required_qual_ids.is_empty() {
        let user_ids: Vec<Uuid> = candidates.iter().map(|e| e.user_id).collect();

        // Get users who have ALL required qualifications
        let qualified_users: HashSet<Uuid> = sqlx::query_scalar!(
            r#"
            SELECT uq.user_id
            FROM user_qualifications uq
            WHERE uq.user_id = ANY($1)
              AND uq.qualification_id = ANY($2)
            GROUP BY uq.user_id
            HAVING COUNT(DISTINCT uq.qualification_id) = $3
            "#,
            &user_ids,
            &required_qual_ids,
            required_qual_ids.len() as i64,
        )
        .fetch_all(&pool)
        .await?
        .into_iter()
        .collect();

        candidates.retain(|e| qualified_users.contains(&e.user_id));
    }

    // 5. Filter out employees on approved leave during this block
    let candidate_ids: Vec<Uuid> = candidates.iter().map(|e| e.user_id).collect();

    let on_leave_vec: Vec<Uuid> = sqlx::query_scalar!(
        r#"
        SELECT DISTINCT lr.user_id AS "user_id!"
        FROM leave_requests lr
        LEFT JOIN leave_request_lines lrl ON lrl.leave_request_id = lr.id
        WHERE lr.user_id = ANY($1)
          AND lr.status = 'approved'
          AND (
            -- Full-day leave covering this date
            (lr.start_date <= $2 AND lr.end_date >= $2 AND lrl.id IS NULL)
            OR
            -- Line-level leave on this date
            (lrl.date = $2 AND (
                lrl.start_time IS NULL
                OR (
                    CAST(EXTRACT(HOUR FROM lrl.start_time) * 60 + EXTRACT(MINUTE FROM lrl.start_time) AS INTEGER) < $4
                    AND CAST(EXTRACT(HOUR FROM lrl.end_time) * 60 + EXTRACT(MINUTE FROM lrl.end_time) AS INTEGER) > $3
                )
            ))
          )
        "#,
        &candidate_ids,
        date,
        block_start_mins,
        block_end_mins,
    )
    .fetch_all(&pool)
    .await?;

    let on_leave: HashSet<Uuid> = on_leave_vec.into_iter().collect();

    candidates.retain(|e| !on_leave.contains(&e.user_id));

    // 6. Get existing duty assignments for this block (to show who's already assigned elsewhere)
    let assigned_elsewhere: HashMap<Uuid, String> = sqlx::query!(
        r#"
        SELECT da.user_id, dp.name AS position_name
        FROM duty_assignments da
        JOIN duty_positions dp ON dp.id = da.duty_position_id
        WHERE da.org_id = $1
          AND da.date = $2
          AND da.block_index = $3
          AND da.status = 'assigned'
          AND da.user_id IS NOT NULL
        "#,
        auth.org_id,
        date,
        params.block_index,
    )
    .fetch_all(&pool)
    .await?
    .into_iter()
    .filter_map(|r| r.user_id.map(|uid| (uid, r.position_name)))
    .collect();

    // 7. Get console hours for this position this month (for fairness sorting)
    let month_start = date.replace_day(1).unwrap_or(date);
    let month_end = date;

    let console_hours: HashMap<Uuid, i64> = sqlx::query!(
        r#"
        SELECT user_id, COUNT(*) AS "hours!"
        FROM duty_assignments
        WHERE org_id = $1
          AND duty_position_id = $2
          AND date BETWEEN $3 AND $4
          AND status = 'assigned'
          AND user_id IS NOT NULL
        GROUP BY user_id
        "#,
        auth.org_id,
        params.duty_position_id,
        month_start,
        month_end,
    )
    .fetch_all(&pool)
    .await?
    .into_iter()
    .filter_map(|r| r.user_id.map(|uid| (uid, r.hours)))
    .collect();

    // 8. Build response, sorted by console hours ascending (fewest first = fairest pick)
    let mut result: Vec<AvailableEmployee> = candidates
        .into_iter()
        .map(|e| {
            let hours = console_hours.get(&e.user_id).copied().unwrap_or(0);
            AvailableEmployee {
                user_id: e.user_id,
                first_name: e.first_name,
                last_name: e.last_name,
                shift_name: e.shift_name,
                shift_start: e.shift_start,
                shift_end: e.shift_end,
                is_overtime: e.is_overtime,
                console_hours_this_month: (hours * 2) as f64, // each block = 2 hours
                already_assigned_position: assigned_elsewhere.get(&e.user_id).cloned(),
            }
        })
        .collect();

    result.sort_by(|a, b| {
        a.console_hours_this_month
            .partial_cmp(&b.console_hours_this_month)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.last_name.cmp(&b.last_name))
            .then_with(|| a.first_name.cmp(&b.first_name))
    });

    Ok(Json(result))
}

// ============================================================
// GET /api/duty-board/console-hours — Console hours report
// ============================================================

pub async fn console_hours(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<ConsoleHoursQuery>,
) -> Result<Json<Vec<ConsoleHoursEntry>>> {
    validate_date_range(params.start_date, params.end_date, Some(366))?;

    let entries = sqlx::query_as!(
        ConsoleHoursEntry,
        r#"
        SELECT
            da.user_id AS "user_id!",
            u.first_name AS "first_name!",
            u.last_name AS "last_name!",
            dp.id AS "position_id!",
            dp.name AS "position_name!",
            COUNT(*) * 2 AS "hours!"
        FROM duty_assignments da
        JOIN duty_positions dp ON dp.id = da.duty_position_id
        JOIN users u ON u.id = da.user_id
        WHERE da.org_id = $1
          AND da.date BETWEEN $2 AND $3
          AND da.status = 'assigned'
          AND da.user_id IS NOT NULL
        GROUP BY da.user_id, u.first_name, u.last_name, dp.id, dp.name
        ORDER BY u.last_name, u.first_name, dp.name
        "#,
        auth.org_id,
        params.start_date,
        params.end_date,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(entries))
}
