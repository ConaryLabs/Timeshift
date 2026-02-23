use axum::{
    extract::{Path, State},
    Json,
};
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::bidding::{
        AvailableSlot, BidPeriodStatus, BidSubmissionView, BidWindow, BidWindowDetail,
        BidWindowRow, OpenBiddingRequest, SubmitBidRequest,
    },
    org_guard,
};

/// POST /api/schedule/periods/:id/open-bidding
/// Admin only. Generates bid_windows ordered by seniority.
pub async fn open_bidding(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(period_id): Path<Uuid>,
    Json(req): Json<OpenBiddingRequest>,
) -> Result<Json<Vec<BidWindow>>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_period(&pool, period_id, auth.org_id).await?;

    if req.window_duration_hours < 1 {
        return Err(AppError::BadRequest(
            "window_duration_hours must be at least 1".into(),
        ));
    }

    // Parse start_at or default to now
    let start_at = if let Some(ref s) = req.start_at {
        OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339)
            .map_err(|_| AppError::BadRequest("Invalid start_at timestamp".into()))?
    } else {
        OffsetDateTime::now_utc()
    };

    let duration = time::Duration::hours(req.window_duration_hours);

    // Get all active users ordered by seniority_date (most senior first, nulls last)
    let users = sqlx::query!(
        r#"
        SELECT id, first_name, last_name
        FROM users
        WHERE org_id = $1 AND is_active = true
        ORDER BY seniority_date ASC NULLS LAST, last_name, first_name
        "#,
        auth.org_id
    )
    .fetch_all(&pool)
    .await?;

    if users.is_empty() {
        return Err(AppError::BadRequest("No active users found".into()));
    }

    let mut tx = pool.begin().await?;

    // Check period is in draft status inside transaction with FOR UPDATE
    let current_status = sqlx::query_scalar!(
        r#"SELECT status AS "status: BidPeriodStatus" FROM schedule_periods WHERE id = $1 FOR UPDATE"#,
        period_id
    )
    .fetch_one(&mut *tx)
    .await?;

    if current_status != BidPeriodStatus::Draft {
        return Err(AppError::BadRequest(
            "Bidding can only be opened for periods in 'draft' status".into(),
        ));
    }

    // Delete any existing bid windows for this period (re-open scenario shouldn't happen
    // since we check for draft, but be safe)
    sqlx::query!("DELETE FROM bid_windows WHERE period_id = $1", period_id)
        .execute(&mut *tx)
        .await?;

    let mut windows = Vec::new();

    for (i, user) in users.iter().enumerate() {
        let rank = (i + 1) as i32;
        let opens = start_at + duration * i as u32;
        let closes = opens + duration;

        let row = sqlx::query_as!(
            BidWindowRow,
            r#"
            INSERT INTO bid_windows (id, period_id, user_id, seniority_rank, opens_at, closes_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, period_id, user_id,
                      $7::text AS "first_name!",
                      $8::text AS "last_name!",
                      seniority_rank, opens_at, closes_at, submitted_at
            "#,
            Uuid::new_v4(),
            period_id,
            user.id,
            rank,
            opens,
            closes,
            user.first_name,
            user.last_name,
        )
        .fetch_one(&mut *tx)
        .await?;

        windows.push(BidWindow {
            id: row.id,
            period_id: row.period_id,
            user_id: row.user_id,
            first_name: row.first_name,
            last_name: row.last_name,
            seniority_rank: row.seniority_rank,
            opens_at: row.opens_at,
            closes_at: row.closes_at,
            submitted_at: row.submitted_at,
        });
    }

    // Calculate overall bid period open/close times
    let bid_opens_at = start_at;
    let bid_closes_at = start_at + duration * users.len() as u32;

    // Update period status to 'open'
    sqlx::query!(
        r#"
        UPDATE schedule_periods
        SET status = 'open', bid_opens_at = $2, bid_closes_at = $3
        WHERE id = $1
        "#,
        period_id,
        bid_opens_at,
        bid_closes_at,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(windows))
}

/// GET /api/schedule/periods/:id/bid-windows
/// List windows for a period. Admin/supervisor sees all, employee sees only theirs.
pub async fn list_bid_windows(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(period_id): Path<Uuid>,
) -> Result<Json<Vec<BidWindow>>> {
    org_guard::verify_period(&pool, period_id, auth.org_id).await?;

    let rows = if auth.role.can_manage_schedule() {
        sqlx::query_as!(
            BidWindowRow,
            r#"
            SELECT bw.id, bw.period_id, bw.user_id,
                   u.first_name, u.last_name,
                   bw.seniority_rank, bw.opens_at, bw.closes_at, bw.submitted_at
            FROM bid_windows bw
            JOIN users u ON u.id = bw.user_id
            WHERE bw.period_id = $1
            ORDER BY bw.seniority_rank
            "#,
            period_id
        )
        .fetch_all(&pool)
        .await?
    } else {
        sqlx::query_as!(
            BidWindowRow,
            r#"
            SELECT bw.id, bw.period_id, bw.user_id,
                   u.first_name, u.last_name,
                   bw.seniority_rank, bw.opens_at, bw.closes_at, bw.submitted_at
            FROM bid_windows bw
            JOIN users u ON u.id = bw.user_id
            WHERE bw.period_id = $1 AND bw.user_id = $2
            ORDER BY bw.seniority_rank
            "#,
            period_id,
            auth.id
        )
        .fetch_all(&pool)
        .await?
    };

    let windows = rows
        .into_iter()
        .map(|r| BidWindow {
            id: r.id,
            period_id: r.period_id,
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

/// GET /api/bid-windows/:id
/// Get window detail with available slots and existing submissions.
pub async fn get_bid_window(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(window_id): Path<Uuid>,
) -> Result<Json<BidWindowDetail>> {
    // Fetch the window and verify org ownership
    let window_row = sqlx::query_as!(
        BidWindowRow,
        r#"
        SELECT bw.id, bw.period_id, bw.user_id,
               u.first_name, u.last_name,
               bw.seniority_rank, bw.opens_at, bw.closes_at, bw.submitted_at
        FROM bid_windows bw
        JOIN users u ON u.id = bw.user_id
        JOIN schedule_periods sp ON sp.id = bw.period_id
        WHERE bw.id = $1 AND sp.org_id = $2
        "#,
        window_id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Bid window not found".into()))?;

    // Only the window's user or admin/supervisor can view
    if window_row.user_id != auth.id && !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let window = BidWindow {
        id: window_row.id,
        period_id: window_row.period_id,
        user_id: window_row.user_id,
        first_name: window_row.first_name,
        last_name: window_row.last_name,
        seniority_rank: window_row.seniority_rank,
        opens_at: window_row.opens_at,
        closes_at: window_row.closes_at,
        submitted_at: window_row.submitted_at,
    };

    // Available slots: active slots for the org, marking ones already awarded
    let slots = sqlx::query!(
        r#"
        SELECT
            sl.id AS slot_id,
            t.name AS team_name,
            st.name AS shift_template_name,
            st.start_time,
            st.end_time,
            cl.name AS classification_name,
            cl.abbreviation AS classification_abbreviation,
            sl.days_of_week,
            sl.label,
            CASE WHEN sa.id IS NOT NULL THEN true ELSE false END AS "already_awarded!"
        FROM shift_slots sl
        JOIN teams t ON t.id = sl.team_id
        JOIN shift_templates st ON st.id = sl.shift_template_id
        JOIN classifications cl ON cl.id = sl.classification_id
        LEFT JOIN slot_assignments sa ON sa.slot_id = sl.id AND sa.period_id = $2
        WHERE t.org_id = $1
          AND t.is_active = true
          AND sl.is_active = true
        ORDER BY t.name, st.start_time, cl.abbreviation
        "#,
        auth.org_id,
        window.period_id,
    )
    .fetch_all(&pool)
    .await?;

    let available_slots: Vec<AvailableSlot> = slots
        .into_iter()
        .map(|s| AvailableSlot {
            slot_id: s.slot_id,
            team_name: s.team_name,
            shift_template_name: s.shift_template_name,
            start_time: s.start_time,
            end_time: s.end_time,
            classification_name: s.classification_name,
            classification_abbreviation: s.classification_abbreviation,
            days_of_week: s.days_of_week,
            label: s.label,
            already_awarded: s.already_awarded,
        })
        .collect();

    // Existing submissions for this window
    let subs = sqlx::query!(
        r#"
        SELECT
            bs.id,
            bs.slot_id,
            st.name AS shift_template_name,
            t.name AS team_name,
            cl.name AS classification_name,
            sl.days_of_week,
            bs.preference_rank,
            bs.awarded
        FROM bid_submissions bs
        JOIN shift_slots sl ON sl.id = bs.slot_id
        JOIN teams t ON t.id = sl.team_id
        JOIN shift_templates st ON st.id = sl.shift_template_id
        JOIN classifications cl ON cl.id = sl.classification_id
        WHERE bs.bid_window_id = $1
        ORDER BY bs.preference_rank
        "#,
        window_id
    )
    .fetch_all(&pool)
    .await?;

    let submissions: Vec<BidSubmissionView> = subs
        .into_iter()
        .map(|s| BidSubmissionView {
            id: s.id,
            slot_id: s.slot_id,
            shift_template_name: s.shift_template_name,
            team_name: s.team_name,
            classification_name: s.classification_name,
            days_of_week: s.days_of_week,
            preference_rank: s.preference_rank,
            awarded: s.awarded,
        })
        .collect();

    Ok(Json(BidWindowDetail {
        window,
        available_slots,
        submissions,
    }))
}

/// POST /api/bid-windows/:id/submit
/// Submit ranked preferences. Only the window's user can submit, only during open window.
pub async fn submit_bid(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(window_id): Path<Uuid>,
    Json(req): Json<SubmitBidRequest>,
) -> Result<Json<serde_json::Value>> {
    // Fetch window and verify ownership
    let window = sqlx::query!(
        r#"
        SELECT bw.id, bw.period_id, bw.user_id, bw.opens_at, bw.closes_at,
               sp.org_id
        FROM bid_windows bw
        JOIN schedule_periods sp ON sp.id = bw.period_id
        WHERE bw.id = $1
        "#,
        window_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Bid window not found".into()))?;

    if window.org_id != auth.org_id {
        return Err(AppError::NotFound("Bid window not found".into()));
    }

    if window.user_id != auth.id {
        return Err(AppError::Forbidden);
    }

    // Check window timing
    let now = OffsetDateTime::now_utc();
    if now < window.opens_at {
        return Err(AppError::BadRequest(
            "Your bid window has not opened yet".into(),
        ));
    }
    if now > window.closes_at {
        return Err(AppError::BadRequest("Your bid window has closed".into()));
    }

    // Validate preferences
    if req.preferences.is_empty() {
        return Err(AppError::BadRequest(
            "At least one preference is required".into(),
        ));
    }

    // Validate ranks are sequential starting from 1
    let mut ranks: Vec<i32> = req.preferences.iter().map(|p| p.preference_rank).collect();
    ranks.sort();
    for (i, rank) in ranks.iter().enumerate() {
        if *rank != (i as i32 + 1) {
            return Err(AppError::BadRequest(
                "Preference ranks must be sequential starting from 1".into(),
            ));
        }
    }

    // Check for duplicate slot_ids
    let mut slot_ids: Vec<Uuid> = req.preferences.iter().map(|p| p.slot_id).collect();
    slot_ids.sort();
    slot_ids.dedup();
    if slot_ids.len() != req.preferences.len() {
        return Err(AppError::BadRequest(
            "Duplicate slot_ids in preferences".into(),
        ));
    }

    // Verify all slot_ids exist and belong to org
    for pref in &req.preferences {
        org_guard::verify_slot(&pool, pref.slot_id, auth.org_id).await?;
    }

    let mut tx = pool.begin().await?;

    // Delete existing submissions (allow re-submission)
    sqlx::query!(
        "DELETE FROM bid_submissions WHERE bid_window_id = $1",
        window_id
    )
    .execute(&mut *tx)
    .await?;

    // Insert new submissions
    for pref in &req.preferences {
        sqlx::query!(
            r#"
            INSERT INTO bid_submissions (id, bid_window_id, slot_id, preference_rank)
            VALUES ($1, $2, $3, $4)
            "#,
            Uuid::new_v4(),
            window_id,
            pref.slot_id,
            pref.preference_rank,
        )
        .execute(&mut *tx)
        .await?;
    }

    // Set submitted_at
    sqlx::query!(
        "UPDATE bid_windows SET submitted_at = $2 WHERE id = $1",
        window_id,
        now,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(
        serde_json::json!({ "ok": true, "submitted_at": now.to_string() }),
    ))
}

/// POST /api/schedule/periods/:id/process-bids
/// Admin trigger to process all bids and create slot assignments.
pub async fn process_bids(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(period_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_period(&pool, period_id, auth.org_id).await?;

    let mut tx = pool.begin().await?;

    // Check period status inside transaction with FOR UPDATE to prevent concurrent processing
    let current_status = sqlx::query_scalar!(
        r#"SELECT status AS "status: BidPeriodStatus" FROM schedule_periods WHERE id = $1 FOR UPDATE"#,
        period_id
    )
    .fetch_one(&mut *tx)
    .await?;

    if current_status != BidPeriodStatus::Open {
        return Err(AppError::BadRequest(
            "Bids can only be processed for periods in 'open' status".into(),
        ));
    }

    // Set status to in_progress during processing
    sqlx::query!(
        "UPDATE schedule_periods SET status = 'in_progress' WHERE id = $1",
        period_id
    )
    .execute(&mut *tx)
    .await?;

    // Get all bid windows in seniority order
    let windows = sqlx::query!(
        r#"
        SELECT id, user_id
        FROM bid_windows
        WHERE period_id = $1
        ORDER BY seniority_rank ASC
        "#,
        period_id
    )
    .fetch_all(&mut *tx)
    .await?;

    let mut awards_count = 0;

    for win in &windows {
        // Get this window's submissions in preference order
        let submissions = sqlx::query!(
            r#"
            SELECT id, slot_id, preference_rank
            FROM bid_submissions
            WHERE bid_window_id = $1
            ORDER BY preference_rank ASC
            "#,
            win.id
        )
        .fetch_all(&mut *tx)
        .await?;

        // Find the highest-preference slot that hasn't been awarded to someone else
        for sub in &submissions {
            // Check if this slot already has an assignment for this period
            let already_assigned = sqlx::query_scalar!(
                r#"
                SELECT EXISTS(
                    SELECT 1 FROM slot_assignments
                    WHERE slot_id = $1 AND period_id = $2
                ) AS "exists!"
                "#,
                sub.slot_id,
                period_id
            )
            .fetch_one(&mut *tx)
            .await?;

            if !already_assigned {
                // Award this slot
                sqlx::query!(
                    "UPDATE bid_submissions SET awarded = true WHERE id = $1",
                    sub.id
                )
                .execute(&mut *tx)
                .await?;

                // Create slot assignment
                sqlx::query!(
                    r#"
                    INSERT INTO slot_assignments (id, slot_id, user_id, period_id)
                    VALUES ($1, $2, $3, $4)
                    "#,
                    Uuid::new_v4(),
                    sub.slot_id,
                    win.user_id,
                    period_id,
                )
                .execute(&mut *tx)
                .await?;

                awards_count += 1;
                break;
            }
        }
    }

    // Set period status to completed
    sqlx::query!(
        "UPDATE schedule_periods SET status = 'completed' WHERE id = $1",
        period_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "ok": true,
        "awards_count": awards_count,
        "total_bidders": windows.len(),
    })))
}
