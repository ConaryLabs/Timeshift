use std::collections::HashSet;

use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::vacation_bid::{
        CreateVacationBidPeriodRequest, OpenVacationBiddingRequest, SubmitVacationBidRequest,
        VacationBid, VacationBidPeriod, VacationBidPeriodQuery, VacationBidWindow,
        VacationWindowDetail,
    },
};

pub async fn list_periods(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<VacationBidPeriodQuery>,
) -> Result<Json<Vec<VacationBidPeriod>>> {
    let rows = sqlx::query_as!(
        VacationBidPeriod,
        r#"
        SELECT id, org_id, year, round, status,
               opens_at, closes_at, created_at
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
        INSERT INTO vacation_bid_periods (id, org_id, year, round)
        VALUES ($1, $2, $3, $4)
        RETURNING id, org_id, year, round, status,
                  opens_at, closes_at, created_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        body.year,
        body.round,
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

    Ok(Json(serde_json::json!({ "ok": true })))
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

    // Verify period exists and belongs to org
    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM vacation_bid_periods WHERE id = $1 AND org_id = $2)",
        id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if !exists.unwrap_or(false) {
        return Err(AppError::NotFound("Vacation bid period not found".into()));
    }

    if body.window_duration_hours < 1 {
        return Err(AppError::BadRequest(
            "window_duration_hours must be at least 1".into(),
        ));
    }

    // Get all active users ordered by seniority
    let users = sqlx::query!(
        r#"
        SELECT id, first_name, last_name, seniority_date
        FROM users
        WHERE org_id = $1 AND is_active = true
        ORDER BY seniority_date ASC NULLS LAST, last_name, first_name
        "#,
        auth.org_id,
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
        let window_opens = start + duration * (rank - 1) as i32;
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
                  opens_at, closes_at, created_at
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
               p.year, p.round, p.org_id
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

    Ok(Json(VacationWindowDetail {
        window,
        round: w.round,
        bids,
        dates_taken: awarded_dates,
    }))
}

pub async fn submit_bid(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(window_id): Path<Uuid>,
    Json(body): Json<SubmitVacationBidRequest>,
) -> Result<Json<Vec<VacationBid>>> {
    // Fetch window and verify ownership
    let w = sqlx::query!(
        r#"
        SELECT w.id, w.user_id, w.opens_at, w.closes_at,
               p.round, p.org_id, p.status AS period_status
        FROM vacation_bid_windows w
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

    if w.user_id != auth.id {
        return Err(AppError::Forbidden);
    }

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

    for pick in &body.picks {
        if pick.end_date < pick.start_date {
            return Err(AppError::BadRequest(
                "end_date must be >= start_date for each pick".into(),
            ));
        }

        // Round 1: enforce full weeks (Monday-Sunday, 7 days)
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

    let mut tx = pool.begin().await?;

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
    let period_status = sqlx::query_scalar!(
        r#"
        SELECT status
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

    if period_status != "open" {
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

    // Find the "Vacation" leave type for the org
    let leave_type = sqlx::query!(
        r#"
        SELECT id FROM leave_types
        WHERE org_id = $1 AND code = 'VAC' AND is_active = true
        "#,
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    let leave_type_id = leave_type.map(|lt| lt.id);

    // Track all awarded dates across all windows to detect conflicts
    let mut awarded_dates: HashSet<time::Date> = HashSet::new();

    // Process each window in seniority order
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
            // Check if any date in this bid's range overlaps with already-awarded dates
            let mut has_conflict = false;
            let mut d = bid.start_date;
            while d <= bid.end_date {
                if awarded_dates.contains(&d) {
                    has_conflict = true;
                    break;
                }
                d = d.next_day().unwrap();
            }

            if has_conflict {
                continue; // Skip this bid, dates already taken
            }

            // Award the bid
            sqlx::query!(
                "UPDATE vacation_bids SET awarded = true WHERE id = $1",
                bid.id,
            )
            .execute(&mut *tx)
            .await?;

            // Add all dates in this bid's range to the awarded set
            let mut d = bid.start_date;
            while d <= bid.end_date {
                awarded_dates.insert(d);
                d = d.next_day().unwrap();
            }

            // Create approved leave request if we have a vacation leave type
            if let Some(lt_id) = leave_type_id {
                let days = (bid.end_date - bid.start_date).whole_days() + 1;
                let hours = (days as f64) * 8.0; // Assume 8-hour days

                sqlx::query!(
                    r#"
                    INSERT INTO leave_requests (id, user_id, leave_type_id, start_date, end_date, hours, reason, status, reviewed_by)
                    VALUES ($1, $2, $3, $4, $5, $6::FLOAT8::NUMERIC, 'Vacation bid award', 'approved', $7)
                    "#,
                    Uuid::new_v4(),
                    window.user_id,
                    lt_id,
                    bid.start_date,
                    bid.end_date,
                    hours,
                    auth.id,
                )
                .execute(&mut *tx)
                .await?;
            }
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
                  opens_at, closes_at, created_at
        "#,
        period_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(updated))
}
