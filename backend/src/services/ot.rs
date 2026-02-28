//! OT tracking helpers: fiscal year resolution, hours upsert/revert, queue stamping.

use sqlx::PgPool;
use uuid::Uuid;

/// Resolve the fiscal year for a given date using the org's `fiscal_year_start_month` setting.
pub async fn org_fiscal_year(pool: &PgPool, org_id: Uuid, date: time::Date) -> i32 {
    let fy_start =
        crate::services::org_settings::get_i64(pool, org_id, "fiscal_year_start_month", 1).await
            as u32;
    crate::services::timezone::fiscal_year_for_date(date, fy_start)
}

/// Increment `ot_hours.hours_worked` for a user/fiscal_year/classification, inserting if absent.
pub async fn upsert_ot_hours_worked(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    fiscal_year: i32,
    classification_id: Uuid,
    hours: f64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO ot_hours
            (id, user_id, fiscal_year, classification_id, hours_worked, hours_declined)
        VALUES (gen_random_uuid(), $1, $2, $4, $3::FLOAT8::NUMERIC, 0)
        ON CONFLICT (user_id, fiscal_year,
            COALESCE(classification_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET
            hours_worked = ot_hours.hours_worked + $3::FLOAT8::NUMERIC,
            updated_at   = NOW()
        "#,
        user_id,
        fiscal_year,
        hours,
        classification_id,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Increment `ot_hours.hours_declined` for a user/fiscal_year/classification, inserting if absent.
pub async fn upsert_ot_hours_declined(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    fiscal_year: i32,
    classification_id: Uuid,
    hours: f64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO ot_hours
            (id, user_id, fiscal_year, classification_id, hours_worked, hours_declined)
        VALUES (gen_random_uuid(), $1, $2, $4, 0, $3::FLOAT8::NUMERIC)
        ON CONFLICT (user_id, fiscal_year,
            COALESCE(classification_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET
            hours_declined = ot_hours.hours_declined + $3::FLOAT8::NUMERIC,
            updated_at     = NOW()
        "#,
        user_id,
        fiscal_year,
        hours,
        classification_id,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Decrement `ot_hours.hours_worked` (floored at zero) when an OT assignment is cancelled.
pub async fn revert_ot_hours_worked(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    fiscal_year: i32,
    classification_id: Option<Uuid>,
    hours: f64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE ot_hours
        SET hours_worked = GREATEST(ot_hours.hours_worked - $3::FLOAT8::NUMERIC, 0::NUMERIC),
            updated_at = NOW()
        WHERE user_id = $1 AND fiscal_year = $2
          AND COALESCE(classification_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE($4, '00000000-0000-0000-0000-000000000000'::uuid)
        "#,
        user_id,
        fiscal_year,
        hours,
        classification_id,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Stamp an employee's OT queue position with the current time.
/// CBA: After any OT contact (accepted or declined), the employee moves to the back
/// of the queue. NULL last_ot_event_at = never contacted = highest priority.
/// (VCCEA Article 15 — OT distribution by lowest-hours-first, then queue position.)
pub async fn stamp_ot_queue(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    org_id: Uuid,
    classification_id: Uuid,
    user_id: Uuid,
    fiscal_year: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO ot_queue_positions
            (id, org_id, classification_id, user_id, last_ot_event_at, fiscal_year, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW(), $4, NOW())
        ON CONFLICT (org_id, classification_id, user_id, fiscal_year)
        DO UPDATE SET last_ot_event_at = NOW(), updated_at = NOW()
        "#,
        org_id,
        classification_id,
        user_id,
        fiscal_year,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}
