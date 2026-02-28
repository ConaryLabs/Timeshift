use std::collections::HashMap;

use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    api::helpers::json_ok,
    api::notifications::{create_notification, CreateNotificationParams},
    auth::AuthUser,
    error::{AppError, Result},
    models::vacation_bid::{
        CreateVacationBidPeriodRequest, OpenVacationBiddingRequest, SubmitVacationBidRequest,
        VacationBid, VacationBidPeriod, VacationBidPeriodQuery, VacationBidWindow,
        VacationWindowDetail,
    },
};

// ---------------------------------------------------------------------------
// process_bids helpers
// ---------------------------------------------------------------------------

/// Check if any date in [start, end] would reach or exceed `max_concurrent` awarded vacations.
///
/// Returns `Ok(true)` if there is a conflict (bid should be skipped), `Ok(false)` otherwise.
/// Returns an error only if a date arithmetic overflow is encountered.
fn check_date_conflicts(
    awarded_dates: &HashMap<time::Date, u32>,
    start: time::Date,
    end: time::Date,
    max_concurrent: u32,
) -> Result<bool> {
    let mut d = start;
    while d <= end {
        let count = awarded_dates.get(&d).copied().unwrap_or(0);
        if count >= max_concurrent {
            return Ok(true);
        }
        d = d
            .next_day()
            .ok_or(AppError::BadRequest("Date range exceeds maximum date".into()))?;
    }
    Ok(false)
}

/// Increment the concurrent-vacation count for every date in [start, end].
///
/// Returns an error only if a date arithmetic overflow is encountered.
fn mark_awarded_dates(
    awarded_dates: &mut HashMap<time::Date, u32>,
    start: time::Date,
    end: time::Date,
) -> Result<()> {
    let mut d = start;
    while d <= end {
        *awarded_dates.entry(d).or_insert(0) += 1;
        d = d
            .next_day()
            .ok_or(AppError::BadRequest("Date range exceeds maximum date".into()))?;
    }
    Ok(())
}

/// Award a single vacation bid: mark it awarded, create an approved leave request,
/// and deduct the corresponding leave balance.
///
/// If `leave_type_id` is `None`, the leave request and balance deduction are skipped
/// (bid is still marked awarded).
async fn award_vacation_bid(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    bid_id: Uuid,
    start_date: time::Date,
    end_date: time::Date,
    user_id: Uuid,
    org_id: Uuid,
    reviewer_id: Uuid,
    leave_type_id: Option<Uuid>,
    hours_lookup: &Option<serde_json::Value>,
    org_timezone: &str,
    default_hours_per_day: f64,
) -> Result<()> {
    // Mark the bid as awarded
    sqlx::query!(
        "UPDATE vacation_bids SET awarded = true WHERE id = $1",
        bid_id,
    )
    .execute(&mut **tx)
    .await?;

    // Create approved leave request and deduct balance if a vacation leave type exists
    if let Some(lt_id) = leave_type_id {
        let hours = calculate_hours(start_date, end_date, hours_lookup, default_hours_per_day);
        let leave_request_id = Uuid::new_v4();

        sqlx::query!(
            r#"
            INSERT INTO leave_requests (id, user_id, org_id, leave_type_id, start_date, end_date, hours, reason, status, reviewed_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7::FLOAT8::NUMERIC, 'Vacation bid award', 'approved', $8)
            "#,
            leave_request_id,
            user_id,
            org_id,
            lt_id,
            start_date,
            end_date,
            hours,
            reviewer_id,
        )
        .execute(&mut **tx)
        .await?;

        // Deduct leave balance for the awarded vacation bid
        crate::services::leave::deduct_leave_balance(
            tx,
            org_id,
            user_id,
            lt_id,
            hours,
            leave_request_id,
            reviewer_id,
            org_timezone,
        )
        .await?;
    }

    Ok(())
}

pub async fn list_periods(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<VacationBidPeriodQuery>,
) -> Result<Json<Vec<VacationBidPeriod>>> {
    let rows = sqlx::query_as!(
        VacationBidPeriod,
        r#"
        SELECT id, org_id, year, round, status,
               opens_at, closes_at, created_at,
               allowance_hours, min_block_hours,
               bargaining_unit
        FROM vacation_bid_periods
        WHERE org_id = $1
          AND ($2::INT IS NULL OR year = $2)
        ORDER BY year DESC, round
        "#,
        auth.org_id,
        params.year,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create_period(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateVacationBidPeriodRequest>,
) -> Result<Json<VacationBidPeriod>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    if body.round != 1 && body.round != 2 {
        return Err(AppError::BadRequest("round must be 1 or 2".into()));
    }

    let row = sqlx::query_as!(
        VacationBidPeriod,
        r#"
        INSERT INTO vacation_bid_periods (id, org_id, year, round, allowance_hours, min_block_hours, bargaining_unit)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, org_id, year, round, status,
                  opens_at, closes_at, created_at,
                  allowance_hours, min_block_hours,
                  bargaining_unit
        "#,
        Uuid::new_v4(),
        auth.org_id,
        body.year,
        body.round,
        body.allowance_hours,
        body.min_block_hours,
        body.bargaining_unit.as_deref(),
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn delete_period(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let rows_affected = sqlx::query!(
        r#"
        DELETE FROM vacation_bid_periods
        WHERE id = $1 AND org_id = $2 AND status = 'draft'
        "#,
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(AppError::NotFound(
            "Period not found or not in draft status".into(),
        ));
    }

    Ok(json_ok())
}

/// POST /api/vacation-bids/periods/:id/cancel
/// Admin only. Cancels a vacation bid period in 'draft' or 'open' status.
pub async fn cancel_period(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<VacationBidPeriod>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let updated = sqlx::query_as!(
        VacationBidPeriod,
        r#"
        UPDATE vacation_bid_periods
        SET status = 'cancelled'
        WHERE id = $1 AND org_id = $2 AND status IN ('draft', 'open')
        RETURNING id, org_id, year, round, status,
                  opens_at, closes_at, created_at,
                  allowance_hours, min_block_hours,
                  bargaining_unit
        "#,
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(
        "Period not found or not in draft/open status".into(),
    ))?;

    Ok(Json(updated))
}

pub async fn open_bidding(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<OpenVacationBiddingRequest>,
) -> Result<Json<VacationBidPeriod>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Verify period exists and belongs to org, and fetch bargaining_unit
    let period = sqlx::query!(
        "SELECT id, bargaining_unit AS \"bargaining_unit?\" FROM vacation_bid_periods WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Vacation bid period not found".into()))?;

    if body.window_duration_hours < 1 {
        return Err(AppError::BadRequest(
            "window_duration_hours must be at least 1".into(),
        ));
    }

    if body.window_duration_hours > 168 {
        return Err(AppError::BadRequest(
            "window_duration_hours must not exceed 168 (1 week)".into(),
        ));
    }

    // CBA: Bidding windows are assigned in strict seniority order — most senior employee
    // bids first. Each window is sequential so senior employees' picks take precedence.
    let users = sqlx::query!(
        r#"
        SELECT u.id, u.first_name, u.last_name
        FROM users u
        LEFT JOIN seniority_records sr ON sr.user_id = u.id
        WHERE u.org_id = $1
          AND u.is_active = true
          AND ($2::TEXT IS NULL OR u.bargaining_unit = $2)
        ORDER BY sr.overall_seniority_date ASC NULLS LAST, u.last_name, u.first_name
        "#,
        auth.org_id,
        period.bargaining_unit,
    )
    .fetch_all(&pool)
    .await?;

    if users.is_empty() {
        return Err(AppError::BadRequest(
            "No active users in organization".into(),
        ));
    }

    // Parse start_at or default to now
    let start = if let Some(ref s) = body.start_at {
        OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339)
            .map_err(|_| AppError::BadRequest("Invalid start_at format (use RFC3339)".into()))?
    } else {
        OffsetDateTime::now_utc()
    };

    let duration = time::Duration::hours(body.window_duration_hours);

    let mut tx = pool.begin().await?;

    // Check period is in draft status inside transaction with FOR UPDATE
    let current_status = sqlx::query_scalar!(
        r#"
        SELECT status
        FROM vacation_bid_periods
        WHERE id = $1
        FOR UPDATE
        "#,
        id,
    )
    .fetch_one(&mut *tx)
    .await?;

    if current_status != "draft" {
        return Err(AppError::BadRequest(
            "Period must be in draft status to open bidding".into(),
        ));
    }

    // Delete any existing windows (in case of re-open)
    sqlx::query!(
        "DELETE FROM vacation_bid_windows WHERE vacation_bid_period_id = $1",
        id,
    )
    .execute(&mut *tx)
    .await?;

    // Create windows for each user
    for (rank, user) in users.iter().enumerate() {
        let rank = (rank as i32) + 1;
        let window_opens = start + duration * (rank - 1);
        let window_closes = window_opens + duration;

        sqlx::query!(
            r#"
            INSERT INTO vacation_bid_windows (id, vacation_bid_period_id, user_id, seniority_rank, opens_at, closes_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            Uuid::new_v4(),
            id,
            user.id,
            rank,
            window_opens,
            window_closes,
        )
        .execute(&mut *tx)
        .await?;
    }

    // Calculate overall period window
    let period_opens = start;
    let period_closes = start + duration * users.len() as i32;

    // Update period status to open
    let updated = sqlx::query_as!(
        VacationBidPeriod,
        r#"
        UPDATE vacation_bid_periods
        SET status = 'open', opens_at = $2, closes_at = $3
        WHERE id = $1
        RETURNING id, org_id, year, round, status,
                  opens_at, closes_at, created_at,
                  allowance_hours, min_block_hours,
                  bargaining_unit
        "#,
        id,
        period_opens,
        period_closes,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(updated))
}

pub async fn list_windows(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(period_id): Path<Uuid>,
) -> Result<Json<Vec<VacationBidWindow>>> {
    // Verify period belongs to org
    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM vacation_bid_periods WHERE id = $1 AND org_id = $2)",
        period_id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !exists.unwrap_or(false) {
        return Err(AppError::NotFound("Vacation bid period not found".into()));
    }

    let is_admin = auth.role.can_manage_schedule();

    let rows = sqlx::query!(
        r#"
        SELECT w.id, w.vacation_bid_period_id, w.user_id,
               u.first_name, u.last_name,
               w.seniority_rank, w.opens_at, w.closes_at, w.submitted_at
        FROM vacation_bid_windows w
        JOIN users u ON u.id = w.user_id
        WHERE w.vacation_bid_period_id = $1
          AND ($2 OR w.user_id = $3)
        ORDER BY w.seniority_rank
        "#,
        period_id,
        is_admin,
        auth.id,
    )
    .fetch_all(&pool)
    .await?;

    let windows = rows
        .into_iter()
        .map(|r| VacationBidWindow {
            id: r.id,
            vacation_bid_period_id: r.vacation_bid_period_id,
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            seniority_rank: r.seniority_rank,
            opens_at: r.opens_at,
            closes_at: r.closes_at,
            submitted_at: r.submitted_at,
        })
        .collect();

    Ok(Json(windows))
}

pub async fn get_window(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(window_id): Path<Uuid>,
) -> Result<Json<VacationWindowDetail>> {
    // Fetch window with user info
    let w = sqlx::query!(
        r#"
        SELECT w.id, w.vacation_bid_period_id, w.user_id,
               u.first_name, u.last_name,
               w.seniority_rank, w.opens_at, w.closes_at, w.submitted_at,
               p.year, p.round, p.org_id, p.allowance_hours, p.min_block_hours
        FROM vacation_bid_windows w
        JOIN users u ON u.id = w.user_id
        JOIN vacation_bid_periods p ON p.id = w.vacation_bid_period_id
        WHERE w.id = $1
        "#,
        window_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Vacation bid window not found".into()))?;

    if w.org_id != auth.org_id {
        return Err(AppError::NotFound("Vacation bid window not found".into()));
    }

    // Non-manager can only see own window
    if !auth.role.can_manage_schedule() && w.user_id != auth.id {
        return Err(AppError::Forbidden);
    }

    // Get bids for this window
    let bids = sqlx::query_as!(
        VacationBid,
        r#"
        SELECT id, vacation_bid_window_id, start_date, end_date,
               preference_rank, awarded, created_at
        FROM vacation_bids
        WHERE vacation_bid_window_id = $1
        ORDER BY preference_rank
        "#,
        window_id,
    )
    .fetch_all(&pool)
    .await?;

    // Get all awarded dates for the year (from earlier seniority windows)
    let awarded_dates = sqlx::query_scalar!(
        r#"
        SELECT DISTINCT d::DATE AS "date!"
        FROM vacation_bids vb
        JOIN vacation_bid_windows vw ON vw.id = vb.vacation_bid_window_id
        JOIN vacation_bid_periods vp ON vp.id = vw.vacation_bid_period_id
        CROSS JOIN generate_series(vb.start_date, vb.end_date, '1 day'::interval) AS d
        WHERE vp.org_id = $1
          AND vp.year = $2
          AND vb.awarded = true
          AND vw.id != $3
        ORDER BY "date!"
        "#,
        auth.org_id,
        w.year,
        window_id,
    )
    .fetch_all(&pool)
    .await?;

    let window = VacationBidWindow {
        id: w.id,
        vacation_bid_period_id: w.vacation_bid_period_id,
        user_id: w.user_id,
        first_name: w.first_name,
        last_name: w.last_name,
        seniority_rank: w.seniority_rank,
        opens_at: w.opens_at,
        closes_at: w.closes_at,
        submitted_at: w.submitted_at,
    };

    // Fetch non-linear hours lookup so hours_used matches what process_bids will charge
    let hours_lookup: Option<serde_json::Value> = sqlx::query_scalar!(
        "SELECT value FROM org_settings WHERE org_id = $1 AND key = 'vacation_hours_charged_sep_feb'",
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?;

    let default_hours_per_day = crate::services::org_settings::get_i64(
        &pool, auth.org_id, "default_hours_per_vacation_day", 8,
    ).await as f64;

    let hours_used: f64 = bids
        .iter()
        .map(|b| calculate_hours(b.start_date, b.end_date, &hours_lookup, default_hours_per_day))
        .sum();

    Ok(Json(VacationWindowDetail {
        window,
        round: w.round,
        year: w.year,
        bids,
        dates_taken: awarded_dates,
        allowance_hours: w.allowance_hours,
        min_block_hours: w.min_block_hours,
        hours_used,
    }))
}

pub async fn submit_bid(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(window_id): Path<Uuid>,
    Json(body): Json<SubmitVacationBidRequest>,
) -> Result<Json<Vec<VacationBid>>> {
    let mut tx = pool.begin().await?;

    // Fetch window with FOR UPDATE to prevent concurrent bid submissions
    let w = sqlx::query!(
        r#"
        SELECT w.id, w.user_id, w.opens_at, w.closes_at,
               p.round, p.org_id, p.status AS period_status,
               p.allowance_hours, p.min_block_hours
        FROM vacation_bid_windows w
        JOIN vacation_bid_periods p ON p.id = w.vacation_bid_period_id
        WHERE w.id = $1
        FOR UPDATE OF w
        "#,
        window_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Vacation bid window not found".into()))?;

    if w.org_id != auth.org_id {
        return Err(AppError::NotFound("Vacation bid window not found".into()));
    }

    if w.user_id != auth.id {
        return Err(AppError::Forbidden);
    }

    // Fetch non-linear hours lookup so validation matches what process_bids will charge
    let hours_lookup: Option<serde_json::Value> = sqlx::query_scalar!(
        "SELECT value FROM org_settings WHERE org_id = $1 AND key = 'vacation_hours_charged_sep_feb'",
        w.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    let default_hours_per_day = crate::services::org_settings::get_i64(
        &pool, w.org_id, "default_hours_per_vacation_day", 8,
    ).await as f64;

    if w.period_status != "open" {
        return Err(AppError::BadRequest("Bidding period is not open".into()));
    }

    // Check window timing
    let now = OffsetDateTime::now_utc();
    if now < w.opens_at {
        return Err(AppError::BadRequest(
            "Your bidding window has not opened yet".into(),
        ));
    }
    if now > w.closes_at {
        return Err(AppError::BadRequest(
            "Your bidding window has closed".into(),
        ));
    }

    // Validate picks
    if body.picks.is_empty() {
        return Err(AppError::BadRequest("At least one pick is required".into()));
    }

    if body.picks.len() > 20 {
        return Err(AppError::BadRequest(
            "Maximum 20 vacation picks allowed".into(),
        ));
    }

    for pick in &body.picks {
        if pick.end_date < pick.start_date {
            return Err(AppError::BadRequest(
                "end_date must be >= start_date for each pick".into(),
            ));
        }

        // CBA: Round 1 vacation bids must be full weeks (Monday-Sunday).
        // Round 2 allows single-day or partial-week picks.
        if w.round == 1 {
            let start_weekday = pick.start_date.weekday();
            let end_weekday = pick.end_date.weekday();
            let days = (pick.end_date - pick.start_date).whole_days() + 1;

            if start_weekday != time::Weekday::Monday {
                return Err(AppError::BadRequest(
                    "Round 1 picks must start on Monday".into(),
                ));
            }
            if end_weekday != time::Weekday::Sunday {
                return Err(AppError::BadRequest(
                    "Round 1 picks must end on Sunday".into(),
                ));
            }
            if days % 7 != 0 {
                return Err(AppError::BadRequest(
                    "Round 1 picks must be full weeks (7 days)".into(),
                ));
            }
        }
    }

    // Enforce min_block_hours: each pick must cover at least min_block_hours.
    // Uses calculate_hours for consistency with process_bids (non-linear Sep-Feb table).
    if let Some(min_block) = w.min_block_hours {
        for pick in &body.picks {
            let hours = calculate_hours(pick.start_date, pick.end_date, &hours_lookup, default_hours_per_day);
            if hours < min_block as f64 {
                return Err(AppError::BadRequest(format!(
                    "Each vacation block must be at least {} hours; got {:.0} hours",
                    min_block, hours,
                )));
            }
        }
    }

    // Enforce allowance_hours: total hours across all picks must not exceed the limit.
    // Uses calculate_hours for consistency with process_bids.
    if let Some(allowance) = w.allowance_hours {
        let total_hours: f64 = body
            .picks
            .iter()
            .map(|p| calculate_hours(p.start_date, p.end_date, &hours_lookup, default_hours_per_day))
            .sum();
        if total_hours > allowance as f64 {
            return Err(AppError::BadRequest(format!(
                "Total vacation hours ({:.0}) exceeds round allowance of {} hours",
                total_hours, allowance,
            )));
        }
    }

    // Validate ranks are sequential starting from 1
    let mut ranks: Vec<i32> = body.picks.iter().map(|p| p.preference_rank).collect();
    ranks.sort();
    for (i, rank) in ranks.iter().enumerate() {
        if *rank != (i as i32 + 1) {
            return Err(AppError::BadRequest(
                "Preference ranks must be sequential starting from 1".into(),
            ));
        }
    }

    // Delete previous submissions
    sqlx::query!(
        "DELETE FROM vacation_bids WHERE vacation_bid_window_id = $1",
        window_id,
    )
    .execute(&mut *tx)
    .await?;

    // Insert new picks
    for pick in &body.picks {
        sqlx::query!(
            r#"
            INSERT INTO vacation_bids (id, vacation_bid_window_id, start_date, end_date, preference_rank)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            Uuid::new_v4(),
            window_id,
            pick.start_date,
            pick.end_date,
            pick.preference_rank,
        )
        .execute(&mut *tx)
        .await?;
    }

    // Set submitted_at
    sqlx::query!(
        "UPDATE vacation_bid_windows SET submitted_at = NOW() WHERE id = $1",
        window_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Return the saved bids
    let bids = sqlx::query_as!(
        VacationBid,
        r#"
        SELECT id, vacation_bid_window_id, start_date, end_date,
               preference_rank, awarded, created_at
        FROM vacation_bids
        WHERE vacation_bid_window_id = $1
        ORDER BY preference_rank
        "#,
        window_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(bids))
}

pub async fn process_bids(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(period_id): Path<Uuid>,
) -> Result<Json<VacationBidPeriod>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let mut tx = pool.begin().await?;

    // Lock period row inside transaction to prevent concurrent processing
    let period = sqlx::query!(
        r#"
        SELECT status, year
        FROM vacation_bid_periods
        WHERE id = $1 AND org_id = $2
        FOR UPDATE
        "#,
        period_id,
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Vacation bid period not found".into()))?;

    if period.status != "open" {
        return Err(AppError::BadRequest(
            "Period must be in open status to process bids".into(),
        ));
    }

    // Get all windows in seniority order
    let windows = sqlx::query!(
        r#"
        SELECT w.id, w.user_id
        FROM vacation_bid_windows w
        WHERE w.vacation_bid_period_id = $1
        ORDER BY w.seniority_rank
        "#,
        period_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    // Find the vacation leave type for the org by category (not hardcoded code)
    let leave_type = sqlx::query!(
        r#"
        SELECT id FROM leave_types
        WHERE org_id = $1 AND category = 'vacation' AND is_active = true
        LIMIT 1
        "#,
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    let leave_type_id = leave_type.map(|lt| lt.id);

    // Fetch non-linear hours lookup from org_settings (for Sep-Feb vacation periods)
    let hours_lookup: Option<serde_json::Value> = sqlx::query_scalar!(
        "SELECT value FROM org_settings WHERE org_id = $1 AND key = 'vacation_hours_charged_sep_feb'",
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    let default_hours_per_day = crate::services::org_settings::get_i64(
        &pool, auth.org_id, "default_hours_per_vacation_day", 8,
    ).await as f64;

    // CBA: Pre-seed with dates already awarded in earlier rounds of the same year so that
    // round 2 cannot double-book dates already granted in round 1 (seniority-based protection).
    let prior_dates: Vec<time::Date> = sqlx::query_scalar!(
        r#"
        SELECT DISTINCT d::DATE AS "date!"
        FROM vacation_bids vb
        JOIN vacation_bid_windows vw ON vw.id = vb.vacation_bid_window_id
        JOIN vacation_bid_periods vp ON vp.id = vw.vacation_bid_period_id
        CROSS JOIN generate_series(vb.start_date, vb.end_date, '1 day'::interval) AS d
        WHERE vp.org_id = $1
          AND vp.year = $2
          AND vp.id != $3
          AND vb.awarded = true
        "#,
        auth.org_id,
        period.year,
        period_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    let mut awarded_dates: HashMap<time::Date, u32> = HashMap::new();
    for d in prior_dates {
        *awarded_dates.entry(d).or_insert(0) += 1;
    }

    // Max concurrent vacations per date — configurable via org_settings, default 3
    let max_concurrent_val: Option<serde_json::Value> = sqlx::query_scalar!(
        "SELECT value FROM org_settings WHERE org_id = $1 AND key = 'max_concurrent_vacation'",
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?;
    let max_concurrent: u32 = max_concurrent_val
        .and_then(|v| v.as_u64().map(|n| n as u32))
        .unwrap_or(3);

    // Collect notifications to send after transaction commits
    struct PendingNotification {
        user_id: Uuid,
        message: String,
    }
    let mut pending_notifications: Vec<PendingNotification> = Vec::new();

    // CBA: Process bids in seniority order — most senior employee's picks are awarded
    // first. If dates conflict (concurrent count >= max_concurrent_vacation), the bid is
    // skipped (not awarded). Leave balance is checked before awarding to prevent overdraft.
    for window in &windows {
        // Get bids ordered by preference
        let bids = sqlx::query!(
            r#"
            SELECT id, start_date, end_date, preference_rank
            FROM vacation_bids
            WHERE vacation_bid_window_id = $1
            ORDER BY preference_rank
            "#,
            window.id,
        )
        .fetch_all(&mut *tx)
        .await?;

        for bid in &bids {
            // Check if any date in this bid's range would exceed concurrent vacation limit
            if check_date_conflicts(&awarded_dates, bid.start_date, bid.end_date, max_concurrent)? {
                continue; // Skip this bid, dates already taken
            }

            // Check leave balance BEFORE awarding — if insufficient, skip
            // without marking the bid as awarded or blocking the dates.
            if let Some(lt_id) = leave_type_id {
                let hours = calculate_hours(bid.start_date, bid.end_date, &hours_lookup, default_hours_per_day);

                // Verify sufficient balance before awarding (FOR UPDATE to prevent
                // concurrent modifications from causing negative balances).
                let balance: f64 = sqlx::query_scalar!(
                    r#"
                    SELECT COALESCE(SUM(locked.bal), 0.0) AS "total!"
                    FROM (
                        SELECT CAST(lb.balance_hours AS FLOAT8) AS bal
                        FROM leave_balances lb
                        WHERE lb.user_id = $1 AND lb.org_id = $2 AND lb.leave_type_id = $3
                        FOR UPDATE OF lb
                    ) locked
                    "#,
                    window.user_id,
                    auth.org_id,
                    lt_id,
                )
                .fetch_one(&mut *tx)
                .await?;

                if balance < hours {
                    tracing::warn!(
                        "Skipping vacation bid for user {} — insufficient balance ({:.1} hrs available, {:.1} needed)",
                        window.user_id, balance, hours
                    );
                    // Notify employee their bid was skipped due to insufficient balance
                    pending_notifications.push(PendingNotification {
                        user_id: window.user_id,
                        message: format!(
                            "Your vacation bid for {} to {} was not awarded due to insufficient leave balance",
                            bid.start_date, bid.end_date
                        ),
                    });
                    continue;
                }
            }

            // Award the bid, create leave request, and deduct balance
            award_vacation_bid(
                &mut tx,
                bid.id,
                bid.start_date,
                bid.end_date,
                window.user_id,
                auth.org_id,
                auth.id,
                leave_type_id,
                &hours_lookup,
                &auth.org_timezone,
                default_hours_per_day,
            )
            .await?;

            // Increment concurrent count for all dates in this bid's range
            mark_awarded_dates(&mut awarded_dates, bid.start_date, bid.end_date)?;
        }
    }

    // Set period to completed
    let updated = sqlx::query_as!(
        VacationBidPeriod,
        r#"
        UPDATE vacation_bid_periods
        SET status = 'completed'
        WHERE id = $1
        RETURNING id, org_id, year, round, status,
                  opens_at, closes_at, created_at,
                  allowance_hours, min_block_hours,
                  bargaining_unit
        "#,
        period_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Send notifications after transaction commits (best-effort)
    for notif in &pending_notifications {
        let _ = create_notification(
            &pool,
            CreateNotificationParams {
                org_id: auth.org_id,
                user_id: notif.user_id,
                notification_type: "vacation_bid_skipped",
                title: "Vacation bid not awarded",
                message: &notif.message,
                link: Some("/vacation-bids"),
                source_type: Some("vacation_bid_period"),
                source_id: Some(period_id),
            },
        )
        .await;
    }

    Ok(Json(updated))
}

/// Calculate hours charged for a vacation bid.
/// For Sep-Feb months, uses a non-linear lookup table from org_settings if available.
/// Falls back to flat 8 hours/day.
///
/// CBA compliance: when a bid straddles month boundaries (e.g., Jan 28 - Feb 3),
/// each month segment is calculated independently so that the correct rate table
/// applies to each portion. This prevents under/over-charging when months have
/// different Sep-Feb vs Mar-Aug rates.
fn calculate_hours(
    start_date: time::Date,
    end_date: time::Date,
    lookup: &Option<serde_json::Value>,
    default_hours_per_day: f64,
) -> f64 {
    // If the bid is within a single month, use the simple path
    if start_date.month() == end_date.month() && start_date.year() == end_date.year() {
        return calculate_hours_single_month(start_date, end_date, lookup, default_hours_per_day);
    }

    // Split across month boundaries and sum each segment
    let mut total = 0.0;
    let mut seg_start = start_date;
    while seg_start <= end_date {
        // End of current month
        let days_in_month = seg_start.month().length(seg_start.year());
        let month_end = time::Date::from_calendar_date(
            seg_start.year(),
            seg_start.month(),
            days_in_month,
        )
        .unwrap_or(seg_start);
        let seg_end = if month_end < end_date {
            month_end
        } else {
            end_date
        };

        total += calculate_hours_single_month(seg_start, seg_end, lookup, default_hours_per_day);

        // If we've reached or passed end_date, we're done
        if seg_end >= end_date {
            break;
        }

        // Advance to first day of next month
        seg_start = match seg_end.next_day() {
            Some(d) => d,
            None => break,
        };
    }
    total
}

/// Calculate hours for a date range within a single month.
fn calculate_hours_single_month(
    start_date: time::Date,
    end_date: time::Date,
    lookup: &Option<serde_json::Value>,
    default_hours_per_day: f64,
) -> f64 {
    let days = (end_date - start_date).whole_days() + 1;

    let month = start_date.month() as u8;
    let is_sep_feb = month >= 9 || month <= 2;

    if is_sep_feb {
        if let Some(table) = lookup {
            if let Some(entries) = table.as_array() {
                for entry in entries {
                    let min_days = entry.get("min_days").and_then(|v| v.as_i64()).unwrap_or(0);
                    let max_days = entry.get("max_days").and_then(|v| v.as_i64()).unwrap_or(0);

                    if days >= min_days && days <= max_days {
                        if let Some(flat_hours) = entry.get("hours").and_then(|v| v.as_f64()) {
                            return flat_hours;
                        }
                        if let Some(hpd) = entry.get("hours_per_day").and_then(|v| v.as_f64()) {
                            return days as f64 * hpd;
                        }
                    }
                }
            }
        }
    }

    days as f64 * default_hours_per_day
}
