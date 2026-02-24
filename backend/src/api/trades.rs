use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    api::notifications::create_notification,
    auth::AuthUser,
    error::{AppError, Result},
    models::trade::{
        BulkReviewTradeRequest, CreateTradeRequest, RespondTradeRequest, ReviewTradeRequest,
        TradeListQuery, TradeRequest, TradeStatus,
    },
    org_guard,
};

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateTradeRequest>,
) -> Result<Json<TradeRequest>> {
    // Cannot trade with yourself
    if body.partner_id == auth.id {
        return Err(AppError::BadRequest("Cannot trade with yourself".into()));
    }

    // Verify partner belongs to same org
    org_guard::verify_user(&pool, body.partner_id, auth.org_id).await?;

    // Verify both assignments exist, belong to correct users, and are in caller's org.
    // Also fetch dates and classification_ids for validation.
    let req_assignment = sqlx::query!(
        r#"
        SELECT a.id, a.user_id, ss.date, ss.org_id, u.classification_id AS "classification_id?"
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN users u ON u.id = a.user_id
        WHERE a.id = $1
        "#,
        body.requester_assignment_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Requester assignment not found".into()))?;

    if req_assignment.org_id != auth.org_id {
        return Err(AppError::NotFound("Requester assignment not found".into()));
    }
    if req_assignment.user_id != auth.id {
        return Err(AppError::BadRequest(
            "Requester assignment does not belong to you".into(),
        ));
    }

    let partner_assignment = sqlx::query!(
        r#"
        SELECT a.id, a.user_id, ss.date, ss.org_id, u.classification_id AS "classification_id?"
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN users u ON u.id = a.user_id
        WHERE a.id = $1
        "#,
        body.partner_assignment_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Partner assignment not found".into()))?;

    if partner_assignment.org_id != auth.org_id {
        return Err(AppError::NotFound("Partner assignment not found".into()));
    }
    if partner_assignment.user_id != body.partner_id {
        return Err(AppError::BadRequest(
            "Partner assignment does not belong to the specified partner".into(),
        ));
    }

    // Verify same classification
    if req_assignment.classification_id != partner_assignment.classification_id {
        return Err(AppError::BadRequest(
            "Both employees must hold the same classification to trade".into(),
        ));
    }

    // Both assignments must be for future dates
    let today = time::OffsetDateTime::now_utc().date();
    if req_assignment.date < today {
        return Err(AppError::BadRequest("Cannot trade past assignments".into()));
    }
    if partner_assignment.date < today {
        return Err(AppError::BadRequest("Cannot trade past assignments".into()));
    }

    // Wrap all checks + INSERT in a transaction to prevent TOCTOU race
    let mut tx = pool.begin().await?;

    // Check for existing pending/approved trades on target dates for either user
    let conflict = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM trade_requests
            WHERE org_id = $1
              AND status IN ('pending_partner', 'pending_approval', 'approved')
              AND (
                  (requester_id = $2 AND requester_date = $3)
                  OR (partner_id = $2 AND partner_date = $3)
                  OR (requester_id = $4 AND requester_date = $5)
                  OR (partner_id = $4 AND partner_date = $5)
              )
        )
        "#,
        auth.org_id,
        auth.id,
        req_assignment.date,
        body.partner_id,
        partner_assignment.date,
    )
    .fetch_one(&mut *tx)
    .await?;

    if conflict.unwrap_or(false) {
        return Err(AppError::Conflict(
            "A pending or approved trade already exists for one of these dates".into(),
        ));
    }

    // M306: Block if either assignment has already been traded (is_trade = true)
    let already_traded = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM assignments
            WHERE id = ANY(ARRAY[$1::uuid, $2::uuid]) AND is_trade = true
        ) AS "exists!"
        "#,
        body.requester_assignment_id,
        body.partner_assignment_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    if already_traded {
        return Err(AppError::Conflict(
            "One or both shifts have already been traded".into(),
        ));
    }

    // M306: Block if either assignment is already in an active trade request
    let already_in_trade = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM trade_requests
            WHERE (requester_assignment_id = ANY(ARRAY[$1::uuid, $2::uuid])
                OR partner_assignment_id = ANY(ARRAY[$1::uuid, $2::uuid]))
              AND status IN ('pending_partner', 'pending_approval')
              AND org_id = $3
        ) AS "exists!"
        "#,
        body.requester_assignment_id,
        body.partner_assignment_id,
        auth.org_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    if already_in_trade {
        return Err(AppError::Conflict(
            "One or both shifts already have an active trade request".into(),
        ));
    }

    // VCCEA Article 14.3: both shifts must fall within the same schedule period
    let deadline = sqlx::query_scalar!(
        r#"
        SELECT end_date FROM schedule_periods
        WHERE org_id = $1
          AND start_date <= $2 AND end_date >= $2
          AND start_date <= $3 AND end_date >= $3
        ORDER BY start_date DESC
        LIMIT 1
        "#,
        auth.org_id,
        req_assignment.date,
        partner_assignment.date,
    )
    .fetch_optional(&mut *tx)
    .await?;

    let deadline_at = deadline.map(|d| {
        // Set deadline to end of the schedule period day (23:59:59 UTC)
        d.with_time(time::Time::from_hms(23, 59, 59).unwrap())
            .assume_utc()
    });

    let id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO trade_requests (id, org_id, requester_id, partner_id,
            requester_assignment_id, partner_assignment_id,
            requester_date, partner_date, status, deadline_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_partner', $9)
        "#,
        id,
        auth.org_id,
        auth.id,
        body.partner_id,
        body.requester_assignment_id,
        body.partner_assignment_id,
        req_assignment.date,
        partner_assignment.date,
        deadline_at,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Notify the trade partner
    let requester_name = sqlx::query!(
        "SELECT first_name || ' ' || last_name AS name FROM users WHERE id = $1",
        auth.id,
    )
    .fetch_optional(&pool)
    .await?;
    let requester_display = requester_name
        .map(|r| r.name.unwrap_or_default())
        .unwrap_or_default();
    let _ = create_notification(
        &pool,
        auth.org_id,
        body.partner_id,
        "trade_requested",
        "New trade request",
        &format!("{} has requested a shift trade with you", requester_display),
        Some("/trades"),
        Some("trade_request"),
        Some(id),
    )
    .await;

    // Fetch back the full trade with names
    fetch_trade(&pool, id, auth.org_id).await
}

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<TradeListQuery>,
) -> Result<Json<Vec<TradeRequest>>> {
    let is_manager = auth.role.can_manage_schedule();

    // Parse the optional status filter
    let status_filter: Option<TradeStatus> = match params.status.as_deref() {
        Some("pending_partner") => Some(TradeStatus::PendingPartner),
        Some("pending_approval") => Some(TradeStatus::PendingApproval),
        Some("approved") => Some(TradeStatus::Approved),
        Some("denied") => Some(TradeStatus::Denied),
        Some("cancelled") => Some(TradeStatus::Cancelled),
        Some(_) => return Err(AppError::BadRequest("Invalid status filter".into())),
        None => None,
    };

    let rows = sqlx::query!(
        r#"
        SELECT tr.id, tr.org_id, tr.requester_id, tr.partner_id,
               tr.requester_assignment_id, tr.partner_assignment_id,
               tr.requester_date, tr.partner_date,
               tr.status AS "status: TradeStatus",
               tr.reviewed_by, tr.reviewer_notes,
               tr.created_at, tr.updated_at,
               ru.first_name || ' ' || ru.last_name AS "requester_name!",
               pu.first_name || ' ' || pu.last_name AS "partner_name!"
        FROM trade_requests tr
        JOIN users ru ON ru.id = tr.requester_id
        JOIN users pu ON pu.id = tr.partner_id
        WHERE tr.org_id = $1
          AND ($2 OR tr.requester_id = $3 OR tr.partner_id = $3)
          AND ($4::trade_status IS NULL OR tr.status = $4)
          AND ($5::uuid IS NULL OR tr.requester_id = $5 OR tr.partner_id = $5)
        ORDER BY tr.created_at DESC
        LIMIT $6 OFFSET $7
        "#,
        auth.org_id,
        is_manager,
        auth.id,
        status_filter as Option<TradeStatus>,
        params.user_id,
        params.limit(),
        params.offset(),
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| TradeRequest {
            id: r.id,
            org_id: r.org_id,
            requester_id: r.requester_id,
            requester_name: r.requester_name,
            partner_id: r.partner_id,
            partner_name: r.partner_name,
            requester_assignment_id: r.requester_assignment_id,
            partner_assignment_id: r.partner_assignment_id,
            requester_date: r.requester_date,
            partner_date: r.partner_date,
            status: r.status,
            reviewed_by: r.reviewed_by,
            reviewer_notes: r.reviewer_notes,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(result))
}

pub async fn get_one(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<TradeRequest>> {
    let trade = fetch_trade(&pool, id, auth.org_id).await?;
    let trade_inner = trade.0;

    // Non-managers can only see their own trades
    if !auth.role.can_manage_schedule()
        && trade_inner.requester_id != auth.id
        && trade_inner.partner_id != auth.id
    {
        return Err(AppError::Forbidden);
    }

    Ok(Json(trade_inner))
}

pub async fn respond(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<RespondTradeRequest>,
) -> Result<Json<TradeRequest>> {
    let mut tx = pool.begin().await?;

    // Fetch trade with FOR UPDATE to prevent TOCTOU race
    let r = sqlx::query!(
        r#"
        SELECT id, org_id, requester_id, partner_id,
               requester_assignment_id, partner_assignment_id,
               status AS "status: TradeStatus"
        FROM trade_requests
        WHERE id = $1 AND org_id = $2
        FOR UPDATE
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Trade request not found".into()))?;

    // Only the partner can respond
    if r.partner_id != auth.id {
        return Err(AppError::Forbidden);
    }

    // Only when status is pending_partner
    if r.status != TradeStatus::PendingPartner {
        return Err(AppError::BadRequest(
            "Trade can only be responded to when pending partner acceptance".into(),
        ));
    }

    let new_status = if body.accept {
        TradeStatus::PendingApproval
    } else {
        TradeStatus::Cancelled
    };

    sqlx::query!(
        r#"
        UPDATE trade_requests
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        "#,
        id,
        new_status as TradeStatus,
    )
    .execute(&mut *tx)
    .await?;

    // M312: When partner accepts, seed the trade_approvals table with all
    // supervisors of the two affected shifts (via slot → team → supervisor_id).
    // If no supervisors found, no rows are inserted → legacy single-supervisor flow.
    if body.accept {
        let supervisor_ids = sqlx::query_scalar!(
            r#"
            SELECT DISTINCT t.supervisor_id AS "supervisor_id!"
            FROM assignments a
            JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
            JOIN shift_slots slot ON slot.id = ss.slot_id
            JOIN teams t ON t.id = slot.team_id
            WHERE a.id = ANY(ARRAY[$1::uuid, $2::uuid]) AND t.supervisor_id IS NOT NULL
            "#,
            r.requester_assignment_id,
            r.partner_assignment_id,
        )
        .fetch_all(&mut *tx)
        .await?;

        for supervisor_id in &supervisor_ids {
            sqlx::query!(
                r#"
                INSERT INTO trade_approvals (org_id, trade_id, supervisor_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (trade_id, supervisor_id) DO NOTHING
                "#,
                r.org_id,
                id,
                supervisor_id,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    fetch_trade(&pool, id, auth.org_id).await
}

pub async fn review(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewTradeRequest>,
) -> Result<Json<TradeRequest>> {
    use validator::Validate;
    body.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if body.status != "approved" && body.status != "denied" {
        return Err(AppError::BadRequest(
            "status must be 'approved' or 'denied'".into(),
        ));
    }

    // Entire review is one transaction — fetch with FOR UPDATE to prevent TOCTOU race
    let mut tx = pool.begin().await?;

    let r = sqlx::query!(
        r#"
        SELECT id, org_id, requester_id, partner_id,
               requester_assignment_id, partner_assignment_id,
               status AS "status: TradeStatus",
               deadline_at AS "deadline_at?"
        FROM trade_requests
        WHERE id = $1 AND org_id = $2
        FOR UPDATE
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Trade request not found".into()))?;

    if r.status != TradeStatus::PendingApproval {
        return Err(AppError::BadRequest(
            "Trade can only be reviewed when pending approval".into(),
        ));
    }

    // VCCEA Article 14.3: reject approval if trade deadline has passed
    if body.status == "approved" {
        if let Some(deadline) = r.deadline_at {
            if time::OffsetDateTime::now_utc() > deadline {
                return Err(AppError::Conflict(
                    "Trade deadline has passed — both shifts must be completed within the bid period".into(),
                ));
            }
        }
    }

    // M318: 1-hour approval cutoff — fetch shift dates and start times for both assignments
    let timing = sqlx::query!(
        r#"
        SELECT
            (SELECT ss.date FROM assignments a
             JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
             WHERE a.id = $1) AS req_date,
            (SELECT st.start_time FROM assignments a
             JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
             JOIN shift_templates st ON st.id = ss.shift_template_id
             WHERE a.id = $1) AS req_start,
            (SELECT ss.date FROM assignments a
             JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
             WHERE a.id = $2) AS par_date,
            (SELECT st.start_time FROM assignments a
             JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
             JOIN shift_templates st ON st.id = ss.shift_template_id
             WHERE a.id = $2) AS par_start
        "#,
        r.requester_assignment_id,
        r.partner_assignment_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    let now_utc = time::OffsetDateTime::now_utc();
    for (date_opt, time_opt) in [
        (timing.req_date, timing.req_start),
        (timing.par_date, timing.par_start),
    ] {
        if let (Some(d), Some(t)) = (date_opt, time_opt) {
            let shift_start = time::PrimitiveDateTime::new(d, t).assume_utc();
            let minutes_until = (shift_start - now_utc).whole_minutes();
            if minutes_until < 60 {
                return Err(AppError::Conflict(
                    "Cannot approve a trade within 1 hour of shift start".into(),
                ));
            }
        }
    }

    let mut final_status: Option<&str> = None;

    // M312: Check for trade_approvals rows to determine which review path to use
    let approval_count = sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!" FROM trade_approvals WHERE trade_id = $1"#,
        id,
    )
    .fetch_one(&mut *tx)
    .await?;

    if approval_count == 0 {
        // Legacy path: any supervisor can approve/deny directly
        if body.status == "approved" {
            // Swap user_ids on both assignments and set is_trade = true
            // Guard: verify assignments still belong to expected users (prevents stale swap)
            let req_rows = sqlx::query!(
                r#"
                UPDATE assignments SET user_id = $2, is_trade = true
                WHERE id = $1 AND user_id = $3
                "#,
                r.requester_assignment_id,
                r.partner_id,
                r.requester_id,
            )
            .execute(&mut *tx)
            .await?
            .rows_affected();

            let partner_rows = sqlx::query!(
                r#"
                UPDATE assignments SET user_id = $2, is_trade = true
                WHERE id = $1 AND user_id = $3
                "#,
                r.partner_assignment_id,
                r.requester_id,
                r.partner_id,
            )
            .execute(&mut *tx)
            .await?
            .rows_affected();

            if req_rows == 0 || partner_rows == 0 {
                // Rollback happens automatically when tx is dropped
                return Err(AppError::Conflict(
                    "Assignments have changed since the trade was created. Trade cannot be approved."
                        .into(),
                ));
            }

            sqlx::query!(
                r#"
                UPDATE trade_requests
                SET status = 'approved', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                WHERE id = $1
                "#,
                id,
                auth.id,
                body.reviewer_notes,
            )
            .execute(&mut *tx)
            .await?;
            final_status = Some("approved");
        } else {
            sqlx::query!(
                r#"
                UPDATE trade_requests
                SET status = 'denied', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                WHERE id = $1
                "#,
                id,
                auth.id,
                body.reviewer_notes,
            )
            .execute(&mut *tx)
            .await?;
            final_status = Some("denied");
        }
    } else {
        // Multi-supervisor path: only supervisors with a pending approval row can act
        let my_approval = sqlx::query!(
            r#"
            SELECT id FROM trade_approvals
            WHERE trade_id = $1 AND supervisor_id = $2 AND status = 'pending'
            "#,
            id,
            auth.id,
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::Forbidden)?;

        // Record this supervisor's decision
        sqlx::query!(
            r#"
            UPDATE trade_approvals
            SET status = $2, reviewed_at = NOW(), reviewer_notes = $3
            WHERE id = $1
            "#,
            my_approval.id,
            body.status,
            body.reviewer_notes,
        )
        .execute(&mut *tx)
        .await?;

        if body.status == "denied" {
            // Any supervisor denial immediately denies the trade
            sqlx::query!(
                r#"
                UPDATE trade_requests
                SET status = 'denied', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                WHERE id = $1
                "#,
                id,
                auth.id,
                body.reviewer_notes,
            )
            .execute(&mut *tx)
            .await?;
            final_status = Some("denied");
        } else {
            // Check whether all supervisors have now approved
            let remaining = sqlx::query_scalar!(
                r#"
                SELECT COUNT(*) AS "count!"
                FROM trade_approvals
                WHERE trade_id = $1 AND status != 'approved'
                "#,
                id,
            )
            .fetch_one(&mut *tx)
            .await?;

            if remaining == 0 {
                // All supervisors approved — do the assignment swap
                let req_rows = sqlx::query!(
                    r#"
                    UPDATE assignments SET user_id = $2, is_trade = true
                    WHERE id = $1 AND user_id = $3
                    "#,
                    r.requester_assignment_id,
                    r.partner_id,
                    r.requester_id,
                )
                .execute(&mut *tx)
                .await?
                .rows_affected();

                let partner_rows = sqlx::query!(
                    r#"
                    UPDATE assignments SET user_id = $2, is_trade = true
                    WHERE id = $1 AND user_id = $3
                    "#,
                    r.partner_assignment_id,
                    r.requester_id,
                    r.partner_id,
                )
                .execute(&mut *tx)
                .await?
                .rows_affected();

                if req_rows == 0 || partner_rows == 0 {
                    return Err(AppError::Conflict(
                        "Assignments have changed since the trade was created. Trade cannot be approved."
                            .into(),
                    ));
                }

                sqlx::query!(
                    r#"
                    UPDATE trade_requests
                    SET status = 'approved', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                    WHERE id = $1
                    "#,
                    id,
                    auth.id,
                    body.reviewer_notes,
                )
                .execute(&mut *tx)
                .await?;
                final_status = Some("approved");
            }
            // else: still waiting on other supervisors — trade stays pending_approval
        }
    }

    tx.commit().await?;

    // Notify both trader and tradee about the review result
    if let Some(status_word) = final_status {
        let notif_title = format!("Trade request {}", status_word);
        let notif_message = format!("Your trade request has been {}", status_word);

        for user_id in [r.requester_id, r.partner_id] {
            let _ = create_notification(
                &pool,
                auth.org_id,
                user_id,
                "trade_reviewed",
                &notif_title,
                &notif_message,
                Some("/trades"),
                Some("trade_request"),
                Some(id),
            )
            .await;
        }
    }

    fetch_trade(&pool, id, auth.org_id).await
}

pub async fn cancel(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let rows = sqlx::query!(
        r#"
        UPDATE trade_requests
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
          AND org_id = $2
          AND requester_id = $3
          AND status IN ('pending_partner', 'pending_approval')
        "#,
        id,
        auth.org_id,
        auth.id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound(
            "Trade request not found or cannot be cancelled".into(),
        ));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn bulk_review(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<BulkReviewTradeRequest>,
) -> Result<Json<serde_json::Value>> {
    use validator::Validate;
    body.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if body.status != "approved" && body.status != "denied" {
        return Err(AppError::BadRequest(
            "status must be 'approved' or 'denied'".into(),
        ));
    }

    if body.ids.is_empty() {
        return Err(AppError::BadRequest("ids must not be empty".into()));
    }

    if body.ids.len() > 100 {
        return Err(AppError::BadRequest(
            "Cannot bulk review more than 100 trades at once".into(),
        ));
    }

    let mut tx = pool.begin().await?;
    let mut reviewed = 0u64;

    for id in &body.ids {
        // Lock and fetch the trade
        let trade = sqlx::query!(
            r#"
            SELECT id, org_id, requester_id, partner_id,
                   requester_assignment_id, partner_assignment_id,
                   status AS "status: TradeStatus"
            FROM trade_requests
            WHERE id = $1 AND org_id = $2
            FOR UPDATE
            "#,
            id,
            auth.org_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        let trade = match trade {
            Some(t) if t.status == TradeStatus::PendingApproval => t,
            _ => continue, // skip non-existent or non-pending trades
        };

        // M318: Skip trades within 1 hour of a shift start
        let timing = sqlx::query!(
            r#"
            SELECT
                (SELECT ss.date FROM assignments a
                 JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
                 WHERE a.id = $1) AS req_date,
                (SELECT st.start_time FROM assignments a
                 JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
                 JOIN shift_templates st ON st.id = ss.shift_template_id
                 WHERE a.id = $1) AS req_start,
                (SELECT ss.date FROM assignments a
                 JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
                 WHERE a.id = $2) AS par_date,
                (SELECT st.start_time FROM assignments a
                 JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
                 JOIN shift_templates st ON st.id = ss.shift_template_id
                 WHERE a.id = $2) AS par_start
            "#,
            trade.requester_assignment_id,
            trade.partner_assignment_id,
        )
        .fetch_one(&mut *tx)
        .await?;

        let now_utc = time::OffsetDateTime::now_utc();
        let mut timing_blocked = false;
        for (date_opt, time_opt) in [
            (timing.req_date, timing.req_start),
            (timing.par_date, timing.par_start),
        ] {
            if let (Some(d), Some(t)) = (date_opt, time_opt) {
                let shift_start = time::PrimitiveDateTime::new(d, t).assume_utc();
                if (shift_start - now_utc).whole_minutes() < 60 {
                    timing_blocked = true;
                    break;
                }
            }
        }
        if timing_blocked {
            continue; // leave trade in pending_approval for manual review
        }

        // M312: Check for trade_approvals rows
        let approval_count = sqlx::query_scalar!(
            r#"SELECT COUNT(*) AS "count!" FROM trade_approvals WHERE trade_id = $1"#,
            id,
        )
        .fetch_one(&mut *tx)
        .await?;

        if approval_count == 0 {
            // Legacy path
            if body.status == "approved" {
                let req_rows = sqlx::query!(
                    r#"
                    UPDATE assignments SET user_id = $2, is_trade = true
                    WHERE id = $1 AND user_id = $3
                    "#,
                    trade.requester_assignment_id,
                    trade.partner_id,
                    trade.requester_id,
                )
                .execute(&mut *tx)
                .await?
                .rows_affected();

                let partner_rows = sqlx::query!(
                    r#"
                    UPDATE assignments SET user_id = $2, is_trade = true
                    WHERE id = $1 AND user_id = $3
                    "#,
                    trade.partner_assignment_id,
                    trade.requester_id,
                    trade.partner_id,
                )
                .execute(&mut *tx)
                .await?
                .rows_affected();

                if req_rows == 0 || partner_rows == 0 {
                    // Assignments changed — deny with explanation
                    sqlx::query!(
                        r#"
                        UPDATE trade_requests
                        SET status = 'denied', reviewed_by = $2,
                            reviewer_notes = 'Assignments changed since trade was created',
                            updated_at = NOW()
                        WHERE id = $1
                        "#,
                        id,
                        auth.id,
                    )
                    .execute(&mut *tx)
                    .await?;
                    reviewed += 1;
                    continue;
                }

                sqlx::query!(
                    r#"
                    UPDATE trade_requests
                    SET status = 'approved', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                    WHERE id = $1
                    "#,
                    id,
                    auth.id,
                    body.reviewer_notes,
                )
                .execute(&mut *tx)
                .await?;
            } else {
                sqlx::query!(
                    r#"
                    UPDATE trade_requests
                    SET status = 'denied', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                    WHERE id = $1
                    "#,
                    id,
                    auth.id,
                    body.reviewer_notes,
                )
                .execute(&mut *tx)
                .await?;
            }
        } else {
            // Multi-supervisor path: only process if this supervisor has a pending row
            let my_approval = sqlx::query!(
                r#"
                SELECT id FROM trade_approvals
                WHERE trade_id = $1 AND supervisor_id = $2 AND status = 'pending'
                "#,
                id,
                auth.id,
            )
            .fetch_optional(&mut *tx)
            .await?;

            let my_approval = match my_approval {
                Some(a) => a,
                None => continue, // not required to approve this trade — skip
            };

            sqlx::query!(
                r#"
                UPDATE trade_approvals
                SET status = $2, reviewed_at = NOW(), reviewer_notes = $3
                WHERE id = $1
                "#,
                my_approval.id,
                body.status,
                body.reviewer_notes,
            )
            .execute(&mut *tx)
            .await?;

            if body.status == "denied" {
                sqlx::query!(
                    r#"
                    UPDATE trade_requests
                    SET status = 'denied', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                    WHERE id = $1
                    "#,
                    id,
                    auth.id,
                    body.reviewer_notes,
                )
                .execute(&mut *tx)
                .await?;
            } else {
                // Check if all supervisors have approved
                let remaining = sqlx::query_scalar!(
                    r#"
                    SELECT COUNT(*) AS "count!"
                    FROM trade_approvals
                    WHERE trade_id = $1 AND status != 'approved'
                    "#,
                    id,
                )
                .fetch_one(&mut *tx)
                .await?;

                if remaining == 0 {
                    let req_rows = sqlx::query!(
                        r#"
                        UPDATE assignments SET user_id = $2, is_trade = true
                        WHERE id = $1 AND user_id = $3
                        "#,
                        trade.requester_assignment_id,
                        trade.partner_id,
                        trade.requester_id,
                    )
                    .execute(&mut *tx)
                    .await?
                    .rows_affected();

                    let partner_rows = sqlx::query!(
                        r#"
                        UPDATE assignments SET user_id = $2, is_trade = true
                        WHERE id = $1 AND user_id = $3
                        "#,
                        trade.partner_assignment_id,
                        trade.requester_id,
                        trade.partner_id,
                    )
                    .execute(&mut *tx)
                    .await?
                    .rows_affected();

                    if req_rows == 0 || partner_rows == 0 {
                        sqlx::query!(
                            r#"
                            UPDATE trade_requests
                            SET status = 'denied', reviewed_by = $2,
                                reviewer_notes = 'Assignments changed since trade was created',
                                updated_at = NOW()
                            WHERE id = $1
                            "#,
                            id,
                            auth.id,
                        )
                        .execute(&mut *tx)
                        .await?;
                        reviewed += 1;
                        continue;
                    }

                    sqlx::query!(
                        r#"
                        UPDATE trade_requests
                        SET status = 'approved', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                        WHERE id = $1
                        "#,
                        id,
                        auth.id,
                        body.reviewer_notes,
                    )
                    .execute(&mut *tx)
                    .await?;
                }
                // else: still waiting on other supervisors — trade stays pending_approval
            }
        }

        reviewed += 1;
    }

    tx.commit().await?;

    Ok(Json(
        serde_json::json!({ "ok": true, "reviewed": reviewed }),
    ))
}

/// Helper: fetch a single trade with joined user names.
async fn fetch_trade(pool: &PgPool, id: Uuid, org_id: Uuid) -> Result<Json<TradeRequest>> {
    let r = sqlx::query!(
        r#"
        SELECT tr.id, tr.org_id, tr.requester_id, tr.partner_id,
               tr.requester_assignment_id, tr.partner_assignment_id,
               tr.requester_date, tr.partner_date,
               tr.status AS "status: TradeStatus",
               tr.reviewed_by, tr.reviewer_notes,
               tr.created_at, tr.updated_at,
               ru.first_name || ' ' || ru.last_name AS "requester_name!",
               pu.first_name || ' ' || pu.last_name AS "partner_name!"
        FROM trade_requests tr
        JOIN users ru ON ru.id = tr.requester_id
        JOIN users pu ON pu.id = tr.partner_id
        WHERE tr.id = $1 AND tr.org_id = $2
        "#,
        id,
        org_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Trade request not found".into()))?;

    Ok(Json(TradeRequest {
        id: r.id,
        org_id: r.org_id,
        requester_id: r.requester_id,
        requester_name: r.requester_name,
        partner_id: r.partner_id,
        partner_name: r.partner_name,
        requester_assignment_id: r.requester_assignment_id,
        partner_assignment_id: r.partner_assignment_id,
        requester_date: r.requester_date,
        partner_date: r.partner_date,
        status: r.status,
        reviewed_by: r.reviewed_by,
        reviewer_notes: r.reviewer_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
}
