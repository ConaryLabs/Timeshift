//! Org-boundary validation helpers.
//!
//! Every function verifies that a given resource belongs to the caller's
//! organization and returns `AppError::NotFound` if it doesn't (we don't
//! reveal that the resource exists in another org).

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, Result};

fn check_exists(ok: Option<bool>, entity: &str) -> Result<()> {
    if !ok.unwrap_or(false) {
        return Err(AppError::NotFound(format!("{entity} not found")));
    }
    Ok(())
}

pub async fn verify_user(pool: &PgPool, user_id: Uuid, org_id: Uuid) -> Result<()> {
    let ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND org_id = $2 AND is_active = true)",
        user_id,
        org_id
    )
    .fetch_one(pool)
    .await?;
    check_exists(ok, "User")
}

pub async fn verify_scheduled_shift(pool: &PgPool, shift_id: Uuid, org_id: Uuid) -> Result<()> {
    let ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM scheduled_shifts WHERE id = $1 AND org_id = $2)",
        shift_id,
        org_id
    )
    .fetch_one(pool)
    .await?;
    check_exists(ok, "Scheduled shift")
}

pub async fn verify_shift_template(pool: &PgPool, template_id: Uuid, org_id: Uuid) -> Result<()> {
    let ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM shift_templates WHERE id = $1 AND org_id = $2)",
        template_id,
        org_id
    )
    .fetch_one(pool)
    .await?;
    check_exists(ok, "Shift template")
}

pub async fn verify_classification(pool: &PgPool, class_id: Uuid, org_id: Uuid) -> Result<()> {
    let ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM classifications WHERE id = $1 AND org_id = $2)",
        class_id,
        org_id
    )
    .fetch_one(pool)
    .await?;
    check_exists(ok, "Classification")
}

pub async fn verify_slot(pool: &PgPool, slot_id: Uuid, org_id: Uuid) -> Result<()> {
    let ok = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM shift_slots ss
            JOIN teams t ON t.id = ss.team_id
            WHERE ss.id = $1 AND t.org_id = $2
        )
        "#,
        slot_id,
        org_id
    )
    .fetch_one(pool)
    .await?;
    check_exists(ok, "Shift slot")
}

pub async fn verify_ot_reason(pool: &PgPool, reason_id: Uuid, org_id: Uuid) -> Result<()> {
    let ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM ot_reasons WHERE id = $1 AND org_id = $2)",
        reason_id,
        org_id
    )
    .fetch_one(pool)
    .await?;
    check_exists(ok, "OT reason")
}

pub async fn verify_ot_request(pool: &PgPool, ot_request_id: Uuid, org_id: Uuid) -> Result<()> {
    let ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM ot_requests WHERE id = $1 AND org_id = $2)",
        ot_request_id,
        org_id
    )
    .fetch_one(pool)
    .await?;
    check_exists(ok, "OT request")
}

pub async fn verify_period(pool: &PgPool, period_id: Uuid, org_id: Uuid) -> Result<()> {
    let ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM schedule_periods WHERE id = $1 AND org_id = $2)",
        period_id,
        org_id
    )
    .fetch_one(pool)
    .await?;
    check_exists(ok, "Schedule period")
}
