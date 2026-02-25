use axum::{extract::State, Json};
use sqlx::PgPool;

use crate::{auth::AuthUser, error::Result};

#[derive(Debug, serde::Serialize)]
pub struct BargainingUnitRecord {
    pub id: uuid::Uuid,
    pub code: String,
    pub name: String,
    pub is_active: bool,
}

/// GET /api/bargaining-units
/// List bargaining units for the authenticated user's org.
pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<BargainingUnitRecord>>> {
    let rows = sqlx::query_as!(
        BargainingUnitRecord,
        r#"
        SELECT id, code, name, is_active
        FROM bargaining_units
        WHERE org_id = $1 AND is_active = true
        ORDER BY code
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}
