use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::schedule::{
        BulkUpsertSlotsRequest, CoveragePlan, CoveragePlanAssignment, CoveragePlanSlot,
        CoveragePlanView, CreateCoveragePlanAssignmentRequest, CreateCoveragePlanRequest,
        SlotCoverage, UpdateCoveragePlanRequest,
    },
    org_guard,
};

// ── Plan CRUD ─────────────────────────────────────────────────────────────────

pub async fn list_plans(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<CoveragePlanView>>> {
    let rows = sqlx::query!(
        r#"
        SELECT
            cp.id,
            cp.org_id,
            cp.name,
            cp.description,
            cp.is_default,
            cp.is_active,
            cp.created_by,
            cp.created_at,
            cp.updated_at,
            COUNT(DISTINCT cps.id) AS "slot_count!",
            COUNT(DISTINCT cpa.id) AS "assignment_count!"
        FROM coverage_plans cp
        LEFT JOIN coverage_plan_slots       cps ON cps.plan_id = cp.id
        LEFT JOIN coverage_plan_assignments cpa ON cpa.plan_id = cp.id
        WHERE cp.org_id = $1
        GROUP BY cp.id
        ORDER BY cp.is_default DESC, cp.name
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    let views = rows
        .into_iter()
        .map(|r| CoveragePlanView {
            id: r.id,
            org_id: r.org_id,
            name: r.name,
            description: r.description,
            is_default: r.is_default,
            is_active: r.is_active,
            slot_count: r.slot_count,
            assignment_count: r.assignment_count,
            created_by: r.created_by,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(views))
}

pub async fn get_plan(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<CoveragePlan>> {
    let row = sqlx::query_as!(
        CoveragePlan,
        r#"
        SELECT id, org_id, name, description, is_default, is_active,
               created_by, created_at, updated_at
        FROM coverage_plans
        WHERE id = $1 AND org_id = $2
        "#,
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Coverage plan not found".into()))?;

    Ok(Json(row))
}

pub async fn create_plan(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateCoveragePlanRequest>,
) -> Result<Json<CoveragePlan>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    if req.is_default {
        let mut tx = pool.begin().await?;

        sqlx::query!(
            "UPDATE coverage_plans SET is_default = FALSE, updated_at = NOW()
             WHERE org_id = $1 AND is_default = TRUE",
            auth.org_id,
        )
        .execute(&mut *tx)
        .await?;

        let r = sqlx::query_as!(
            CoveragePlan,
            r#"
            INSERT INTO coverage_plans (org_id, name, description, is_default, created_by)
            VALUES ($1, $2, $3, TRUE, $4)
            RETURNING id, org_id, name, description, is_default, is_active,
                      created_by, created_at, updated_at
            "#,
            auth.org_id,
            req.name,
            req.description,
            auth.id,
        )
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(Json(r))
    } else {
        let r = sqlx::query_as!(
            CoveragePlan,
            r#"
            INSERT INTO coverage_plans (org_id, name, description, is_default, created_by)
            VALUES ($1, $2, $3, FALSE, $4)
            RETURNING id, org_id, name, description, is_default, is_active,
                      created_by, created_at, updated_at
            "#,
            auth.org_id,
            req.name,
            req.description,
            auth.id,
        )
        .fetch_one(&pool)
        .await?;

        Ok(Json(r))
    }
}

pub async fn update_plan(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateCoveragePlanRequest>,
) -> Result<Json<CoveragePlan>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let existing = sqlx::query!(
        "SELECT is_default FROM coverage_plans WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Coverage plan not found".into()))?;

    let new_is_default = req.is_default.unwrap_or(existing.is_default);

    if new_is_default && !existing.is_default {
        let mut tx = pool.begin().await?;

        sqlx::query!(
            "UPDATE coverage_plans SET is_default = FALSE, updated_at = NOW()
             WHERE org_id = $1 AND is_default = TRUE AND id != $2",
            auth.org_id,
            id,
        )
        .execute(&mut *tx)
        .await?;

        let r = sqlx::query_as!(
            CoveragePlan,
            r#"
            UPDATE coverage_plans
            SET name        = COALESCE($3, name),
                description = COALESCE($4, description),
                is_default  = $5,
                is_active   = COALESCE($6, is_active),
                updated_at  = NOW()
            WHERE id = $1 AND org_id = $2
            RETURNING id, org_id, name, description, is_default, is_active,
                      created_by, created_at, updated_at
            "#,
            id,
            auth.org_id,
            req.name,
            req.description,
            new_is_default,
            req.is_active,
        )
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(Json(r))
    } else {
        let r = sqlx::query_as!(
            CoveragePlan,
            r#"
            UPDATE coverage_plans
            SET name        = COALESCE($3, name),
                description = COALESCE($4, description),
                is_default  = $5,
                is_active   = COALESCE($6, is_active),
                updated_at  = NOW()
            WHERE id = $1 AND org_id = $2
            RETURNING id, org_id, name, description, is_default, is_active,
                      created_by, created_at, updated_at
            "#,
            id,
            auth.org_id,
            req.name,
            req.description,
            new_is_default,
            req.is_active,
        )
        .fetch_one(&pool)
        .await?;

        Ok(Json(r))
    }
}

pub async fn delete_plan(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "DELETE FROM coverage_plans WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Coverage plan not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Slot Configuration ────────────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct SlotQuery {
    pub classification_id: Option<Uuid>,
    pub day_of_week: Option<i16>,
}

pub async fn list_slots(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(plan_id): Path<Uuid>,
    Query(q): Query<SlotQuery>,
) -> Result<Json<Vec<CoveragePlanSlot>>> {
    verify_plan_org(&pool, plan_id, auth.org_id).await?;

    let rows = sqlx::query_as!(
        CoveragePlanSlot,
        r#"
        SELECT id, plan_id, classification_id, day_of_week, slot_index,
               min_headcount, target_headcount, max_headcount
        FROM coverage_plan_slots
        WHERE plan_id = $1
          AND ($2::uuid IS NULL OR classification_id = $2)
          AND ($3::smallint IS NULL OR day_of_week = $3)
        ORDER BY day_of_week, classification_id, slot_index
        "#,
        plan_id,
        q.classification_id,
        q.day_of_week,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

/// Bulk upsert: for each distinct (classification_id, day_of_week) group in the
/// request, delete existing rows and insert the new ones. Groups not in the
/// request are untouched.
pub async fn bulk_upsert_slots(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(plan_id): Path<Uuid>,
    Json(req): Json<BulkUpsertSlotsRequest>,
) -> Result<Json<Vec<CoveragePlanSlot>>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    verify_plan_org(&pool, plan_id, auth.org_id).await?;

    if req.slots.is_empty() {
        return Ok(Json(vec![]));
    }

    // Validate all entries and collect distinct classification IDs to verify
    let mut seen_classifications = std::collections::HashSet::new();
    for s in &req.slots {
        if s.slot_index < 0 || s.slot_index > 47 {
            return Err(AppError::BadRequest(format!(
                "slot_index {} out of range 0-47",
                s.slot_index
            )));
        }
        if s.day_of_week < 0 || s.day_of_week > 6 {
            return Err(AppError::BadRequest(format!(
                "day_of_week {} out of range 0-6",
                s.day_of_week
            )));
        }
        if s.min_headcount < 0 {
            return Err(AppError::BadRequest(
                "Headcounts must be non-negative".into(),
            ));
        }
        if s.min_headcount > s.target_headcount || s.target_headcount > s.max_headcount {
            return Err(AppError::BadRequest(
                "Must have min <= target <= max for all slots".into(),
            ));
        }
        seen_classifications.insert(s.classification_id);
    }

    for class_id in &seen_classifications {
        org_guard::verify_classification(&pool, *class_id, auth.org_id).await?;
    }

    // Collect distinct groups to replace
    let groups: std::collections::HashSet<(Uuid, i16)> = req
        .slots
        .iter()
        .map(|s| (s.classification_id, s.day_of_week))
        .collect();

    let mut tx = pool.begin().await?;

    for (class_id, dow) in &groups {
        sqlx::query!(
            "DELETE FROM coverage_plan_slots
             WHERE plan_id = $1 AND classification_id = $2 AND day_of_week = $3",
            plan_id,
            class_id,
            *dow,
        )
        .execute(&mut *tx)
        .await?;
    }

    // Bulk insert using UNNEST
    let ids: Vec<Uuid> = req.slots.iter().map(|_| Uuid::new_v4()).collect();
    let plan_ids: Vec<Uuid> = req.slots.iter().map(|_| plan_id).collect();
    let class_ids: Vec<Uuid> = req.slots.iter().map(|s| s.classification_id).collect();
    let dows: Vec<i16> = req.slots.iter().map(|s| s.day_of_week).collect();
    let slot_idxs: Vec<i16> = req.slots.iter().map(|s| s.slot_index).collect();
    let mins: Vec<i16> = req.slots.iter().map(|s| s.min_headcount).collect();
    let targets: Vec<i16> = req.slots.iter().map(|s| s.target_headcount).collect();
    let maxes: Vec<i16> = req.slots.iter().map(|s| s.max_headcount).collect();

    let rows = sqlx::query_as!(
        CoveragePlanSlot,
        r#"
        INSERT INTO coverage_plan_slots
            (id, plan_id, classification_id, day_of_week, slot_index,
             min_headcount, target_headcount, max_headcount)
        SELECT * FROM UNNEST(
            $1::uuid[], $2::uuid[], $3::uuid[],
            $4::smallint[], $5::smallint[],
            $6::smallint[], $7::smallint[], $8::smallint[]
        )
        RETURNING id, plan_id, classification_id, day_of_week, slot_index,
                  min_headcount, target_headcount, max_headcount
        "#,
        &ids,
        &plan_ids,
        &class_ids,
        &dows,
        &slot_idxs,
        &mins,
        &targets,
        &maxes,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

// ── Plan Assignments (date ranges) ────────────────────────────────────────────

pub async fn list_assignments(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<CoveragePlanAssignment>>> {
    let rows = sqlx::query_as!(
        CoveragePlanAssignment,
        r#"
        SELECT id, org_id, plan_id, start_date, end_date, notes, created_by, created_at
        FROM coverage_plan_assignments
        WHERE org_id = $1
        ORDER BY start_date DESC
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateCoveragePlanAssignmentRequest>,
) -> Result<Json<CoveragePlanAssignment>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    verify_plan_org(&pool, req.plan_id, auth.org_id).await?;

    if let Some(end) = req.end_date {
        if end < req.start_date {
            return Err(AppError::BadRequest(
                "end_date must be >= start_date".into(),
            ));
        }
    }

    let row = sqlx::query_as!(
        CoveragePlanAssignment,
        r#"
        INSERT INTO coverage_plan_assignments
            (org_id, plan_id, start_date, end_date, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, org_id, plan_id, start_date, end_date, notes, created_by, created_at
        "#,
        auth.org_id,
        req.plan_id,
        req.start_date,
        req.end_date,
        req.notes,
        auth.id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(row))
}

pub async fn delete_assignment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !auth.role.is_admin() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "DELETE FROM coverage_plan_assignments WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id,
    )
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Assignment not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Coverage Resolution ───────────────────────────────────────────────────────

/// GET /api/coverage-plans/resolved/:date
///
/// Returns per-slot coverage for the given date using the active plan.
/// Includes actual headcount computed from shift assignments.
pub async fn resolved_coverage(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(date_str): Path<String>,
) -> Result<Json<Vec<SlotCoverage>>> {
    let result = compute_slot_coverage(&pool, auth.org_id, &date_str).await?;
    Ok(Json(result))
}

/// Shared logic for computing per-slot coverage. Used by the resolved endpoint
/// and can be called from schedule.rs handlers.
pub(crate) async fn compute_slot_coverage(
    pool: &PgPool,
    org_id: Uuid,
    date_str: &str,
) -> Result<Vec<SlotCoverage>> {
    let date = time::Date::parse(
        date_str,
        &time::format_description::parse("[year]-[month]-[day]")
            .map_err(|_| AppError::BadRequest("invalid date format".into()))?,
    )
    .map_err(|_| AppError::BadRequest(format!("invalid date: {date_str}")))?;

    let plan_id = match resolve_plan_id(pool, org_id, date).await? {
        Some(id) => id,
        None => return Ok(vec![]),
    };

    let dow = date.weekday().number_days_from_sunday() as i16;

    // Fetch slot requirements for this plan + day of week
    let slots = sqlx::query!(
        r#"
        SELECT
            cps.slot_index,
            cps.classification_id,
            cl.abbreviation AS classification_abbreviation,
            cps.min_headcount,
            cps.target_headcount,
            cps.max_headcount
        FROM coverage_plan_slots cps
        JOIN classifications cl ON cl.id = cps.classification_id
        WHERE cps.plan_id = $1 AND cps.day_of_week = $2
        ORDER BY cps.classification_id, cps.slot_index
        "#,
        plan_id,
        dow,
    )
    .fetch_all(pool)
    .await?;

    if slots.is_empty() {
        return Ok(vec![]);
    }

    // Fetch all active shift assignments for this date
    let assignments = sqlx::query!(
        r#"
        SELECT
            u.classification_id AS "classification_id?",
            st.start_time,
            st.end_time,
            st.crosses_midnight
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates  st ON st.id = ss.shift_template_id
        JOIN users            u  ON u.id  = a.user_id
        WHERE ss.org_id = $1 AND ss.date = $2
          AND a.cancelled_at IS NULL
        "#,
        org_id,
        date,
    )
    .fetch_all(pool)
    .await?;

    // Fetch overnight shifts from the previous day that spill into this date
    let prev_date = date.previous_day().unwrap_or(date);
    let overnight = sqlx::query!(
        r#"
        SELECT
            u.classification_id AS "classification_id?",
            st.end_time
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates  st ON st.id = ss.shift_template_id
        JOIN users            u  ON u.id  = a.user_id
        WHERE ss.org_id = $1 AND ss.date = $2
          AND st.crosses_midnight = true
          AND a.cancelled_at IS NULL
        "#,
        org_id,
        prev_date,
    )
    .fetch_all(pool)
    .await?;

    // Build actual headcount map: (classification_id, slot_index) -> count
    use std::collections::HashMap;
    let mut actual: HashMap<(Uuid, i16), i32> = HashMap::new();

    for a in &assignments {
        let Some(class_id) = a.classification_id else {
            continue;
        };

        let start_min = a.start_time.hour() as i32 * 60 + a.start_time.minute() as i32;
        let end_min = if a.crosses_midnight {
            24 * 60
        } else {
            a.end_time.hour() as i32 * 60 + a.end_time.minute() as i32
        };

        let start_slot = (start_min / 30) as i16;
        let end_slot = if end_min % 30 == 0 {
            (end_min / 30 - 1) as i16
        } else {
            (end_min / 30) as i16
        };
        let end_slot = end_slot.clamp(0, 47);

        for slot in start_slot..=end_slot {
            *actual.entry((class_id, slot)).or_insert(0) += 1;
        }
    }

    // Add overnight shift morning contributions (00:00 to end_time on this date)
    for a in &overnight {
        let Some(class_id) = a.classification_id else {
            continue;
        };
        let end_min = a.end_time.hour() as i32 * 60 + a.end_time.minute() as i32;
        if end_min == 0 {
            continue; // Ends exactly at midnight — no morning contribution
        }
        let end_slot = if end_min % 30 == 0 {
            (end_min / 30 - 1) as i16
        } else {
            (end_min / 30) as i16
        };
        let end_slot = end_slot.clamp(0, 47);
        for slot in 0..=end_slot {
            *actual.entry((class_id, slot)).or_insert(0) += 1;
        }
    }

    let result = slots
        .into_iter()
        .map(|s| {
            let count = actual
                .get(&(s.classification_id, s.slot_index))
                .copied()
                .unwrap_or(0);
            let status = if s.target_headcount == 0 || count >= s.target_headcount as i32 {
                "green"
            } else if count >= s.min_headcount as i32 {
                "yellow"
            } else {
                "red"
            };
            SlotCoverage {
                slot_index: s.slot_index,
                classification_id: s.classification_id,
                classification_abbreviation: s.classification_abbreviation,
                min_headcount: s.min_headcount,
                target_headcount: s.target_headcount,
                max_headcount: s.max_headcount,
                actual_headcount: count,
                status: status.to_string(),
            }
        })
        .collect();

    Ok(result)
}

// ── Shared helpers for schedule.rs integration ─────────────────────────────────

/// Resolve the active coverage plan for a single date.
/// Returns None if no plan is configured for this org.
pub(crate) async fn resolve_plan_id(
    pool: &PgPool,
    org_id: Uuid,
    date: time::Date,
) -> Result<Option<Uuid>> {
    // 1. Check date-range assignments (most recent start_date wins)
    let assigned = sqlx::query_scalar!(
        r#"
        SELECT plan_id AS "plan_id!"
        FROM coverage_plan_assignments cpa
        JOIN coverage_plans cp ON cp.id = cpa.plan_id
        WHERE cpa.org_id = $1
          AND cpa.start_date <= $2
          AND (cpa.end_date IS NULL OR cpa.end_date >= $2)
          AND cp.is_active = TRUE
        ORDER BY cpa.start_date DESC
        LIMIT 1
        "#,
        org_id,
        date,
    )
    .fetch_optional(pool)
    .await?;

    if let Some(id) = assigned {
        return Ok(Some(id));
    }

    // 2. Fallback to org default plan
    let default = sqlx::query_scalar!(
        r#"
        SELECT id AS "id!"
        FROM coverage_plans
        WHERE org_id = $1 AND is_default = TRUE AND is_active = TRUE
        LIMIT 1
        "#,
        org_id,
    )
    .fetch_optional(pool)
    .await?;

    Ok(default)
}

/// Fetch plan slot target totals (summed across all classifications) for a plan + day_of_week.
/// Returns vec of (slot_index, total_target) pairs.
pub(crate) async fn fetch_slot_totals(
    pool: &PgPool,
    plan_id: Uuid,
    dow: i16,
) -> Result<Vec<(i16, i32)>> {
    let rows = sqlx::query!(
        r#"
        SELECT slot_index, CAST(SUM(target_headcount) AS INTEGER) AS "total!"
        FROM coverage_plan_slots
        WHERE plan_id = $1 AND day_of_week = $2
        GROUP BY slot_index
        ORDER BY slot_index
        "#,
        plan_id,
        dow,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| (r.slot_index, r.total)).collect())
}

/// Given per-slot target totals and shift template time ranges,
/// compute coverage_required per shift as the peak total target
/// across all 30-min slots in the shift's time range.
pub(crate) fn coverage_required_for_shifts(
    slot_totals: &[(i16, i32)],
    shifts: &[(Uuid, time::Time, time::Time, bool)],
) -> std::collections::HashMap<Uuid, i32> {
    use std::collections::HashMap;
    let slot_map: HashMap<i16, i32> = slot_totals.iter().copied().collect();

    let mut result = HashMap::new();
    for &(template_id, start_time, end_time, crosses_midnight) in shifts {
        let start_min = start_time.hour() as i32 * 60 + start_time.minute() as i32;
        let end_min = if crosses_midnight {
            24 * 60
        } else {
            end_time.hour() as i32 * 60 + end_time.minute() as i32
        };

        let start_slot = (start_min / 30) as i16;
        let end_slot = if end_min % 30 == 0 {
            ((end_min / 30) - 1) as i16
        } else {
            (end_min / 30) as i16
        };
        let end_slot = end_slot.min(47).max(start_slot);

        let mut max_required = 0i32;
        for slot in start_slot..=end_slot {
            let target = slot_map.get(&slot).copied().unwrap_or(0);
            max_required = max_required.max(target);
        }

        result.insert(template_id, max_required);
    }

    result
}

// ── Internal helper ───────────────────────────────────────────────────────────

async fn verify_plan_org(pool: &PgPool, plan_id: Uuid, org_id: Uuid) -> Result<()> {
    let ok = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM coverage_plans WHERE id = $1 AND org_id = $2)",
        plan_id,
        org_id,
    )
    .fetch_one(pool)
    .await?;

    if !ok.unwrap_or(false) {
        return Err(AppError::NotFound("Coverage plan not found".into()));
    }
    Ok(())
}
