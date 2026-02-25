use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::{
        callout::CalloutStatus,
        ot::{
            AdjustOtHoursRequest, AdvanceStepRequest, CalloutStep, OtHoursQuery, OtHoursView,
            OtQueueQuery, OtQueueView, OtVolunteer, SetQueuePositionRequest,
        },
    },
    org_guard,
};

// ---------------------------------------------------------------------------
// OT Queue
// ---------------------------------------------------------------------------

pub async fn get_queue(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<OtQueueQuery>,
) -> Result<Json<Vec<OtQueueView>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_classification(&pool, params.classification_id, auth.org_id).await?;

    let fiscal_year = params
        .fiscal_year
        .unwrap_or(crate::services::timezone::current_fiscal_year(
            &auth.org_timezone,
            crate::services::org_settings::get_i64(&pool, auth.org_id, "fiscal_year_start_month", 1)
                .await as u32,
        ));

    let rows = sqlx::query!(
        r#"
        SELECT
            q.user_id,
            u.first_name,
            u.last_name,
            u.employee_id,
            q.last_ot_event_at,
            COALESCE(CAST(ot.hours_worked AS FLOAT8), 0.0) AS "ot_hours_worked!",
            COALESCE(CAST(ot.hours_declined AS FLOAT8), 0.0) AS "ot_hours_declined!"
        FROM ot_queue_positions q
        JOIN users u ON u.id = q.user_id
        LEFT JOIN ot_hours ot ON ot.user_id = q.user_id
            AND ot.fiscal_year = q.fiscal_year
            AND ot.classification_id = q.classification_id
        WHERE q.org_id = $1
          AND q.classification_id = $2
          AND q.fiscal_year = $3
          AND u.is_active = true
        ORDER BY q.last_ot_event_at ASC NULLS FIRST
        "#,
        auth.org_id,
        params.classification_id,
        fiscal_year,
    )
    .fetch_all(&pool)
    .await?;

    let views = rows
        .into_iter()
        .map(|r| OtQueueView {
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            employee_id: r.employee_id,
            last_ot_event_at: r.last_ot_event_at,
            ot_hours_worked: r.ot_hours_worked,
            ot_hours_declined: r.ot_hours_declined,
        })
        .collect();

    Ok(Json(views))
}

/// Set or clear a user's last_ot_event_at timestamp to control their queue position.
/// Pass last_ot_event_at = null to move the user to the front (never contacted).
pub async fn set_queue_position(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<SetQueuePositionRequest>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_classification(&pool, req.classification_id, auth.org_id).await?;
    org_guard::verify_user(&pool, req.user_id, auth.org_id).await?;

    let fiscal_year = req
        .fiscal_year
        .unwrap_or(crate::services::timezone::current_fiscal_year(
            &auth.org_timezone,
            crate::services::org_settings::get_i64(&pool, auth.org_id, "fiscal_year_start_month", 1)
                .await as u32,
        ));

    sqlx::query!(
        r#"
        INSERT INTO ot_queue_positions
            (id, org_id, classification_id, user_id, last_ot_event_at, fiscal_year, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
        ON CONFLICT (org_id, classification_id, user_id, fiscal_year)
        DO UPDATE SET last_ot_event_at = $4, updated_at = NOW()
        "#,
        auth.org_id,
        req.classification_id,
        req.user_id,
        req.last_ot_event_at as Option<time::OffsetDateTime>,
        fiscal_year,
    )
    .execute(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ---------------------------------------------------------------------------
// OT Hours
// ---------------------------------------------------------------------------

pub async fn get_hours(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<OtHoursQuery>,
) -> Result<Json<Vec<OtHoursView>>> {
    let fiscal_year = params
        .fiscal_year
        .unwrap_or(crate::services::timezone::current_fiscal_year(
            &auth.org_timezone,
            crate::services::org_settings::get_i64(&pool, auth.org_id, "fiscal_year_start_month", 1)
                .await as u32,
        ));

    // Employees can only see their own hours
    if !auth.role.can_manage_schedule() {
        let rows = sqlx::query!(
            r#"
            SELECT
                ot.user_id,
                u.first_name,
                u.last_name,
                ot.classification_id AS "classification_id?",
                cl.name AS "classification_name?",
                ot.fiscal_year,
                CAST(ot.hours_worked AS FLOAT8) AS "hours_worked!",
                CAST(ot.hours_declined AS FLOAT8) AS "hours_declined!"
            FROM ot_hours ot
            JOIN users u ON u.id = ot.user_id
            LEFT JOIN classifications cl ON cl.id = ot.classification_id
            WHERE u.org_id = $1 AND ot.user_id = $2 AND ot.fiscal_year = $3
            ORDER BY u.last_name, u.first_name
            "#,
            auth.org_id,
            auth.id,
            fiscal_year,
        )
        .fetch_all(&pool)
        .await?;

        let views = rows
            .into_iter()
            .map(|r| OtHoursView {
                user_id: r.user_id,
                first_name: r.first_name,
                last_name: r.last_name,
                classification_id: r.classification_id,
                classification_name: r.classification_name,
                fiscal_year: r.fiscal_year,
                hours_worked: r.hours_worked,
                hours_declined: r.hours_declined,
            })
            .collect();

        return Ok(Json(views));
    }

    // Admin/supervisor: optional user filter
    let rows = sqlx::query!(
        r#"
        SELECT
            ot.user_id,
            u.first_name,
            u.last_name,
            ot.classification_id AS "classification_id?",
            cl.name AS "classification_name?",
            ot.fiscal_year,
            CAST(ot.hours_worked AS FLOAT8) AS "hours_worked!",
            CAST(ot.hours_declined AS FLOAT8) AS "hours_declined!"
        FROM ot_hours ot
        JOIN users u ON u.id = ot.user_id
        LEFT JOIN classifications cl ON cl.id = ot.classification_id
        WHERE u.org_id = $1
          AND ot.fiscal_year = $2
          AND ($3::UUID IS NULL OR ot.user_id = $3)
          AND ($4::UUID IS NULL OR ot.classification_id = $4 OR (ot.classification_id IS NULL AND $4 IS NULL))
        ORDER BY u.last_name, u.first_name
        "#,
        auth.org_id,
        fiscal_year,
        params.user_id as Option<Uuid>,
        params.classification_id as Option<Uuid>,
    )
    .fetch_all(&pool)
    .await?;

    let views = rows
        .into_iter()
        .map(|r| OtHoursView {
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            classification_id: r.classification_id,
            classification_name: r.classification_name,
            fiscal_year: r.fiscal_year,
            hours_worked: r.hours_worked,
            hours_declined: r.hours_declined,
        })
        .collect();

    Ok(Json(views))
}

pub async fn adjust_hours(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<AdjustOtHoursRequest>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    org_guard::verify_user(&pool, req.user_id, auth.org_id).await?;

    let worked_delta = req.hours_worked_delta.unwrap_or(0.0);
    let declined_delta = req.hours_declined_delta.unwrap_or(0.0);

    if worked_delta == 0.0 && declined_delta == 0.0 {
        return Err(AppError::BadRequest(
            "At least one of hours_worked_delta or hours_declined_delta must be non-zero".into(),
        ));
    }

    sqlx::query!(
        r#"
        INSERT INTO ot_hours
            (id, user_id, fiscal_year, classification_id, hours_worked, hours_declined)
        VALUES (gen_random_uuid(), $1, $2, $3, $4::FLOAT8::NUMERIC, $5::FLOAT8::NUMERIC)
        ON CONFLICT (user_id, fiscal_year,
            COALESCE(classification_id,
                     '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET
            hours_worked   = GREATEST(ot_hours.hours_worked   + $4::FLOAT8::NUMERIC, 0),
            hours_declined = GREATEST(ot_hours.hours_declined + $5::FLOAT8::NUMERIC, 0),
            updated_at     = NOW()
        "#,
        req.user_id,
        req.fiscal_year,
        req.classification_id as Option<Uuid>,
        worked_delta,
        declined_delta,
    )
    .execute(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ---------------------------------------------------------------------------
// Volunteers
// ---------------------------------------------------------------------------

pub async fn volunteer(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Any authenticated user can volunteer for their org's callout
    let event = sqlx::query!(
        r#"
        SELECT ce.id, ce.status AS "status: CalloutStatus"
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        WHERE ce.id = $1 AND ss.org_id = $2
        "#,
        event_id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;
    if event.status != CalloutStatus::Open {
        return Err(AppError::BadRequest(
            "Callout event is not open for volunteers".into(),
        ));
    }

    sqlx::query!(
        r#"
        INSERT INTO ot_volunteers (id, org_id, callout_event_id, user_id, volunteered_at)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW())
        ON CONFLICT (callout_event_id, user_id) DO NOTHING
        "#,
        auth.org_id,
        event_id,
        auth.id,
    )
    .execute(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_volunteers(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<OtVolunteer>>> {
    // Verify event belongs to org
    sqlx::query_scalar!(
        r#"
        SELECT ce.id
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        WHERE ce.id = $1 AND ss.org_id = $2
        "#,
        event_id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;

    let volunteers = sqlx::query!(
        r#"
        SELECT v.id, v.callout_event_id, v.user_id,
               u.first_name, u.last_name,
               v.volunteered_at
        FROM ot_volunteers v
        JOIN users u ON u.id = v.user_id
        WHERE v.callout_event_id = $1 AND v.org_id = $2
        ORDER BY v.volunteered_at ASC
        "#,
        event_id,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let views = volunteers
        .into_iter()
        .map(|r| OtVolunteer {
            id: r.id,
            callout_event_id: r.callout_event_id,
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            volunteered_at: r.volunteered_at,
        })
        .collect();

    Ok(Json(views))
}

// ---------------------------------------------------------------------------
// Step Management
// ---------------------------------------------------------------------------

pub async fn advance_step(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(event_id): Path<Uuid>,
    Json(req): Json<AdvanceStepRequest>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let mut tx = pool.begin().await?;

    // Verify the event belongs to the org and is open (lock row)
    let event = sqlx::query!(
        r#"
        SELECT ce.status AS "status: CalloutStatus",
               ce.current_step AS "current_step?: CalloutStep"
        FROM callout_events ce
        JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
        WHERE ce.id = $1 AND ss.org_id = $2
        FOR UPDATE OF ce
        "#,
        event_id,
        auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Callout event not found".into()))?;
    if event.status != CalloutStatus::Open {
        return Err(AppError::BadRequest("Callout event is not open".into()));
    }

    // Enforce strict 5-step ordering
    let expected = match event.current_step {
        None => CalloutStep::Volunteers,
        Some(CalloutStep::Volunteers) => CalloutStep::LowOtHours,
        Some(CalloutStep::LowOtHours) => CalloutStep::InverseSeniority,
        Some(CalloutStep::InverseSeniority) => CalloutStep::EqualOtHours,
        Some(CalloutStep::EqualOtHours) => CalloutStep::Mandatory,
        Some(CalloutStep::Mandatory) => {
            return Err(AppError::BadRequest(
                "All callout steps have been completed".into(),
            ))
        }
    };
    if req.step != expected {
        return Err(AppError::BadRequest(format!(
            "Next step must be {:?}; got {:?}",
            expected, req.step
        )));
    }

    sqlx::query!(
        r#"
        UPDATE callout_events
        SET current_step = $2::callout_step, step_started_at = NOW(), updated_at = NOW()
        WHERE id = $1
        "#,
        event_id,
        req.step as CalloutStep,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
