use axum::{
    extract::{Path, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::leave_sellback::{
        CreateSellbackRequest, HolidaySellbackRequest, ReviewSellbackRequest,
    },
};

/// GET /api/leave/sellback
/// Employees see their own requests; admins/supervisors see all.
pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<HolidaySellbackRequest>>> {
    let filter_user: Option<Uuid> = if auth.role.can_approve_leave() {
        None
    } else {
        Some(auth.id)
    };

    let rows = sqlx::query!(
        r#"
        SELECT id, org_id, user_id, fiscal_year, period,
               CAST(hours_requested AS FLOAT8) AS "hours_requested!",
               status, reviewed_by, reviewer_notes, created_at, updated_at
        FROM holiday_sellback_requests
        WHERE org_id = $1 AND ($2::UUID IS NULL OR user_id = $2)
        ORDER BY created_at DESC
        "#,
        auth.org_id,
        filter_user,
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| HolidaySellbackRequest {
            id: r.id,
            org_id: r.org_id,
            user_id: r.user_id,
            fiscal_year: r.fiscal_year,
            period: r.period,
            hours_requested: r.hours_requested,
            status: r.status,
            reviewed_by: r.reviewed_by,
            reviewer_notes: r.reviewer_notes,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(result))
}

/// POST /api/leave/sellback
/// Create a holiday sellback request.
/// Caps: VCCEA 96 hrs/year, VCSG 88 hrs/year.
pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateSellbackRequest>,
) -> Result<Json<HolidaySellbackRequest>> {
    use validator::Validate;
    body.validate()?;

    if body.hours_requested <= 0.0 {
        return Err(AppError::BadRequest(
            "hours_requested must be positive".into(),
        ));
    }

    if !["june", "december"].contains(&body.period.as_str()) {
        return Err(AppError::BadRequest(
            "period must be 'june' or 'december'".into(),
        ));
    }

    // Fetch user bargaining_unit to determine cap
    let bu = sqlx::query_scalar!(
        "SELECT bargaining_unit::TEXT FROM users WHERE id = $1 AND org_id = $2 AND is_active = true",
        auth.id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .flatten()
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    let annual_cap: f64 = match bu.as_str() {
        "vccea" => 96.0,
        "vcsg" => 88.0,
        _ => {
            return Err(AppError::BadRequest(
                "Holiday sellback is only available to VCCEA and VCSG employees".into(),
            ))
        }
    };

    // Check annual cap (sum of approved + pending requests this fiscal year)
    let already_requested: f64 = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(CAST(hours_requested AS FLOAT8)), 0.0) AS "total!"
        FROM holiday_sellback_requests
        WHERE user_id = $1 AND fiscal_year = $2
          AND status IN ('pending', 'approved')
        "#,
        auth.id,
        body.fiscal_year,
    )
    .fetch_one(&pool)
    .await?;

    if already_requested + body.hours_requested > annual_cap {
        return Err(AppError::BadRequest(format!(
            "Request would exceed the annual sellback cap of {} hrs (already requested: {} hrs)",
            annual_cap, already_requested
        )));
    }

    // Verify employee has enough holiday balance
    let holiday_balance: f64 = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(CAST(lb.balance_hours AS FLOAT8)), 0.0) AS "total!"
        FROM leave_balances lb
        JOIN leave_types lt ON lt.id = lb.leave_type_id
        WHERE lb.user_id = $1 AND lb.org_id = $2
          AND lt.draws_from = 'holiday'
        "#,
        auth.id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    if holiday_balance < body.hours_requested {
        return Err(AppError::BadRequest(format!(
            "Insufficient holiday balance ({:.1} hrs available)",
            holiday_balance
        )));
    }

    let r = sqlx::query!(
        r#"
        INSERT INTO holiday_sellback_requests
            (org_id, user_id, fiscal_year, period, hours_requested)
        VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC)
        RETURNING id, org_id, user_id, fiscal_year, period,
                  CAST(hours_requested AS FLOAT8) AS "hours_requested!",
                  status, reviewed_by, reviewer_notes, created_at, updated_at
        "#,
        auth.org_id,
        auth.id,
        body.fiscal_year,
        body.period,
        body.hours_requested,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(HolidaySellbackRequest {
        id: r.id,
        org_id: r.org_id,
        user_id: r.user_id,
        fiscal_year: r.fiscal_year,
        period: r.period,
        hours_requested: r.hours_requested,
        status: r.status,
        reviewed_by: r.reviewed_by,
        reviewer_notes: r.reviewer_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
}

/// PATCH /api/leave/sellback/:id/review
/// Admin/supervisor: approve, deny, or cancel a sellback request.
/// On approve, deducts hours from the employee's holiday balance.
pub async fn review(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewSellbackRequest>,
) -> Result<Json<HolidaySellbackRequest>> {
    use validator::Validate;
    body.validate()?;

    if !auth.role.can_approve_leave() {
        return Err(AppError::Forbidden);
    }

    if !["approved", "denied", "cancelled"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest(
            "status must be 'approved', 'denied', or 'cancelled'".into(),
        ));
    }

    let mut tx = pool.begin().await?;

    let req = sqlx::query!(
        r#"
        SELECT id, org_id, user_id, fiscal_year, period,
               CAST(hours_requested AS FLOAT8) AS "hours_requested!",
               status, reviewed_by, reviewer_notes, created_at, updated_at
        FROM holiday_sellback_requests
        WHERE id = $1 AND org_id = $2
        FOR UPDATE
        "#,
        id,
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Sellback request not found".into()))?;

    if req.status != "pending" {
        return Err(AppError::Conflict(format!(
            "Cannot review a request in '{}' status",
            req.status
        )));
    }

    if body.status == "approved" {
        // Find holiday leave type to deduct from (take from highest balance first)
        let holiday_types = sqlx::query!(
            r#"
            SELECT lb.leave_type_id,
                   CAST(lb.balance_hours AS FLOAT8) AS "balance_hours!"
            FROM leave_balances lb
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE lb.user_id = $1 AND lb.org_id = $2
              AND lt.draws_from = 'holiday'
              AND lb.balance_hours > 0
            ORDER BY lb.balance_hours DESC
            "#,
            req.user_id,
            auth.org_id,
        )
        .fetch_all(&mut *tx)
        .await?;

        let total_holiday: f64 = holiday_types.iter().map(|r| r.balance_hours).sum();
        if total_holiday < req.hours_requested {
            return Err(AppError::BadRequest(format!(
                "Insufficient holiday balance at approval time ({:.1} hrs available)",
                total_holiday
            )));
        }

        // Deduct hours across holiday types
        let mut remaining = req.hours_requested;
        for ht in &holiday_types {
            if remaining <= 0.0 {
                break;
            }
            let deduct = remaining.min(ht.balance_hours);

            sqlx::query!(
                r#"
                INSERT INTO accrual_transactions
                    (id, org_id, user_id, leave_type_id, hours, reason, note, created_by)
                VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, 'sellback', $6, $7)
                "#,
                Uuid::new_v4(),
                auth.org_id,
                req.user_id,
                ht.leave_type_id,
                -deduct,
                format!("Holiday sellback FY{} ({})", req.fiscal_year, req.period),
                auth.id,
            )
            .execute(&mut *tx)
            .await?;

            sqlx::query!(
                r#"
                UPDATE leave_balances
                SET balance_hours = balance_hours - $3::FLOAT8::NUMERIC,
                    as_of_date = CURRENT_DATE, updated_at = NOW()
                WHERE user_id = $1 AND leave_type_id = $2
                "#,
                req.user_id,
                ht.leave_type_id,
                deduct,
            )
            .execute(&mut *tx)
            .await?;

            remaining -= deduct;
        }
    }

    let updated = sqlx::query!(
        r#"
        UPDATE holiday_sellback_requests
        SET status = $2, reviewed_by = $3, reviewer_notes = $4, updated_at = NOW()
        WHERE id = $1
        RETURNING id, org_id, user_id, fiscal_year, period,
                  CAST(hours_requested AS FLOAT8) AS "hours_requested!",
                  status, reviewed_by, reviewer_notes, created_at, updated_at
        "#,
        id,
        body.status,
        auth.id,
        body.reviewer_notes,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(HolidaySellbackRequest {
        id: updated.id,
        org_id: updated.org_id,
        user_id: updated.user_id,
        fiscal_year: updated.fiscal_year,
        period: updated.period,
        hours_requested: updated.hours_requested,
        status: updated.status,
        reviewed_by: updated.reviewed_by,
        reviewer_notes: updated.reviewer_notes,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
    }))
}

/// PATCH /api/leave/sellback/:id/cancel
/// Employee cancels their own pending request.
pub async fn cancel(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Verify ownership
    let req = sqlx::query!(
        "SELECT user_id, status FROM holiday_sellback_requests WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Sellback request not found".into()))?;

    if req.user_id != auth.id && !auth.role.can_approve_leave() {
        return Err(AppError::Forbidden);
    }

    if req.status != "pending" {
        return Err(AppError::Conflict(format!(
            "Cannot cancel a request in '{}' status",
            req.status
        )));
    }

    let rows = sqlx::query!(
        "UPDATE holiday_sellback_requests SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Sellback request not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
