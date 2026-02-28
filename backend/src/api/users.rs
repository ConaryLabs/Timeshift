use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
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
    models::user::{
        CreateUserRequest, EmployeeStatus, EmployeeType, UpdateUserRequest, UserProfile,
    },
    org_guard,
};

/// Intermediate struct used to construct UserProfile from query rows.
/// Replaces the 24-argument `build_user_profile` function — named fields prevent
/// positional-arg ordering mistakes at call sites.
struct UserProfileRow {
    id: Uuid,
    org_id: Uuid,
    employee_id: Option<String>,
    first_name: String,
    last_name: String,
    email: String,
    phone: Option<String>,
    role: Role,
    classification_id: Option<Uuid>,
    classification_name: Option<String>,
    employee_type: EmployeeType,
    bargaining_unit: String,
    hire_date: Option<time::Date>,
    overall_seniority_date: Option<time::Date>,
    bargaining_unit_seniority_date: Option<time::Date>,
    classification_seniority_date: Option<time::Date>,
    cto_designation: bool,
    admin_training_supervisor_since: Option<time::Date>,
    employee_status: EmployeeStatus,
    accrual_paused_since: Option<time::Date>,
    leave_accrual_paused_at: Option<time::Date>,
    medical_ot_exempt: bool,
    is_active: bool,
    updated_at: time::OffsetDateTime,
}

impl From<UserProfileRow> for UserProfile {
    fn from(r: UserProfileRow) -> Self {
        UserProfile {
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
            bargaining_unit: r.bargaining_unit,
            hire_date: r.hire_date,
            overall_seniority_date: r.overall_seniority_date,
            bargaining_unit_seniority_date: r.bargaining_unit_seniority_date,
            classification_seniority_date: r.classification_seniority_date,
            cto_designation: r.cto_designation,
            admin_training_supervisor_since: r.admin_training_supervisor_since,
            employee_status: r.employee_status,
            accrual_paused_since: r.accrual_paused_since,
            leave_accrual_paused_at: r.leave_accrual_paused_at,
            medical_ot_exempt: r.medical_ot_exempt,
            is_active: r.is_active,
            updated_at: r.updated_at,
        }
    }
}

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
               u.bargaining_unit,
               u.hire_date,
               sr.overall_seniority_date AS "overall_seniority_date?",
               sr.bargaining_unit_seniority_date AS "bargaining_unit_seniority_date?",
               sr.classification_seniority_date AS "classification_seniority_date?",
               u.cto_designation, u.admin_training_supervisor_since,
               u.employee_status AS "employee_status: EmployeeStatus",
               sr.accrual_pause_started_at AS "accrual_paused_since?",
               u.leave_accrual_paused_at AS "leave_accrual_paused_at?",
               u.medical_ot_exempt,
               u.is_active,
               u.updated_at
        FROM users u
        LEFT JOIN classifications c ON c.id = u.classification_id
        LEFT JOIN seniority_records sr ON sr.user_id = u.id
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
        .map(|r| {
            UserProfileRow {
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
                bargaining_unit: r.bargaining_unit,
                hire_date: r.hire_date,
                overall_seniority_date: r.overall_seniority_date,
                bargaining_unit_seniority_date: r.bargaining_unit_seniority_date,
                classification_seniority_date: r.classification_seniority_date,
                cto_designation: r.cto_designation,
                admin_training_supervisor_since: r.admin_training_supervisor_since,
                employee_status: r.employee_status,
                accrual_paused_since: r.accrual_paused_since,
                leave_accrual_paused_at: r.leave_accrual_paused_at,
                medical_ot_exempt: r.medical_ot_exempt,
                is_active: r.is_active,
                updated_at: r.updated_at,
            }
            .into()
        })
        .collect();

    Ok(Json(profiles))
}

/// Lightweight user directory (id + name) accessible to all authenticated users.
/// Used for trade partner selection, assignment lookups, etc.
#[derive(Debug, serde::Serialize)]
pub struct UserDirectoryEntry {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
}

pub async fn directory(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<UserDirectoryEntry>>> {
    let rows = sqlx::query_as!(
        UserDirectoryEntry,
        r#"
        SELECT id, first_name, last_name
        FROM users
        WHERE org_id = $1 AND is_active = true
        ORDER BY last_name, first_name
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
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
               u.bargaining_unit,
               u.hire_date,
               sr.overall_seniority_date AS "overall_seniority_date?",
               sr.bargaining_unit_seniority_date AS "bargaining_unit_seniority_date?",
               sr.classification_seniority_date AS "classification_seniority_date?",
               u.cto_designation, u.admin_training_supervisor_since,
               u.employee_status AS "employee_status: EmployeeStatus",
               sr.accrual_pause_started_at AS "accrual_paused_since?",
               u.leave_accrual_paused_at AS "leave_accrual_paused_at?",
               u.medical_ot_exempt,
               u.is_active,
               u.updated_at
        FROM users u
        LEFT JOIN classifications c ON c.id = u.classification_id
        LEFT JOIN seniority_records sr ON sr.user_id = u.id
        WHERE u.id = $1 AND u.org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(
        UserProfileRow {
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
            bargaining_unit: r.bargaining_unit,
            hire_date: r.hire_date,
            overall_seniority_date: r.overall_seniority_date,
            bargaining_unit_seniority_date: r.bargaining_unit_seniority_date,
            classification_seniority_date: r.classification_seniority_date,
            cto_designation: r.cto_designation,
            admin_training_supervisor_since: r.admin_training_supervisor_since,
            employee_status: r.employee_status,
            accrual_paused_since: r.accrual_paused_since,
            leave_accrual_paused_at: r.leave_accrual_paused_at,
            medical_ot_exempt: r.medical_ot_exempt,
            is_active: r.is_active,
            updated_at: r.updated_at,
        }
        .into(),
    ))
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
    let bargaining_unit = req
        .bargaining_unit
        .unwrap_or_else(|| "non_represented".to_string());

    let user_id = Uuid::new_v4();

    let r = sqlx::query!(
        r#"
        INSERT INTO users (id, org_id, employee_id, first_name, last_name, email, phone,
                           password_hash, role, classification_id, employee_type,
                           bargaining_unit, hire_date,
                           cto_designation, admin_training_supervisor_since,
                           medical_ot_exempt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id, org_id, employee_id, first_name, last_name, email, phone,
                  role AS "role: Role",
                  classification_id,
                  employee_type AS "employee_type: EmployeeType",
                  bargaining_unit,
                  hire_date,
                  cto_designation, admin_training_supervisor_since,
                  employee_status AS "employee_status: EmployeeStatus",
                  medical_ot_exempt,
                  is_active,
                  updated_at
        "#,
        user_id,
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
        bargaining_unit,
        req.hire_date,
        req.cto_designation.unwrap_or(false),
        req.admin_training_supervisor_since,
        req.medical_ot_exempt.unwrap_or(false),
    )
    .fetch_one(&pool)
    .await?;

    // Upsert seniority_records if any seniority date was provided
    let (s_overall, s_bu, s_class) = (
        req.overall_seniority_date,
        req.bargaining_unit_seniority_date,
        req.classification_seniority_date,
    );
    if s_overall.is_some() || s_bu.is_some() || s_class.is_some() {
        sqlx::query!(
            r#"
            INSERT INTO seniority_records (user_id, org_id, overall_seniority_date,
                                           bargaining_unit_seniority_date, classification_seniority_date)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                overall_seniority_date         = EXCLUDED.overall_seniority_date,
                bargaining_unit_seniority_date = EXCLUDED.bargaining_unit_seniority_date,
                classification_seniority_date  = EXCLUDED.classification_seniority_date,
                updated_at                     = NOW()
            "#,
            r.id,
            auth.org_id,
            s_overall,
            s_bu,
            s_class,
        )
        .execute(&pool)
        .await?;
    }

    // CBA compliance: new hires enter the OT queue at the TOP (NULL last_ot_event_at = highest
    // priority, per NULLS FIRST ordering). This ensures they get called first to equalize hours.
    if let Some(cid) = r.classification_id {
        let fiscal_year = crate::services::ot::org_fiscal_year(&pool, auth.org_id,
            crate::services::timezone::org_today(&auth.org_timezone)).await;
        sqlx::query!(
            r#"
            INSERT INTO ot_queue_positions
                (id, org_id, classification_id, user_id, last_ot_event_at, fiscal_year, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, NULL, $4, NOW())
            ON CONFLICT (org_id, classification_id, user_id, fiscal_year) DO NOTHING
            "#,
            auth.org_id,
            cid,
            r.id,
            fiscal_year,
        )
        .execute(&pool)
        .await?;
    }

    // Fetch seniority record for response
    let sr = sqlx::query!(
        "SELECT overall_seniority_date, bargaining_unit_seniority_date, classification_seniority_date,
                accrual_pause_started_at
         FROM seniority_records WHERE user_id = $1",
        r.id
    )
    .fetch_optional(&pool)
    .await?;

    // Fetch classification name if set
    let classification_name = if let Some(cid) = r.classification_id {
        sqlx::query_scalar!("SELECT name FROM classifications WHERE id = $1", cid)
            .fetch_optional(&pool)
            .await?
    } else {
        None
    };

    Ok(Json(
        UserProfileRow {
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
            bargaining_unit: r.bargaining_unit,
            hire_date: r.hire_date,
            overall_seniority_date: sr.as_ref().and_then(|s| s.overall_seniority_date),
            bargaining_unit_seniority_date: sr
                .as_ref()
                .and_then(|s| s.bargaining_unit_seniority_date),
            classification_seniority_date: sr
                .as_ref()
                .and_then(|s| s.classification_seniority_date),
            cto_designation: r.cto_designation,
            admin_training_supervisor_since: r.admin_training_supervisor_since,
            employee_status: r.employee_status,
            accrual_paused_since: sr.as_ref().and_then(|s| s.accrual_pause_started_at),
            leave_accrual_paused_at: None,
            medical_ot_exempt: r.medical_ot_exempt,
            is_active: r.is_active,
            updated_at: r.updated_at,
        }
        .into(),
    ))
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

    // Verify optional classification belongs to caller's org
    if let Some(Some(cid)) = req.classification_id {
        org_guard::verify_classification(&pool, cid, auth.org_id).await?;
    }

    // Optimistic locking: check if the record has been modified since the client last fetched it
    if let Some(expected) = req.expected_updated_at {
        let current = sqlx::query_scalar!(
            "SELECT updated_at FROM users WHERE id = $1 AND org_id = $2",
            id,
            auth.org_id
        )
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

        if current != expected {
            return Err(AppError::Conflict(
                "This record has been modified by another user. Please refresh and try again."
                    .into(),
            ));
        }
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
    let admin_sup_provided = req.admin_training_supervisor_since.is_some();
    let admin_sup_val = req.admin_training_supervisor_since.flatten();

    let mut tx = pool.begin().await?;

    // Prevent demoting the last admin in the org — check inside tx with row locking
    if let Some(new_role) = &req.role {
        if !new_role.is_admin() {
            // Only apply last-admin protection if the target is currently an admin
            let target_is_admin: bool = sqlx::query_scalar!(
                "SELECT (role = 'admin') FROM users WHERE id = $1 AND org_id = $2",
                id,
                auth.org_id,
            )
            .fetch_optional(&mut *tx)
            .await?
            .flatten()
            .unwrap_or(false);

            if target_is_admin {
                // Lock all admin rows to prevent concurrent demotion (TOCTOU)
                let admin_ids: Vec<Uuid> = sqlx::query_scalar!(
                    "SELECT id FROM users WHERE org_id = $1 AND role = 'admin' AND is_active = true FOR UPDATE",
                    auth.org_id
                )
                .fetch_all(&mut *tx)
                .await?;

                if admin_ids.len() <= 1 {
                    return Err(AppError::BadRequest(
                        "Cannot remove the last admin. Promote another user to admin first.".into(),
                    ));
                }
            }
        }
    }

    let r = sqlx::query!(
        r#"
        UPDATE users
        SET first_name                       = COALESCE($2, first_name),
            last_name                        = COALESCE($3, last_name),
            email                            = COALESCE($4, email),
            phone                            = CASE WHEN $5 THEN $6 ELSE phone END,
            classification_id                = CASE WHEN $7 THEN $8 ELSE classification_id END,
            employee_id                      = CASE WHEN $9 THEN $10 ELSE employee_id END,
            role                             = COALESCE($11, role),
            employee_type                    = COALESCE($12, employee_type),
            hire_date                        = CASE WHEN $13 THEN $14 ELSE hire_date END,
            bargaining_unit                  = COALESCE($16, bargaining_unit),
            cto_designation                  = COALESCE($17, cto_designation),
            admin_training_supervisor_since  = CASE WHEN $18 THEN $19 ELSE admin_training_supervisor_since END,
            employee_status                  = COALESCE($20, employee_status),
            medical_ot_exempt                = COALESCE($21, medical_ot_exempt),
            updated_at                       = NOW()
        WHERE id = $1 AND org_id = $15
        RETURNING id, org_id, employee_id, first_name, last_name, email, phone,
                  role AS "role: Role",
                  classification_id,
                  employee_type AS "employee_type: EmployeeType",
                  bargaining_unit,
                  hire_date,
                  cto_designation, admin_training_supervisor_since,
                  employee_status AS "employee_status: EmployeeStatus",
                  medical_ot_exempt,
                  is_active,
                  updated_at
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
        auth.org_id,
        req.bargaining_unit,
        req.cto_designation,
        admin_sup_provided,
        admin_sup_val,
        req.employee_status as Option<EmployeeStatus>,
        req.medical_ot_exempt,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Upsert seniority_records if any seniority date was provided
    let overall_provided = req.overall_seniority_date.is_some();
    let overall_val = req.overall_seniority_date.flatten();
    let bu_provided = req.bargaining_unit_seniority_date.is_some();
    let bu_val = req.bargaining_unit_seniority_date.flatten();
    let class_s_provided = req.classification_seniority_date.is_some();
    let class_s_val = req.classification_seniority_date.flatten();

    if overall_provided || bu_provided || class_s_provided {
        sqlx::query!(
            r#"
            INSERT INTO seniority_records (user_id, org_id, overall_seniority_date,
                                           bargaining_unit_seniority_date, classification_seniority_date)
            VALUES ($1, $2,
                CASE WHEN $3 THEN $4::DATE ELSE NULL END,
                CASE WHEN $5 THEN $6::DATE ELSE NULL END,
                CASE WHEN $7 THEN $8::DATE ELSE NULL END
            )
            ON CONFLICT (user_id) DO UPDATE SET
                overall_seniority_date         = CASE WHEN $3 THEN $4::DATE ELSE seniority_records.overall_seniority_date END,
                bargaining_unit_seniority_date = CASE WHEN $5 THEN $6::DATE ELSE seniority_records.bargaining_unit_seniority_date END,
                classification_seniority_date  = CASE WHEN $7 THEN $8::DATE ELSE seniority_records.classification_seniority_date END,
                updated_at                     = NOW()
            "#,
            r.id,
            auth.org_id,
            overall_provided,
            overall_val,
            bu_provided,
            bu_val,
            class_s_provided,
            class_s_val,
        )
        .execute(&mut *tx)
        .await?;
    }

    // Seniority and leave accrual pause / resume logic
    if let Some(new_status) = &req.employee_status {
        let is_pausing = matches!(
            new_status,
            EmployeeStatus::UnpaidLoa | EmployeeStatus::Lwop | EmployeeStatus::Layoff
        );
        let is_exception = req.seniority_pause_exception.unwrap_or(false);

        let org_today = crate::services::timezone::org_today(&auth.org_timezone);
        if is_pausing && !is_exception {
            // Start a new seniority pause (only if not already paused — preserve original start date)
            sqlx::query!(
                r#"
                INSERT INTO seniority_records (user_id, org_id, accrual_pause_started_at)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id) DO UPDATE SET
                    accrual_pause_started_at = CASE
                        WHEN seniority_records.accrual_pause_started_at IS NULL
                        THEN $3
                        ELSE seniority_records.accrual_pause_started_at
                    END,
                    updated_at = NOW()
                "#,
                r.id,
                auth.org_id,
                org_today,
            )
            .execute(&mut *tx)
            .await?;
            // Pause leave accrual
            sqlx::query!(
                "UPDATE users SET leave_accrual_paused_at = $2
                 WHERE id = $1 AND leave_accrual_paused_at IS NULL",
                r.id,
                org_today,
            )
            .execute(&mut *tx)
            .await?;
        } else if matches!(new_status, EmployeeStatus::Active) {
            // Resume: advance seniority dates by the days paused, then clear the pause marker
            sqlx::query!(
                r#"
                UPDATE seniority_records SET
                    overall_seniority_date = CASE
                        WHEN accrual_pause_started_at IS NOT NULL AND overall_seniority_date IS NOT NULL
                        THEN overall_seniority_date + ($2 - accrual_pause_started_at)::INT
                        ELSE overall_seniority_date
                    END,
                    bargaining_unit_seniority_date = CASE
                        WHEN accrual_pause_started_at IS NOT NULL AND bargaining_unit_seniority_date IS NOT NULL
                        THEN bargaining_unit_seniority_date + ($2 - accrual_pause_started_at)::INT
                        ELSE bargaining_unit_seniority_date
                    END,
                    classification_seniority_date = CASE
                        WHEN accrual_pause_started_at IS NOT NULL AND classification_seniority_date IS NOT NULL
                        THEN classification_seniority_date + ($2 - accrual_pause_started_at)::INT
                        ELSE classification_seniority_date
                    END,
                    accrual_paused_days_total = accrual_paused_days_total + CASE
                        WHEN accrual_pause_started_at IS NOT NULL
                        THEN ($2 - accrual_pause_started_at)::INT
                        ELSE 0
                    END,
                    accrual_pause_started_at = NULL,
                    updated_at = NOW()
                WHERE user_id = $1
                "#,
                r.id,
                org_today,
            )
            .execute(&mut *tx)
            .await?;
            // Resume leave accrual
            sqlx::query!(
                "UPDATE users SET leave_accrual_paused_at = NULL WHERE id = $1",
                r.id,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    // M324: Separation handling — auto-cancel or flag pending trades
    if matches!(req.employee_status, Some(EmployeeStatus::Separated)) {
        let today = crate::services::timezone::org_today(&auth.org_timezone);
        let cutoff = today + time::Duration::days(30);

        // Auto-cancel trades whose earliest shift is more than 30 days out
        sqlx::query!(
            r#"
            UPDATE trade_requests SET status = 'cancelled', updated_at = NOW()
            WHERE (requester_id = $1 OR partner_id = $1)
              AND status IN ('pending_partner', 'pending_approval')
              AND LEAST(requester_date, partner_date) > $2
              AND org_id = $3
            "#,
            id,
            cutoff,
            auth.org_id,
        )
        .execute(&mut *tx)
        .await?;

        // Flag trades ≤30 days out for payroll deduction review
        sqlx::query!(
            r#"
            UPDATE trade_requests
            SET reviewer_notes = COALESCE(reviewer_notes || E'\n', '') ||
                    'PAYROLL: Employee separated — deduction may apply',
                updated_at = NOW()
            WHERE (requester_id = $1 OR partner_id = $1)
              AND status IN ('pending_partner', 'pending_approval', 'approved')
              AND LEAST(requester_date, partner_date) <= $2
              AND org_id = $3
            "#,
            id,
            cutoff,
            auth.org_id,
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // Fetch seniority record for response
    let sr = sqlx::query!(
        "SELECT overall_seniority_date, bargaining_unit_seniority_date, classification_seniority_date,
                accrual_pause_started_at
         FROM seniority_records WHERE user_id = $1",
        r.id
    )
    .fetch_optional(&pool)
    .await?;

    let classification_name = if let Some(cid) = r.classification_id {
        sqlx::query_scalar!("SELECT name FROM classifications WHERE id = $1", cid)
            .fetch_optional(&pool)
            .await?
    } else {
        None
    };

    let leave_accrual_paused_at = sqlx::query_scalar!(
        "SELECT leave_accrual_paused_at FROM users WHERE id = $1",
        r.id
    )
    .fetch_optional(&pool)
    .await?
    .flatten();

    Ok(Json(
        UserProfileRow {
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
            bargaining_unit: r.bargaining_unit,
            hire_date: r.hire_date,
            overall_seniority_date: sr.as_ref().and_then(|s| s.overall_seniority_date),
            bargaining_unit_seniority_date: sr
                .as_ref()
                .and_then(|s| s.bargaining_unit_seniority_date),
            classification_seniority_date: sr
                .as_ref()
                .and_then(|s| s.classification_seniority_date),
            cto_designation: r.cto_designation,
            admin_training_supervisor_since: r.admin_training_supervisor_since,
            employee_status: r.employee_status,
            accrual_paused_since: sr.as_ref().and_then(|s| s.accrual_pause_started_at),
            leave_accrual_paused_at,
            medical_ot_exempt: r.medical_ot_exempt,
            is_active: r.is_active,
            updated_at: r.updated_at,
        }
        .into(),
    ))
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

    let mut tx = pool.begin().await?;

    // Lock the target user row and check role — inside transaction to prevent TOCTOU
    let target_role = sqlx::query_scalar!(
        r#"SELECT role AS "role: Role" FROM users WHERE id = $1 AND org_id = $2 FOR UPDATE"#,
        id,
        auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Prevent deactivating the last admin in the org
    if target_role.is_admin() {
        // Lock all admin rows to prevent concurrent deactivation (TOCTOU)
        let admin_ids: Vec<Uuid> = sqlx::query_scalar!(
            "SELECT id FROM users WHERE org_id = $1 AND role = 'admin' AND is_active = true FOR UPDATE",
            auth.org_id
        )
        .fetch_all(&mut *tx)
        .await?;

        if admin_ids.len() <= 1 {
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
    .execute(&mut *tx)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("User not found".into()));
    }

    // Cancel pending trade requests involving this user (scoped to org)
    sqlx::query!(
        r#"
        UPDATE trade_requests SET status = 'cancelled', updated_at = NOW()
        WHERE (requester_id = $1 OR partner_id = $1)
          AND status IN ('pending_partner', 'pending_approval')
          AND org_id = $2
        "#,
        id,
        auth.org_id,
    )
    .execute(&mut *tx)
    .await?;

    // Cancel pending leave requests for this user (scoped to org)
    sqlx::query!(
        r#"
        UPDATE leave_requests SET status = 'cancelled', updated_at = NOW()
        WHERE user_id = $1 AND org_id = $2 AND status = 'pending'
        "#,
        id,
        auth.org_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Debug, serde::Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

pub async fn activate(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    // Prevent self-activation (not dangerous, but nonsensical — you're already logged in)
    if auth.id == id {
        return Err(AppError::BadRequest(
            "Cannot activate your own account (you are already active).".into(),
        ));
    }

    let rows = sqlx::query!(
        "UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1 AND org_id = $2 AND is_active = false",
        id,
        auth.org_id
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        // Check if user exists but is already active
        let exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND org_id = $2) AS \"exists!\"",
            id,
            auth.org_id
        )
        .fetch_one(&pool)
        .await?;

        if exists {
            return Err(AppError::BadRequest("User is already active".into()));
        }
        return Err(AppError::NotFound("User not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn change_password(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>> {
    // Validate new password length
    if req.new_password.len() < 8 || req.new_password.len() > 128 {
        return Err(AppError::BadRequest(
            "New password must be between 8 and 128 characters".into(),
        ));
    }

    // Fetch current password hash
    let current_hash = sqlx::query_scalar!(
        "SELECT password_hash FROM users WHERE id = $1 AND org_id = $2",
        auth.id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Verify current password
    let parsed = PasswordHash::new(&current_hash)
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Invalid stored hash")))?;

    Argon2::default()
        .verify_password(req.current_password.as_bytes(), &parsed)
        .map_err(|_| AppError::BadRequest("Current password is incorrect".into()))?;

    // Hash new password
    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(req.new_password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hashing failed: {}", e)))?
        .to_string();

    // Update password, set password_changed_at (invalidates existing JWTs),
    // and delete all refresh tokens (force re-login on all devices)
    sqlx::query!(
        "UPDATE users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2 AND org_id = $3",
        new_hash,
        auth.id,
        auth.org_id
    )
    .execute(&pool)
    .await?;

    sqlx::query!("DELETE FROM refresh_tokens WHERE user_id = $1", auth.id)
        .execute(&pool)
        .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
