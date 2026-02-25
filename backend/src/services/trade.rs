//! Trade review business logic: state machine, assignment swap, multi-supervisor approval.

use uuid::Uuid;

use crate::error::Result;

/// Fields from a trade request needed for review execution.
pub struct TradeForReview {
    pub id: Uuid,
    pub org_timezone: String,
    pub requester_id: Uuid,
    pub partner_id: Uuid,
    pub requester_assignment_id: Uuid,
    pub partner_assignment_id: Uuid,
}

/// Outcome of executing a trade review decision.
pub enum TradeReviewOutcome {
    /// Trade reached a final status (approved or denied).
    Resolved(String),
    /// Shift starts within 1 hour — review blocked.
    TimingBlocked,
    /// Assignments changed since trade was created — swap failed.
    StaleAssignments,
    /// Multi-supervisor: this reviewer has no pending approval row.
    NotAuthorized,
    /// Multi-supervisor: approved by this reviewer but still waiting on others.
    StillPending,
}

/// Core trade review logic shared by single review and bulk review.
/// Handles timing check, legacy/multi-supervisor paths, and assignment swap.
pub async fn execute_trade_review(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    trade: &TradeForReview,
    reviewer_id: Uuid,
    status: &str,
    reviewer_notes: Option<&str>,
) -> Result<TradeReviewOutcome> {
    // 1-hour approval cutoff: fetch shift dates and start times for both assignments
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
    .fetch_one(&mut **tx)
    .await?;

    let now_utc = time::OffsetDateTime::now_utc();
    for (date_opt, time_opt) in [
        (timing.req_date, timing.req_start),
        (timing.par_date, timing.par_start),
    ] {
        if let (Some(d), Some(t)) = (date_opt, time_opt) {
            let shift_start = crate::services::timezone::local_to_utc(d, t, &trade.org_timezone);
            if (shift_start - now_utc).whole_minutes() < 60 {
                return Ok(TradeReviewOutcome::TimingBlocked);
            }
        }
    }

    // Check for trade_approvals rows to determine legacy vs multi-supervisor path
    let approval_count = sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!" FROM trade_approvals WHERE trade_id = $1"#,
        trade.id,
    )
    .fetch_one(&mut **tx)
    .await?;

    if approval_count == 0 {
        // Legacy path: any supervisor can approve/deny directly
        if status == "approved" {
            let req_rows = sqlx::query!(
                r#"
                UPDATE assignments SET user_id = $2, is_trade = true
                WHERE id = $1 AND user_id = $3
                "#,
                trade.requester_assignment_id,
                trade.partner_id,
                trade.requester_id,
            )
            .execute(&mut **tx)
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
            .execute(&mut **tx)
            .await?
            .rows_affected();

            if req_rows == 0 || partner_rows == 0 {
                return Ok(TradeReviewOutcome::StaleAssignments);
            }

            sqlx::query!(
                r#"
                UPDATE trade_requests
                SET status = 'approved', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                WHERE id = $1
                "#,
                trade.id,
                reviewer_id,
                reviewer_notes,
            )
            .execute(&mut **tx)
            .await?;
            Ok(TradeReviewOutcome::Resolved("approved".into()))
        } else {
            sqlx::query!(
                r#"
                UPDATE trade_requests
                SET status = 'denied', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                WHERE id = $1
                "#,
                trade.id,
                reviewer_id,
                reviewer_notes,
            )
            .execute(&mut **tx)
            .await?;
            Ok(TradeReviewOutcome::Resolved("denied".into()))
        }
    } else {
        // Multi-supervisor path: only supervisors with a pending approval row can act
        let my_approval = sqlx::query!(
            r#"
            SELECT id FROM trade_approvals
            WHERE trade_id = $1 AND supervisor_id = $2 AND status = 'pending'
            "#,
            trade.id,
            reviewer_id,
        )
        .fetch_optional(&mut **tx)
        .await?;

        let my_approval = match my_approval {
            Some(a) => a,
            None => return Ok(TradeReviewOutcome::NotAuthorized),
        };

        // Record this supervisor's decision
        sqlx::query!(
            r#"
            UPDATE trade_approvals
            SET status = $2, reviewed_at = NOW(), reviewer_notes = $3
            WHERE id = $1
            "#,
            my_approval.id,
            status,
            reviewer_notes,
        )
        .execute(&mut **tx)
        .await?;

        if status == "denied" {
            sqlx::query!(
                r#"
                UPDATE trade_requests
                SET status = 'denied', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                WHERE id = $1
                "#,
                trade.id,
                reviewer_id,
                reviewer_notes,
            )
            .execute(&mut **tx)
            .await?;
            Ok(TradeReviewOutcome::Resolved("denied".into()))
        } else {
            let remaining = sqlx::query_scalar!(
                r#"
                SELECT COUNT(*) AS "count!"
                FROM trade_approvals
                WHERE trade_id = $1 AND status != 'approved'
                "#,
                trade.id,
            )
            .fetch_one(&mut **tx)
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
                .execute(&mut **tx)
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
                .execute(&mut **tx)
                .await?
                .rows_affected();

                if req_rows == 0 || partner_rows == 0 {
                    return Ok(TradeReviewOutcome::StaleAssignments);
                }

                sqlx::query!(
                    r#"
                    UPDATE trade_requests
                    SET status = 'approved', reviewed_by = $2, reviewer_notes = $3, updated_at = NOW()
                    WHERE id = $1
                    "#,
                    trade.id,
                    reviewer_id,
                    reviewer_notes,
                )
                .execute(&mut **tx)
                .await?;
                Ok(TradeReviewOutcome::Resolved("approved".into()))
            } else {
                Ok(TradeReviewOutcome::StillPending)
            }
        }
    }
}
