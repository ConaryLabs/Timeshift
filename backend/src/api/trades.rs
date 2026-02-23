use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
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

    // Wrap conflict check + INSERT in a transaction to prevent TOCTOU race
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

    let id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO trade_requests (id, org_id, requester_id, partner_id,
            requester_assignment_id, partner_assignment_id,
            requester_date, partner_date, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_partner')
        "#,
        id,
        auth.org_id,
        auth.id,
        body.partner_id,
        body.requester_assignment_id,
        body.partner_assignment_id,
        req_assignment.date,
        partner_assignment.date,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

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

    if r.status != TradeStatus::PendingApproval {
        return Err(AppError::BadRequest(
            "Trade can only be reviewed when pending approval".into(),
        ));
    }

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

    tx.commit().await?;

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

        if body.status == "approved" {
            // Swap user_ids on both assignments
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
                // Assignments changed — deny with explanation instead of silently skipping
                sqlx::query!(
                    r#"
                    UPDATE trade_requests
                    SET status = 'denied', reviewed_by = $2, reviewer_notes = 'Assignments changed since trade was created', updated_at = NOW()
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

        reviewed += 1;
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "ok": true, "reviewed": reviewed })))
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
