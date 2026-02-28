use axum::{extract::State, Json};
use serde::Serialize;
use sqlx::PgPool;

use crate::auth::{AuthUser, Role};
use crate::error::Result;

#[derive(Debug, Serialize)]
pub struct NavBadges {
    pub pending_leave: i64,
    pub pending_trades: i64,
    pub open_callouts: i64,
}

pub async fn badges(State(pool): State<PgPool>, auth: AuthUser) -> Result<Json<NavBadges>> {
    let is_manager = matches!(auth.role, Role::Admin | Role::Supervisor);

    let fut_pending_leave = async {
        if is_manager {
            sqlx::query_scalar!(
                r#"
                SELECT COUNT(*) AS "count!"
                FROM leave_requests lr
                WHERE lr.org_id = $1 AND lr.status = 'pending'
                "#,
                auth.org_id,
            )
            .fetch_one(&pool)
            .await
        } else {
            sqlx::query_scalar!(
                r#"
                SELECT COUNT(*) AS "count!"
                FROM leave_requests
                WHERE user_id = $1 AND org_id = $2 AND status = 'pending'
                "#,
                auth.id,
                auth.org_id,
            )
            .fetch_one(&pool)
            .await
        }
    };

    let fut_pending_trades = async {
        if is_manager {
            sqlx::query_scalar!(
                r#"
                SELECT COUNT(*) AS "count!"
                FROM trade_requests
                WHERE org_id = $1 AND status = 'pending_approval'
                "#,
                auth.org_id,
            )
            .fetch_one(&pool)
            .await
        } else {
            sqlx::query_scalar!(
                r#"
                SELECT COUNT(*) AS "count!"
                FROM trade_requests
                WHERE partner_id = $1 AND org_id = $2 AND status = 'pending_partner'
                "#,
                auth.id,
                auth.org_id,
            )
            .fetch_one(&pool)
            .await
        }
    };

    let fut_open_callouts = async {
        if is_manager {
            sqlx::query_scalar!(
                r#"
                SELECT COUNT(*) AS "count!"
                FROM callout_events ce
                JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id
                WHERE ss.org_id = $1 AND ce.status = 'open'
                "#,
                auth.org_id,
            )
            .fetch_one(&pool)
            .await
        } else {
            Ok::<i64, sqlx::Error>(0)
        }
    };

    let (pending_leave, pending_trades, open_callouts) =
        tokio::try_join!(fut_pending_leave, fut_pending_trades, fut_open_callouts)?;

    Ok(Json(NavBadges {
        pending_leave,
        pending_trades,
        open_callouts,
    }))
}
