//! Bid window auto-advance logic: expired windows get marked and next window unlocked.

use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::error::Result;

/// Check for expired bid windows and auto-advance them.
/// An expired window is one where closes_at has passed, the user never submitted,
/// and it hasn't already been auto-advanced. For each, we mark auto_advanced_at
/// and unlock the next seniority rank window (same cascade as approve).
pub async fn advance_expired_windows(pool: &PgPool, period_id: Uuid) -> Result<()> {
    let now = OffsetDateTime::now_utc();

    let mut tx = pool.begin().await?;

    let expired = sqlx::query!(
        r#"
        SELECT id, period_id, seniority_rank
        FROM bid_windows
        WHERE period_id = $1
          AND submitted_at IS NULL
          AND auto_advanced_at IS NULL
          AND closes_at < $2
        ORDER BY seniority_rank ASC
        FOR UPDATE
        "#,
        period_id,
        now,
    )
    .fetch_all(&mut *tx)
    .await?;

    if expired.is_empty() {
        return Ok(());
    }

    for w in &expired {
        sqlx::query!(
            "UPDATE bid_windows SET auto_advanced_at = $2 WHERE id = $1",
            w.id,
            now,
        )
        .execute(&mut *tx)
        .await?;

        // Unlock next seniority rank window if not already unlocked
        sqlx::query!(
            r#"
            UPDATE bid_windows SET unlocked_at = $3
            WHERE period_id = $1 AND seniority_rank = $2 AND unlocked_at IS NULL
            "#,
            w.period_id,
            w.seniority_rank + 1,
            now,
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(())
}
