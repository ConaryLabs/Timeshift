use axum::{
    extract::{Path, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::leave_donation::{CreateDonationRequest, ReviewDonationRequest, SickLeaveDonation},
    org_guard,
};

/// GET /api/leave/donations
/// Donors and recipients see requests involving them; admins/supervisors see all.
pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<SickLeaveDonation>>> {
    let filter_user: Option<Uuid> = if auth.role.can_approve_leave() {
        None
    } else {
        Some(auth.id)
    };

    let rows = sqlx::query!(
        r#"
        SELECT id, org_id, donor_id, recipient_id, leave_type_id,
               CAST(hours AS FLOAT8) AS "hours!",
               fiscal_year, status, reviewed_by, reviewer_notes, created_at, updated_at
        FROM sick_leave_donations
        WHERE org_id = $1
          AND ($2::UUID IS NULL OR donor_id = $2 OR recipient_id = $2)
        ORDER BY created_at DESC
        "#,
        auth.org_id,
        filter_user,
    )
    .fetch_all(&pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| SickLeaveDonation {
            id: r.id,
            org_id: r.org_id,
            donor_id: r.donor_id,
            recipient_id: r.recipient_id,
            leave_type_id: r.leave_type_id,
            hours: r.hours,
            fiscal_year: r.fiscal_year,
            status: r.status,
            reviewed_by: r.reviewed_by,
            reviewer_notes: r.reviewer_notes,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(result))
}

/// POST /api/leave/donations
/// Donor submits a sick leave donation request.
/// Caps: VCCEA 20 hrs/year, VCSG 40 hrs/year. Donor retains ≥ 100 hrs after.
pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateDonationRequest>,
) -> Result<Json<SickLeaveDonation>> {
    use validator::Validate;
    body.validate()?;

    if body.hours <= 0.0 {
        return Err(AppError::BadRequest("hours must be positive".into()));
    }

    if body.recipient_id == auth.id {
        return Err(AppError::BadRequest("Cannot donate to yourself".into()));
    }

    // Verify recipient is in the same org
    org_guard::verify_user(&pool, body.recipient_id, auth.org_id).await?;

    // Verify leave type belongs to org and is a sick pool type
    let lt = sqlx::query!(
        "SELECT draws_from FROM leave_types WHERE id = $1 AND org_id = $2 AND is_active = true",
        body.leave_type_id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Leave type not found".into()))?;

    if lt.draws_from.as_deref() != Some("sick") {
        return Err(AppError::BadRequest(
            "Sick leave donation requires a sick-pool leave type".into(),
        ));
    }

    // Fetch donor bargaining_unit for cap check
    let bu = sqlx::query_scalar!(
        "SELECT bargaining_unit::TEXT FROM users WHERE id = $1 AND org_id = $2 AND is_active = true",
        auth.id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .flatten()
    .ok_or_else(|| AppError::NotFound("Donor not found".into()))?;

    let annual_cap: f64 = match bu.as_str() {
        "vccea" => 20.0,
        "vcsg" => 40.0,
        _ => {
            return Err(AppError::BadRequest(
                "Sick leave donation is only available to VCCEA and VCSG employees".into(),
            ))
        }
    };

    // Wrap cap check, balance check, and INSERT in a transaction to prevent
    // concurrent requests from both passing the cap/floor checks (TOCTOU).
    let mut tx = pool.begin().await?;

    // Check annual cap (approved + pending donations this fiscal year)
    // Subquery locks donation rows with FOR UPDATE to serialize concurrent requests,
    // then the outer query aggregates (FOR UPDATE cannot be used with aggregates directly).
    let already_donated: f64 = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(locked.hrs), 0.0) AS "total!"
        FROM (
            SELECT CAST(hours AS FLOAT8) AS hrs
            FROM sick_leave_donations
            WHERE donor_id = $1 AND fiscal_year = $2
              AND status IN ('pending', 'approved')
            FOR UPDATE
        ) locked
        "#,
        auth.id,
        body.fiscal_year,
    )
    .fetch_one(&mut *tx)
    .await?;

    if already_donated + body.hours > annual_cap {
        return Err(AppError::BadRequest(format!(
            "Donation would exceed the annual cap of {} hrs (already donated/pending: {} hrs)",
            annual_cap, already_donated
        )));
    }

    // Verify donor retains >= 100 hrs of sick balance after donation
    // Subquery locks balance rows with FOR UPDATE to prevent concurrent modifications,
    // then the outer query aggregates.
    let sick_balance: f64 = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(locked.bal), 0.0) AS "total!"
        FROM (
            SELECT CAST(lb.balance_hours AS FLOAT8) AS bal
            FROM leave_balances lb
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE lb.user_id = $1 AND lb.org_id = $2
              AND lt.draws_from = 'sick'
            FOR UPDATE OF lb
        ) locked
        "#,
        auth.id,
        auth.org_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    if sick_balance - body.hours < 100.0 {
        return Err(AppError::BadRequest(format!(
            "Donor must retain at least 100 hrs of sick leave (current: {:.1} hrs, requesting to donate: {:.1} hrs)",
            sick_balance, body.hours
        )));
    }

    let r = sqlx::query!(
        r#"
        INSERT INTO sick_leave_donations
            (org_id, donor_id, recipient_id, leave_type_id, hours, fiscal_year)
        VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, $6)
        RETURNING id, org_id, donor_id, recipient_id, leave_type_id,
                  CAST(hours AS FLOAT8) AS "hours!",
                  fiscal_year, status, reviewed_by, reviewer_notes, created_at, updated_at
        "#,
        auth.org_id,
        auth.id,
        body.recipient_id,
        body.leave_type_id,
        body.hours,
        body.fiscal_year,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(SickLeaveDonation {
        id: r.id,
        org_id: r.org_id,
        donor_id: r.donor_id,
        recipient_id: r.recipient_id,
        leave_type_id: r.leave_type_id,
        hours: r.hours,
        fiscal_year: r.fiscal_year,
        status: r.status,
        reviewed_by: r.reviewed_by,
        reviewer_notes: r.reviewer_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
}

/// PATCH /api/leave/donations/:id/review
/// Admin/supervisor: approve, deny, or cancel a donation request.
/// On approve, deducts from donor's sick balance and credits recipient's.
pub async fn review(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewDonationRequest>,
) -> Result<Json<SickLeaveDonation>> {
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

    let donation = sqlx::query!(
        r#"
        SELECT id, org_id, donor_id, recipient_id, leave_type_id,
               CAST(hours AS FLOAT8) AS "hours!",
               fiscal_year, status, reviewed_by, reviewer_notes, created_at, updated_at
        FROM sick_leave_donations
        WHERE id = $1 AND org_id = $2
        FOR UPDATE
        "#,
        id,
        auth.org_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Donation request not found".into()))?;

    if donation.status != "pending" {
        return Err(AppError::Conflict(format!(
            "Cannot review a donation in '{}' status",
            donation.status
        )));
    }

    if body.status == "approved" {
        // Re-check donor sick balance at approval time. Subquery locks balance rows
        // with FOR UPDATE to prevent concurrent approvals from pushing donor below
        // the 100-hour floor, then the outer query aggregates.
        let sick_balance: f64 = sqlx::query_scalar!(
            r#"
            SELECT COALESCE(SUM(locked.bal), 0.0) AS "total!"
            FROM (
                SELECT CAST(lb.balance_hours AS FLOAT8) AS bal
                FROM leave_balances lb
                JOIN leave_types lt ON lt.id = lb.leave_type_id
                WHERE lb.user_id = $1 AND lb.org_id = $2
                  AND lt.draws_from = 'sick'
                FOR UPDATE OF lb
            ) locked
            "#,
            donation.donor_id,
            auth.org_id,
        )
        .fetch_one(&mut *tx)
        .await?;

        if sick_balance - donation.hours < 100.0 {
            return Err(AppError::BadRequest(format!(
                "Donor would fall below 100 hrs sick balance at approval time ({:.1} hrs available)",
                sick_balance
            )));
        }

        // Deduct from donor's specific sick leave type
        sqlx::query!(
            r#"
            INSERT INTO accrual_transactions
                (id, org_id, user_id, leave_type_id, hours, reason, note, created_by)
            VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, 'donation_out',
                    $6, $7)
            "#,
            Uuid::new_v4(),
            auth.org_id,
            donation.donor_id,
            donation.leave_type_id,
            -donation.hours,
            format!(
                "Sick leave donation to recipient (FY{})",
                donation.fiscal_year
            ),
            auth.id,
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO leave_balances (id, org_id, user_id, leave_type_id, balance_hours, as_of_date, updated_at)
            VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, CURRENT_DATE, NOW())
            ON CONFLICT (org_id, user_id, leave_type_id) DO UPDATE
            SET balance_hours = leave_balances.balance_hours - $5::FLOAT8::NUMERIC,
                as_of_date = CURRENT_DATE, updated_at = NOW()
            "#,
            Uuid::new_v4(),
            auth.org_id,
            donation.donor_id,
            donation.leave_type_id,
            donation.hours,
        )
        .execute(&mut *tx)
        .await?;

        // Credit recipient's sick leave balance
        sqlx::query!(
            r#"
            INSERT INTO accrual_transactions
                (id, org_id, user_id, leave_type_id, hours, reason, note, created_by)
            VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, 'donation_in',
                    $6, $7)
            "#,
            Uuid::new_v4(),
            auth.org_id,
            donation.recipient_id,
            donation.leave_type_id,
            donation.hours,
            format!("Sick leave donation received (FY{})", donation.fiscal_year),
            auth.id,
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO leave_balances (id, org_id, user_id, leave_type_id, balance_hours, as_of_date, updated_at)
            VALUES ($1, $2, $3, $4, $5::FLOAT8::NUMERIC, CURRENT_DATE, NOW())
            ON CONFLICT (org_id, user_id, leave_type_id) DO UPDATE
            SET balance_hours = leave_balances.balance_hours + $5::FLOAT8::NUMERIC,
                as_of_date = CURRENT_DATE, updated_at = NOW()
            "#,
            Uuid::new_v4(),
            auth.org_id,
            donation.recipient_id,
            donation.leave_type_id,
            donation.hours,
        )
        .execute(&mut *tx)
        .await?;
    }

    let updated = sqlx::query!(
        r#"
        UPDATE sick_leave_donations
        SET status = $2, reviewed_by = $3, reviewer_notes = $4, updated_at = NOW()
        WHERE id = $1
        RETURNING id, org_id, donor_id, recipient_id, leave_type_id,
                  CAST(hours AS FLOAT8) AS "hours!",
                  fiscal_year, status, reviewed_by, reviewer_notes, created_at, updated_at
        "#,
        id,
        body.status,
        auth.id,
        body.reviewer_notes,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(SickLeaveDonation {
        id: updated.id,
        org_id: updated.org_id,
        donor_id: updated.donor_id,
        recipient_id: updated.recipient_id,
        leave_type_id: updated.leave_type_id,
        hours: updated.hours,
        fiscal_year: updated.fiscal_year,
        status: updated.status,
        reviewed_by: updated.reviewed_by,
        reviewer_notes: updated.reviewer_notes,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
    }))
}

/// PATCH /api/leave/donations/:id/cancel
/// Donor cancels their own pending request.
pub async fn cancel(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let donation = sqlx::query!(
        "SELECT donor_id, status FROM sick_leave_donations WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Donation request not found".into()))?;

    if donation.donor_id != auth.id && !auth.role.can_approve_leave() {
        return Err(AppError::Forbidden);
    }

    if donation.status != "pending" {
        return Err(AppError::Conflict(format!(
            "Cannot cancel a donation in '{}' status",
            donation.status
        )));
    }

    let rows = sqlx::query!(
        "UPDATE sick_leave_donations SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Donation request not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
