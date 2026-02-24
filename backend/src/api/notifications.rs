use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::notification::{
        Notification, NotificationListQuery, NotificationListResponse, ReadAllResponse,
        UnreadCountResponse,
    },
};

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<NotificationListQuery>,
) -> Result<Json<NotificationListResponse>> {
    let unread_only = params.unread_only.unwrap_or(false);

    let notifications = sqlx::query!(
        r#"
        SELECT id, org_id, user_id, notification_type, title, message,
               link, source_type, source_id, is_read, created_at, read_at
        FROM notifications
        WHERE user_id = $1 AND org_id = $2
          AND (NOT $3::BOOL OR is_read = FALSE)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        "#,
        auth.id,
        auth.org_id,
        unread_only,
        params.limit(),
        params.offset(),
    )
    .fetch_all(&pool)
    .await?;

    let total = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM notifications
        WHERE user_id = $1 AND org_id = $2
          AND (NOT $3::BOOL OR is_read = FALSE)
        "#,
        auth.id,
        auth.org_id,
        unread_only,
    )
    .fetch_one(&pool)
    .await?;

    let unread_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM notifications
        WHERE user_id = $1 AND org_id = $2 AND is_read = FALSE
        "#,
        auth.id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    let result = notifications
        .into_iter()
        .map(|n| Notification {
            id: n.id,
            org_id: n.org_id,
            user_id: n.user_id,
            notification_type: n.notification_type,
            title: n.title,
            message: n.message,
            link: n.link,
            source_type: n.source_type,
            source_id: n.source_id,
            is_read: n.is_read,
            created_at: n.created_at,
            read_at: n.read_at,
        })
        .collect();

    Ok(Json(NotificationListResponse {
        notifications: result,
        total,
        unread_count,
    }))
}

pub async fn unread_count(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<UnreadCountResponse>> {
    let count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM notifications
        WHERE user_id = $1 AND org_id = $2 AND is_read = FALSE
        "#,
        auth.id,
        auth.org_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(UnreadCountResponse { count }))
}

pub async fn mark_read(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Notification>> {
    let n = sqlx::query!(
        r#"
        UPDATE notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE id = $1 AND user_id = $2 AND org_id = $3
        RETURNING id, org_id, user_id, notification_type, title, message,
                  link, source_type, source_id, is_read, created_at, read_at
        "#,
        id,
        auth.id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Notification not found".into()))?;

    Ok(Json(Notification {
        id: n.id,
        org_id: n.org_id,
        user_id: n.user_id,
        notification_type: n.notification_type,
        title: n.title,
        message: n.message,
        link: n.link,
        source_type: n.source_type,
        source_id: n.source_id,
        is_read: n.is_read,
        created_at: n.created_at,
        read_at: n.read_at,
    }))
}

pub async fn mark_all_read(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<ReadAllResponse>> {
    let result = sqlx::query!(
        r#"
        UPDATE notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE user_id = $1 AND org_id = $2 AND is_read = FALSE
        "#,
        auth.id,
        auth.org_id,
    )
    .execute(&pool)
    .await?;

    Ok(Json(ReadAllResponse {
        updated: result.rows_affected() as i64,
    }))
}

pub async fn delete(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let rows = sqlx::query!(
        "DELETE FROM notifications WHERE id = $1 AND user_id = $2 AND org_id = $3",
        id,
        auth.id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Notification not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn create_notification(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    notification_type: &str,
    title: &str,
    message: &str,
    link: Option<&str>,
    source_type: Option<&str>,
    source_id: Option<Uuid>,
) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO notifications (id, org_id, user_id, notification_type, title, message, link, source_type, source_id)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
        "#,
        org_id,
        user_id,
        notification_type,
        title,
        message,
        link,
        source_type,
        source_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}
