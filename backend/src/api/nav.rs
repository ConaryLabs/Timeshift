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

    let pending_leave = if is_manager {
        sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) AS "count!"
            FROM leave_requests lr
            JOIN users u ON u.id = lr.user_id
            WHERE u.org_id = $1 AND lr.status = 'pending'
            "#,
            auth.org_id,
        )
        .fetch_one(&pool)
        .await?
    } else {
        sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) AS "count!"
            FROM leave_requests
            WHERE user_id = $1 AND status = 'pending'
            "#,
            auth.id,
        )
        .fetch_one(&pool)
        .await?
    };

    let pending_trades = if is_manager {
        sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) AS "count!"
            FROM trade_requests
            WHERE org_id = $1 AND status = 'pending_approval'
            "#,
            auth.org_id,
        )
        .fetch_one(&pool)
        .await?
    } else {
        sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) AS "count!"
            FROM trade_requests
            WHERE partner_id = $1 AND status = 'pending_partner'
            "#,
            auth.id,
        )
        .fetch_one(&pool)
        .await?
    };

    let open_callouts = if is_manager {
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
        .await?
    } else {
        0
    };

    Ok(Json(NavBadges {
        pending_leave,
        pending_trades,
        open_callouts,
    }))
}
