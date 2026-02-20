use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use rand_core::OsRng;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::{AuthUser, Role},
    error::{AppError, Result},
    models::user::{CreateUserRequest, EmployeeType, UpdateUserRequest, UserProfile},
    org_guard,
};

#[derive(Debug, serde::Deserialize)]
pub struct UserListParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub include_inactive: Option<bool>,
}

impl UserListParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(100).clamp(1, 500)
    }
    pub fn offset(&self) -> i64 {
        self.offset.unwrap_or(0).max(0)
    }
}

pub async fn list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(params): Query<UserListParams>,
) -> Result<Json<Vec<UserProfile>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let active_only = !params.include_inactive.unwrap_or(false);

    let rows = sqlx::query!(
        r#"
        SELECT u.id, u.org_id, u.employee_id, u.first_name, u.last_name, u.email, u.phone,
               u.role AS "role: Role",
               u.classification_id,
               c.name AS "classification_name?",
               u.employee_type AS "employee_type: EmployeeType",
               u.hire_date, u.seniority_date, u.is_active
        FROM users u
        LEFT JOIN classifications c ON c.id = u.classification_id
        WHERE u.org_id = $1 AND ($4 = false OR u.is_active = true)
        ORDER BY u.last_name, u.first_name
        LIMIT $2 OFFSET $3
        "#,
        auth.org_id,
        params.limit(),
        params.offset(),
        active_only,
    )
    .fetch_all(&pool)
    .await?;

    let profiles = rows
        .into_iter()
        .map(|r| UserProfile {
            id: r.id,
            org_id: r.org_id,
            employee_id: r.employee_id,
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
            phone: r.phone,
            role: r.role,
            classification_id: r.classification_id,
            classification_name: r.classification_name,
            employee_type: r.employee_type,
            hire_date: r.hire_date,
            seniority_date: r.seniority_date,
            is_active: r.is_active,
        })
        .collect();

    Ok(Json(profiles))
}

pub async fn get_one(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<UserProfile>> {
    if !auth.role.can_manage_schedule() && auth.id != id {
        return Err(AppError::Forbidden);
    }

    let r = sqlx::query!(
        r#"
        SELECT u.id, u.org_id, u.employee_id, u.first_name, u.last_name, u.email, u.phone,
               u.role AS "role: Role",
               u.classification_id,
               c.name AS "classification_name?",
               u.employee_type AS "employee_type: EmployeeType",
               u.hire_date, u.seniority_date, u.is_active
        FROM users u
        LEFT JOIN classifications c ON c.id = u.classification_id
        WHERE u.id = $1 AND u.org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(UserProfile {
        id: r.id,
        org_id: r.org_id,
        employee_id: r.employee_id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        classification_id: r.classification_id,
        classification_name: r.classification_name,
        employee_type: r.employee_type,
        hire_date: r.hire_date,
        seniority_date: r.seniority_date,
        is_active: r.is_active,
    }))
}

pub async fn create(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateUserRequest>,
) -> Result<Json<UserProfile>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Verify optional classification belongs to caller's org
    if let Some(cid) = req.classification_id {
        org_guard::verify_classification(&pool, cid, auth.org_id).await?;
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hashing failed: {}", e)))?
        .to_string();

    let employee_type = req.employee_type.unwrap_or(EmployeeType::RegularFullTime);

    let r = sqlx::query!(
        r#"
        INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, phone,
                           password_hash, role, classification_id, employee_type, hire_date, seniority_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, org_id, employee_id, first_name, last_name, email, phone,
                  role AS "role: Role",
                  classification_id,
                  employee_type AS "employee_type: EmployeeType",
                  hire_date, seniority_date, is_active
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.employee_id,
        req.first_name,
        req.last_name,
        req.email,
        req.phone,
        hash,
        req.role as Role,
        req.classification_id,
        employee_type as EmployeeType,
        req.hire_date,
        req.seniority_date,
    )
    .fetch_one(&pool)
    .await?;

    // Fetch classification name if set
    let classification_name = if let Some(cid) = r.classification_id {
        sqlx::query_scalar!("SELECT name FROM classifications WHERE id = $1", cid)
            .fetch_optional(&pool)
            .await?
    } else {
        None
    };

    Ok(Json(UserProfile {
        id: r.id,
        org_id: r.org_id,
        employee_id: r.employee_id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        classification_id: r.classification_id,
        classification_name,
        employee_type: r.employee_type,
        hire_date: r.hire_date,
        seniority_date: r.seniority_date,
        is_active: r.is_active,
    }))
}

pub async fn update(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateUserRequest>,
) -> Result<Json<UserProfile>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Prevent self-demotion
    if auth.id == id {
        if let Some(new_role) = &req.role {
            if !new_role.is_admin() {
                return Err(AppError::BadRequest(
                    "Cannot change your own role. Another admin must do this.".into(),
                ));
            }
        }
    }

    // Prevent demoting the last admin in the org
    if let Some(new_role) = &req.role {
        if !new_role.is_admin() {
            let admin_count = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM users WHERE org_id = $1 AND role = 'admin' AND is_active = true",
                auth.org_id
            )
            .fetch_one(&pool)
            .await?
            .unwrap_or(0);

            if admin_count <= 1 {
                return Err(AppError::BadRequest(
                    "Cannot remove the last admin. Promote another user to admin first.".into(),
                ));
            }
        }
    }

    // Verify optional classification belongs to caller's org
    if let Some(Some(cid)) = req.classification_id {
        org_guard::verify_classification(&pool, cid, auth.org_id).await?;
    }

    // For nullable fields using double-Option:
    //   None         => field not sent, keep existing  ($provided = false)
    //   Some(None)   => explicitly null, clear value   ($provided = true, $value = NULL)
    //   Some(Some(v))=> set to v                       ($provided = true, $value = v)
    let phone_provided = req.phone.is_some();
    let phone_val = req.phone.flatten();
    let class_provided = req.classification_id.is_some();
    let class_val = req.classification_id.flatten();
    let empid_provided = req.employee_id.is_some();
    let empid_val = req.employee_id.flatten();
    let hire_provided = req.hire_date.is_some();
    let hire_val = req.hire_date.flatten();
    let seniority_provided = req.seniority_date.is_some();
    let seniority_val = req.seniority_date.flatten();

    let r = sqlx::query!(
        r#"
        UPDATE users
        SET first_name        = COALESCE($2, first_name),
            last_name         = COALESCE($3, last_name),
            email             = COALESCE($4, email),
            phone             = CASE WHEN $5 THEN $6 ELSE phone END,
            classification_id = CASE WHEN $7 THEN $8 ELSE classification_id END,
            employee_id       = CASE WHEN $9 THEN $10 ELSE employee_id END,
            role              = COALESCE($11, role),
            employee_type     = COALESCE($12, employee_type),
            hire_date         = CASE WHEN $13 THEN $14 ELSE hire_date END,
            seniority_date    = CASE WHEN $15 THEN $16 ELSE seniority_date END,
            updated_at        = NOW()
        WHERE id = $1 AND org_id = $17
        RETURNING id, org_id, employee_id, first_name, last_name, email, phone,
                  role AS "role: Role",
                  classification_id,
                  employee_type AS "employee_type: EmployeeType",
                  hire_date, seniority_date, is_active
        "#,
        id,
        req.first_name.as_deref(),
        req.last_name.as_deref(),
        req.email.as_deref(),
        phone_provided,
        phone_val.as_deref(),
        class_provided,
        class_val,
        empid_provided,
        empid_val.as_deref(),
        req.role as Option<Role>,
        req.employee_type as Option<EmployeeType>,
        hire_provided,
        hire_val,
        seniority_provided,
        seniority_val,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    let classification_name = if let Some(cid) = r.classification_id {
        sqlx::query_scalar!("SELECT name FROM classifications WHERE id = $1", cid)
            .fetch_optional(&pool)
            .await?
    } else {
        None
    };

    Ok(Json(UserProfile {
        id: r.id,
        org_id: r.org_id,
        employee_id: r.employee_id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        classification_id: r.classification_id,
        classification_name,
        employee_type: r.employee_type,
        hire_date: r.hire_date,
        seniority_date: r.seniority_date,
        is_active: r.is_active,
    }))
}

pub async fn deactivate(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Prevent self-deactivation
    if auth.id == id {
        return Err(AppError::BadRequest(
            "Cannot deactivate your own account. Another admin must do this.".into(),
        ));
    }

    // Prevent deactivating the last admin in the org
    let target_role = sqlx::query_scalar!(
        r#"SELECT role AS "role: Role" FROM users WHERE id = $1 AND org_id = $2"#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    if target_role.is_admin() {
        let admin_count = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM users WHERE org_id = $1 AND role = 'admin' AND is_active = true",
            auth.org_id
        )
        .fetch_one(&pool)
        .await?
        .unwrap_or(0);

        if admin_count <= 1 {
            return Err(AppError::BadRequest(
                "Cannot deactivate the last admin. Promote another user to admin first.".into(),
            ));
        }
    }

    let rows = sqlx::query!(
        "UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("User not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
