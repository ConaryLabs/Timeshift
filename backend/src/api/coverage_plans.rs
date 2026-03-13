use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    api::helpers::{ensure_rows_affected, json_ok, overnight_end_slot, parse_date, time_to_slot_range},
    auth::AuthUser,
    error::{AppError, Result},
    models::schedule::{
        BlockEmployee, BulkUpsertSlotsRequest, ClassificationBlock, ClassificationGap,
        CoverageBlock, CoveragePlan, CoveragePlanAssignment, CoveragePlanSlot, CoveragePlanView,
        CreateCoveragePlanAssignmentRequest, CreateCoveragePlanRequest, DayGridClassification,
        DayGridResponse, SlotCoverage, UpdateCoveragePlanRequest,
    },
    org_guard,
    AppState,
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

    let mut tx = pool.begin().await?;

    if new_is_default && !existing.is_default {
        sqlx::query!(
            "UPDATE coverage_plans SET is_default = FALSE, updated_at = NOW()
             WHERE org_id = $1 AND is_default = TRUE AND id != $2",
            auth.org_id,
            id,
        )
        .execute(&mut *tx)
        .await?;
    }

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

    ensure_rows_affected(rows, "Coverage plan")?;
    Ok(json_ok())
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
    org_guard::verify_coverage_plan(&pool,plan_id, auth.org_id).await?;

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

    org_guard::verify_coverage_plan(&pool,plan_id, auth.org_id).await?;

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

    org_guard::verify_coverage_plan(&pool,req.plan_id, auth.org_id).await?;

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

    ensure_rows_affected(rows, "Assignment")?;
    Ok(json_ok())
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
    let date = parse_date(date_str)?;

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
            a.user_id,
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
            a.user_id,
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
    use std::collections::{HashMap, HashSet};
    let mut actual: HashMap<(Uuid, i16), i32> = HashMap::new();
    // Track which (user_id, classification_id, slot) are covered by regular assignments
    // so OT doesn't double-count the same person.
    let mut user_slot_covered: HashSet<(Uuid, Uuid, i16)> = HashSet::new();

    for a in &assignments {
        let Some(class_id) = a.classification_id else {
            continue;
        };
        let (start_slot, end_slot) = time_to_slot_range(a.start_time, a.end_time, a.crosses_midnight);
        for slot in start_slot..=end_slot {
            *actual.entry((class_id, slot)).or_insert(0) += 1;
            user_slot_covered.insert((a.user_id, class_id, slot));
        }
    }

    // Add overnight shift morning contributions (00:00 to end_time on this date)
    for a in &overnight {
        let Some(class_id) = a.classification_id else {
            continue;
        };
        let Some(end_slot) = overnight_end_slot(a.end_time) else {
            continue;
        };
        for slot in 0..=end_slot {
            *actual.entry((class_id, slot)).or_insert(0) += 1;
            user_slot_covered.insert((a.user_id, class_id, slot));
        }
    }

    // Add active OT request assignments (mandatory OT, voluntary OT, etc.)
    // These live in ot_request_assignments → ot_requests, separate from regular assignments.
    let ot_assignments = sqlx::query!(
        r#"
        SELECT
            ora.user_id,
            otr.classification_id,
            otr.start_time,
            otr.end_time
        FROM ot_request_assignments ora
        JOIN ot_requests otr ON otr.id = ora.ot_request_id
        WHERE otr.org_id = $1 AND otr.date = $2
          AND ora.cancelled_at IS NULL
          AND otr.status != 'cancelled'
        "#,
        org_id,
        date,
    )
    .fetch_all(pool)
    .await?;

    for ot in &ot_assignments {
        let crosses_midnight = ot.end_time < ot.start_time;
        let (start_slot, end_slot) = time_to_slot_range(ot.start_time, ot.end_time, crosses_midnight);
        for slot in start_slot..=end_slot {
            if !user_slot_covered.contains(&(ot.user_id, ot.classification_id, slot)) {
                *actual.entry((ot.classification_id, slot)).or_insert(0) += 1;
            }
        }
    }

    // Also count OT that crosses midnight from the previous day into today's early slots
    let ot_overnight = sqlx::query!(
        r#"
        SELECT
            ora.user_id,
            otr.classification_id,
            otr.end_time
        FROM ot_request_assignments ora
        JOIN ot_requests otr ON otr.id = ora.ot_request_id
        WHERE otr.org_id = $1 AND otr.date = $2
          AND otr.end_time < otr.start_time
          AND ora.cancelled_at IS NULL
          AND otr.status != 'cancelled'
        "#,
        org_id,
        prev_date,
    )
    .fetch_all(pool)
    .await?;

    for ot in &ot_overnight {
        let Some(end_slot) = overnight_end_slot(ot.end_time) else {
            continue;
        };
        for slot in 0..=end_slot {
            if !user_slot_covered.contains(&(ot.user_id, ot.classification_id, slot)) {
                *actual.entry((ot.classification_id, slot)).or_insert(0) += 1;
            }
        }
    }

    let result = slots
        .into_iter()
        .map(|s| {
            let count = actual
                .get(&(s.classification_id, s.slot_index))
                .copied()
                .unwrap_or(0);
            let status = if s.min_headcount == 0 || count >= s.min_headcount as i32 {
                "green"
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

/// Batch version of `compute_slot_coverage` for multiple dates.
///
/// Reduces N×6 serial DB round-trips (one `compute_slot_coverage` call per date)
/// to ~7 queries total by fetching coverage plan data and assignments for the
/// entire date range at once, then computing per-date slot coverage in memory.
///
/// Returns a map of date → SlotCoverage vec (dates with no coverage plan are absent).
pub(crate) async fn compute_slot_coverage_batch(
    pool: &PgPool,
    org_id: Uuid,
    dates: &[time::Date],
) -> Result<std::collections::HashMap<time::Date, Vec<SlotCoverage>>> {
    use std::collections::{HashMap, HashSet};

    if dates.is_empty() {
        return Ok(HashMap::new());
    }

    let min_date = *dates.iter().min().unwrap();
    let max_date = *dates.iter().max().unwrap();
    let prev_min = min_date.previous_day().unwrap_or(min_date);
    let prev_max = max_date.previous_day().unwrap_or(max_date);

    // 1. Resolve plan_id for each date — fetch all assignments covering the range.
    let plan_assignments = sqlx::query!(
        r#"
        SELECT cpa.plan_id, cpa.start_date, cpa.end_date
        FROM coverage_plan_assignments cpa
        JOIN coverage_plans cp ON cp.id = cpa.plan_id
        WHERE cpa.org_id = $1
          AND cpa.start_date <= $3
          AND (cpa.end_date IS NULL OR cpa.end_date >= $2)
          AND cp.is_active = TRUE
        ORDER BY cpa.start_date DESC
        "#,
        org_id,
        min_date,
        max_date,
    )
    .fetch_all(pool)
    .await?;

    let default_plan_id = sqlx::query_scalar!(
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

    // Map each date to its plan_id (first matching assignment wins due to ORDER BY start_date DESC)
    let mut plan_per_date: HashMap<time::Date, Uuid> = HashMap::new();
    for &d in dates {
        if let Some(pa) = plan_assignments
            .iter()
            .find(|pa| pa.start_date <= d && pa.end_date.map_or(true, |ed| ed >= d))
        {
            plan_per_date.insert(d, pa.plan_id);
        } else if let Some(id) = default_plan_id {
            plan_per_date.insert(d, id);
        }
    }

    if plan_per_date.is_empty() {
        return Ok(HashMap::new());
    }

    // 2. Collect unique plan_ids and day-of-week values needed
    let needed_plan_ids: Vec<Uuid> = plan_per_date
        .values()
        .copied()
        .collect::<HashSet<Uuid>>()
        .into_iter()
        .collect();
    let needed_dows: Vec<i16> = dates
        .iter()
        .map(|d| d.weekday().number_days_from_sunday() as i16)
        .collect::<HashSet<i16>>()
        .into_iter()
        .collect();

    // 3. Fetch coverage plan slots for all needed (plan_id, day_of_week) combinations
    let slot_rows = sqlx::query!(
        r#"
        SELECT
            cps.plan_id,
            cps.slot_index,
            cps.day_of_week,
            cps.classification_id,
            cl.abbreviation AS classification_abbreviation,
            cps.min_headcount,
            cps.target_headcount,
            cps.max_headcount
        FROM coverage_plan_slots cps
        JOIN classifications cl ON cl.id = cps.classification_id
        WHERE cps.plan_id = ANY($1)
          AND cps.day_of_week = ANY($2)
        ORDER BY cps.classification_id, cps.slot_index
        "#,
        &needed_plan_ids as &[Uuid],
        &needed_dows as &[i16],
    )
    .fetch_all(pool)
    .await?;

    // Build slot lookup: (plan_id, day_of_week) → rows
    let mut slots_by_plan_dow: HashMap<(Uuid, i16), Vec<_>> = HashMap::new();
    for s in &slot_rows {
        slots_by_plan_dow
            .entry((s.plan_id, s.day_of_week))
            .or_default()
            .push(s);
    }

    // 4. Fetch all regular assignments for the date range
    let assignment_rows = sqlx::query!(
        r#"
        SELECT
            ss.date,
            a.user_id,
            u.classification_id AS "classification_id?",
            st.start_time,
            st.end_time,
            st.crosses_midnight
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates  st ON st.id = ss.shift_template_id
        JOIN users            u  ON u.id  = a.user_id
        WHERE ss.org_id = $1 AND ss.date BETWEEN $2 AND $3
          AND a.cancelled_at IS NULL
        "#,
        org_id,
        min_date,
        max_date,
    )
    .fetch_all(pool)
    .await?;

    // 5. Fetch overnight assignments from the previous-day range that cross midnight
    let overnight_rows = sqlx::query!(
        r#"
        SELECT
            ss.date AS assign_date,
            a.user_id,
            u.classification_id AS "classification_id?",
            st.end_time
        FROM assignments a
        JOIN scheduled_shifts ss ON ss.id = a.scheduled_shift_id
        JOIN shift_templates  st ON st.id = ss.shift_template_id
        JOIN users            u  ON u.id  = a.user_id
        WHERE ss.org_id = $1 AND ss.date BETWEEN $2 AND $3
          AND st.crosses_midnight = true
          AND a.cancelled_at IS NULL
        "#,
        org_id,
        prev_min,
        prev_max,
    )
    .fetch_all(pool)
    .await?;

    // 6. Fetch OT request assignments for the date range
    let ot_rows = sqlx::query!(
        r#"
        SELECT
            otr.date,
            ora.user_id,
            otr.classification_id,
            otr.start_time,
            otr.end_time
        FROM ot_request_assignments ora
        JOIN ot_requests otr ON otr.id = ora.ot_request_id
        WHERE otr.org_id = $1 AND otr.date BETWEEN $2 AND $3
          AND ora.cancelled_at IS NULL
          AND otr.status != 'cancelled'
        "#,
        org_id,
        min_date,
        max_date,
    )
    .fetch_all(pool)
    .await?;

    // 7. Fetch OT overnight (cross-midnight OT from previous-day range)
    let ot_overnight_rows = sqlx::query!(
        r#"
        SELECT
            otr.date AS assign_date,
            ora.user_id,
            otr.classification_id,
            otr.end_time
        FROM ot_request_assignments ora
        JOIN ot_requests otr ON otr.id = ora.ot_request_id
        WHERE otr.org_id = $1 AND otr.date BETWEEN $2 AND $3
          AND otr.end_time < otr.start_time
          AND ora.cancelled_at IS NULL
          AND otr.status != 'cancelled'
        "#,
        org_id,
        prev_min,
        prev_max,
    )
    .fetch_all(pool)
    .await?;

    // Group pre-fetched data by date for O(1) per-date lookup
    let mut assignments_by_date: HashMap<time::Date, Vec<_>> = HashMap::new();
    for a in &assignment_rows {
        assignments_by_date.entry(a.date).or_default().push(a);
    }

    // overnight rows: indexed by target date (assign_date + 1 day = the date they spill into)
    let mut overnight_by_target: HashMap<time::Date, Vec<_>> = HashMap::new();
    for a in &overnight_rows {
        let target = a.assign_date.next_day().unwrap_or(a.assign_date);
        overnight_by_target.entry(target).or_default().push(a);
    }

    let mut ot_by_date: HashMap<time::Date, Vec<_>> = HashMap::new();
    for a in &ot_rows {
        ot_by_date.entry(a.date).or_default().push(a);
    }

    let mut ot_overnight_by_target: HashMap<time::Date, Vec<_>> = HashMap::new();
    for a in &ot_overnight_rows {
        let target = a.assign_date.next_day().unwrap_or(a.assign_date);
        ot_overnight_by_target.entry(target).or_default().push(a);
    }

    // Compute per-date slot coverage using the same logic as compute_slot_coverage
    let mut result: HashMap<time::Date, Vec<SlotCoverage>> = HashMap::new();

    for &d in dates {
        let plan_id = match plan_per_date.get(&d) {
            Some(&id) => id,
            None => continue,
        };
        let dow = d.weekday().number_days_from_sunday() as i16;
        let slots = match slots_by_plan_dow.get(&(plan_id, dow)) {
            Some(s) if !s.is_empty() => s,
            _ => continue,
        };

        let mut actual: HashMap<(Uuid, i16), i32> = HashMap::new();
        let mut user_slot_covered: HashSet<(Uuid, Uuid, i16)> = HashSet::new();

        // Regular assignments for this date
        if let Some(day_assigns) = assignments_by_date.get(&d) {
            for a in day_assigns.iter() {
                let Some(class_id) = a.classification_id else {
                    continue;
                };
                let (start_slot, end_slot) = time_to_slot_range(a.start_time, a.end_time, a.crosses_midnight);
                for slot in start_slot..=end_slot {
                    *actual.entry((class_id, slot)).or_insert(0) += 1;
                    user_slot_covered.insert((a.user_id, class_id, slot));
                }
            }
        }

        // Overnight assignments from previous day
        if let Some(overnight) = overnight_by_target.get(&d) {
            for a in overnight.iter() {
                let Some(class_id) = a.classification_id else {
                    continue;
                };
                let Some(end_slot) = overnight_end_slot(a.end_time) else {
                    continue;
                };
                for slot in 0..=end_slot {
                    *actual.entry((class_id, slot)).or_insert(0) += 1;
                    user_slot_covered.insert((a.user_id, class_id, slot));
                }
            }
        }

        // OT assignments for this date
        if let Some(ot) = ot_by_date.get(&d) {
            for a in ot.iter() {
                let crosses_midnight = a.end_time < a.start_time;
                let (start_slot, end_slot) = time_to_slot_range(a.start_time, a.end_time, crosses_midnight);
                for slot in start_slot..=end_slot {
                    if !user_slot_covered.contains(&(a.user_id, a.classification_id, slot)) {
                        *actual.entry((a.classification_id, slot)).or_insert(0) += 1;
                    }
                }
            }
        }

        // OT overnight from previous day
        if let Some(ot_overnight) = ot_overnight_by_target.get(&d) {
            for a in ot_overnight.iter() {
                let Some(end_slot) = overnight_end_slot(a.end_time) else {
                    continue;
                };
                for slot in 0..=end_slot {
                    if !user_slot_covered.contains(&(a.user_id, a.classification_id, slot)) {
                        *actual.entry((a.classification_id, slot)).or_insert(0) += 1;
                    }
                }
            }
        }

        let coverage: Vec<SlotCoverage> = slots
            .iter()
            .map(|s| {
                let count = actual
                    .get(&(s.classification_id, s.slot_index))
                    .copied()
                    .unwrap_or(0);
                let status = if s.min_headcount == 0 || count >= s.min_headcount as i32 {
                    "green"
                } else {
                    "red"
                };
                SlotCoverage {
                    slot_index: s.slot_index,
                    classification_id: s.classification_id,
                    classification_abbreviation: s.classification_abbreviation.clone(),
                    min_headcount: s.min_headcount,
                    target_headcount: s.target_headcount,
                    max_headcount: s.max_headcount,
                    actual_headcount: count,
                    status: status.to_string(),
                }
            })
            .collect();

        result.insert(d, coverage);
    }

    Ok(result)
}

// ── Classification Gaps ───────────────────────────────────────────────────────

/// GET /api/coverage-plans/gaps/:date
///
/// Returns per-classification, per-shift gaps where actual < target.
/// Reuses `compute_slot_coverage` to get fine-grained slot coverage,
/// then aggregates by (classification, shift_template) using shift time windows.
pub async fn classification_gaps(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(date_str): Path<String>,
) -> Result<Json<Vec<ClassificationGap>>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let slot_coverage = compute_slot_coverage(&pool, auth.org_id, &date_str).await?;
    if slot_coverage.is_empty() {
        return Ok(Json(vec![]));
    }

    // Fetch active shift templates for this org
    let shifts = sqlx::query!(
        r#"
        SELECT id, name, color, start_time, end_time, crosses_midnight
        FROM shift_templates
        WHERE org_id = $1 AND is_active = true
        ORDER BY start_time
        "#,
        auth.org_id,
    )
    .fetch_all(&pool)
    .await?;

    // Build a lookup: slot_index -> Vec<SlotCoverage>
    use std::collections::HashMap;
    let mut by_slot: HashMap<(Uuid, i16), &SlotCoverage> = HashMap::new();
    for sc in &slot_coverage {
        by_slot.insert((sc.classification_id, sc.slot_index), sc);
    }

    // Collect distinct classification_ids from coverage
    let class_ids: std::collections::HashSet<Uuid> =
        slot_coverage.iter().map(|sc| sc.classification_id).collect();

    let mut gaps: Vec<ClassificationGap> = Vec::new();

    for shift in &shifts {
        let (start_slot, end_slot) = time_to_slot_range(shift.start_time, shift.end_time, shift.crosses_midnight);

        for &class_id in &class_ids {
            // Find the worst single-slot shortage for this classification
            // (compare min vs actual at the same time slot, then take the worst)
            let mut worst_shortage: i16 = 0;
            let mut worst_min: i16 = 0;
            let mut worst_actual: i16 = 0;

            for slot_idx in start_slot..=end_slot {
                if let Some(sc) = by_slot.get(&(class_id, slot_idx)) {
                    let slot_shortage = sc.min_headcount - (sc.actual_headcount as i16);
                    if slot_shortage > worst_shortage {
                        worst_shortage = slot_shortage;
                        worst_min = sc.min_headcount;
                        worst_actual = sc.actual_headcount as i16;
                    }
                }
            }

            if worst_shortage <= 0 {
                continue;
            }

            // Get classification abbreviation from the first matching slot
            let abbr = slot_coverage
                .iter()
                .find(|sc| sc.classification_id == class_id)
                .map(|sc| sc.classification_abbreviation.clone())
                .unwrap_or_default();

            gaps.push(ClassificationGap {
                classification_id: class_id,
                classification_abbreviation: abbr,
                shift_template_id: shift.id,
                shift_name: shift.name.clone(),
                shift_color: shift.color.clone(),
                target: worst_min,
                actual: worst_actual,
                shortage: worst_shortage,
            });
        }
    }

    // Sort by shortage descending (worst gaps first)
    gaps.sort_by(|a, b| b.shortage.cmp(&a.shortage));

    Ok(Json(gaps))
}

// ── Block-level coverage gaps (contiguous time ranges per classification) ─────

/// GET /api/coverage-plans/gaps/:date/blocks
///
/// Returns coverage gaps organized by classification with contiguous time ranges
/// merged. This is the source of truth for notifications and OT pages — it avoids
/// the per-shift duplication where overlapping shifts count the same physical
/// shortage multiple times.
pub async fn gap_blocks(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(date_str): Path<String>,
) -> Result<Json<Vec<crate::models::schedule::ClassificationGapBlocks>>> {
    use crate::models::schedule::{ClassificationGapBlocks, CoverageGapBlock};

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let slot_coverage = compute_slot_coverage(&pool, auth.org_id, &date_str).await?;
    if slot_coverage.is_empty() {
        return Ok(Json(vec![]));
    }

    // Gather classification info and index by (class_id, slot_index)
    use std::collections::HashMap;
    let mut class_info: HashMap<Uuid, String> = HashMap::new();
    let mut by_class_slot: HashMap<Uuid, HashMap<i16, &SlotCoverage>> = HashMap::new();

    for sc in &slot_coverage {
        class_info
            .entry(sc.classification_id)
            .or_insert_with(|| sc.classification_abbreviation.clone());
        by_class_slot
            .entry(sc.classification_id)
            .or_default()
            .insert(sc.slot_index, sc);
    }

    let mut result = Vec::new();

    for (class_id, abbreviation) in &class_info {
        let slots = match by_class_slot.get(class_id) {
            Some(s) => s,
            None => continue,
        };

        // Compute per-slot shortage (slots 0-47)
        let mut shortage_slots: Vec<(i16, i32)> = Vec::new();
        for slot_idx in 0..48i16 {
            if let Some(sc) = slots.get(&slot_idx) {
                let shortage = (sc.min_headcount as i32) - sc.actual_headcount;
                if shortage > 0 {
                    shortage_slots.push((slot_idx, shortage));
                }
            }
        }

        if shortage_slots.is_empty() {
            continue;
        }

        // Find contiguous runs and merge into blocks
        let mut blocks: Vec<CoverageGapBlock> = Vec::new();
        let mut block_start = shortage_slots[0].0;
        let mut block_max = shortage_slots[0].1;
        let mut prev_slot = shortage_slots[0].0;

        for &(slot_idx, shortage) in &shortage_slots[1..] {
            if slot_idx == prev_slot + 1 {
                block_max = block_max.max(shortage);
                prev_slot = slot_idx;
            } else {
                blocks.push(CoverageGapBlock {
                    start_time: slot_start_time(block_start),
                    end_time: slot_end_time(prev_slot),
                    shortage: block_max,
                });
                block_start = slot_idx;
                block_max = shortage;
                prev_slot = slot_idx;
            }
        }
        blocks.push(CoverageGapBlock {
            start_time: slot_start_time(block_start),
            end_time: slot_end_time(prev_slot),
            shortage: block_max,
        });

        // Wrap-around merge: if last block ends at 00:00 and first starts at 00:00,
        // they're actually one continuous overnight block
        if blocks.len() >= 2 {
            let last_ends_midnight = blocks.last().unwrap().end_time == "00:00";
            let first_starts_midnight = blocks[0].start_time == "00:00";
            if last_ends_midnight && first_starts_midnight {
                let first_end = blocks[0].end_time.clone();
                let first_shortage = blocks[0].shortage;
                let last = blocks.last_mut().unwrap();
                last.end_time = first_end;
                last.shortage = last.shortage.max(first_shortage);
                blocks.remove(0);
            }
        }

        result.push(ClassificationGapBlocks {
            classification_id: *class_id,
            classification_abbreviation: abbreviation.clone(),
            blocks,
        });
    }

    // Sort by abbreviation for consistent display
    result.sort_by(|a, b| a.classification_abbreviation.cmp(&b.classification_abbreviation));

    Ok(Json(result))
}

fn slot_start_time(slot: i16) -> String {
    format!("{:02}:{:02}", slot / 2, (slot % 2) * 30)
}

fn slot_end_time(slot: i16) -> String {
    if slot >= 47 {
        "00:00".to_string()
    } else {
        slot_start_time(slot + 1)
    }
}

// ── SMS OT Alert ─────────────────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct SmsAlertRequest {
    pub classification_id: Option<Uuid>,
}

#[derive(Debug, serde::Serialize)]
pub struct SmsAlertResponse {
    pub sent: i64,
    pub failed: i64,
}

/// POST /api/coverage-plans/gaps/:date/sms-alert
///
/// Sends an SMS OT alert to all employees who have `notification_sms = true`
/// and a phone number on file. Requires Twilio configuration.
pub async fn send_sms_alert(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(date_str): Path<String>,
    Json(req): Json<SmsAlertRequest>,
) -> Result<Json<SmsAlertResponse>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let twilio = state
        .twilio
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("SMS is not configured on this server".into()))?;

    // Compute gaps for the message body
    let pool = &state.pool;
    let slot_coverage = compute_slot_coverage(pool, auth.org_id, &date_str).await?;

    // Build a summary of gaps for the SMS body
    let gap_summary = if slot_coverage.is_empty() {
        "Coverage gaps detected.".to_string()
    } else {
        // Aggregate by classification
        use std::collections::HashMap;
        let mut class_gaps: HashMap<String, (i16, i32)> = HashMap::new();
        for sc in &slot_coverage {
            if sc.actual_headcount < sc.min_headcount as i32 {
                // Only include if filtered classification matches (or no filter)
                if let Some(filter_id) = req.classification_id {
                    if sc.classification_id != filter_id {
                        continue;
                    }
                }
                let entry = class_gaps
                    .entry(sc.classification_abbreviation.clone())
                    .or_insert((0, 0));
                entry.0 = entry.0.max(sc.min_headcount);
                entry.1 = entry.1.min(sc.actual_headcount);
            }
        }
        if class_gaps.is_empty() {
            "OT is available today.".to_string()
        } else {
            let parts: Vec<String> = class_gaps
                .iter()
                .map(|(abbr, (target, actual))| {
                    format!("{abbr}: {actual}/{target}")
                })
                .collect();
            format!("Gaps: {}", parts.join(", "))
        }
    };

    let message_body = format!(
        "OT Available - {date_str}\n{gap_summary}\nReply STOP to opt out."
    );

    // Query opted-in employees with phone numbers
    let recipients = sqlx::query!(
        r#"
        SELECT u.id, u.phone AS "phone!"
        FROM users u
        JOIN employee_preferences ep ON ep.user_id = u.id
        WHERE u.org_id = $1
          AND u.is_active = true
          AND ep.notification_sms = true
          AND u.phone IS NOT NULL
          AND u.phone != ''
        "#,
        auth.org_id,
    )
    .fetch_all(pool)
    .await?;

    if recipients.is_empty() {
        return Ok(Json(SmsAlertResponse { sent: 0, failed: 0 }));
    }

    // Fan out SMS with concurrency limit
    use futures::stream::{self, StreamExt};
    let twilio_clone = twilio.clone();
    let body_clone = message_body.clone();

    let results: Vec<(Uuid, String, std::result::Result<(), String>)> = stream::iter(
        recipients
            .into_iter()
            .map(|r| {
                let tw = twilio_clone.clone();
                let body = body_clone.clone();
                let phone = r.phone.clone();
                let user_id = r.id;
                async move {
                    let result =
                        crate::services::sms::send_sms(&tw, &phone, &body).await;
                    (user_id, phone, result)
                }
            }),
    )
    .buffer_unordered(10)
    .collect()
    .await;

    // Log results to sms_log
    let mut sent: i64 = 0;
    let mut failed: i64 = 0;

    for (user_id, phone, result) in &results {
        let (status, error_detail) = match result {
            Ok(()) => {
                sent += 1;
                ("sent", None)
            }
            Err(e) => {
                failed += 1;
                ("failed", Some(e.as_str()))
            }
        };

        sqlx::query!(
            r#"
            INSERT INTO sms_log (org_id, sent_by, recipient_user_id, to_number, message_body, status, error_detail)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
            auth.org_id,
            auth.id,
            *user_id,
            phone,
            body_clone,
            status,
            error_detail,
        )
        .execute(pool)
        .await?;
    }

    Ok(Json(SmsAlertResponse { sent, failed }))
}

// ── Day Grid (block-based coverage with employees) ─────────────────────────────

// Raw data fetched from DB for a single day's grid computation.
struct DayGridData {
    slots: Vec<DayGridSlotRow>,
    assignments: Vec<DayGridAssignmentRow>,
    overnight: Vec<DayGridAssignmentRow>,
    ot_assignments: Vec<DayGridOtRow>,
    ot_overnight: Vec<DayGridOtOvernightRow>,
}

// Newtype row structs used only within this module to carry sqlx anonymous
// record types across function boundaries.

struct DayGridSlotRow {
    slot_index: i16,
    classification_id: Uuid,
    classification_abbreviation: String,
    min_headcount: i16,
    target_headcount: i16,
}

struct DayGridAssignmentRow {
    assignment_id: Uuid,
    user_id: Uuid,
    is_overtime: bool,
    first_name: String,
    last_name: String,
    classification_id: Option<Uuid>,
    shift_name: String,
    start_time: time::Time,
    end_time: time::Time,
    crosses_midnight: bool,
}

struct DayGridOtRow {
    ora_id: Uuid,
    user_id: Uuid,
    first_name: String,
    last_name: String,
    classification_id: Uuid,
    start_time: time::Time,
    end_time: time::Time,
}

struct DayGridOtOvernightRow {
    ora_id: Uuid,
    user_id: Uuid,
    first_name: String,
    last_name: String,
    classification_id: Uuid,
    end_time: time::Time,
}

// Computed maps: per-slot headcount and employee lists.
struct DayGridMaps {
    // (classification_id, slot_index) -> headcount
    actual: std::collections::HashMap<(Uuid, i16), i32>,
    // (classification_id, slot_index) -> employees present in that slot
    emp_map: std::collections::HashMap<(Uuid, i16), Vec<BlockEmployee>>,
}

/// Phase 1 — run all SQL queries needed for the day grid.
async fn fetch_day_grid_data(
    pool: &PgPool,
    org_id: Uuid,
    plan_id: Uuid,
    date: time::Date,
) -> Result<DayGridData> {
    let dow = date.weekday().number_days_from_sunday() as i16;
    let prev_date = date.previous_day().unwrap_or(date);

    let slot_rows = sqlx::query!(
        r#"
        SELECT
            cps.slot_index,
            cps.classification_id,
            cl.abbreviation AS classification_abbreviation,
            cps.min_headcount,
            cps.target_headcount
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

    let slots = slot_rows
        .into_iter()
        .map(|r| DayGridSlotRow {
            slot_index: r.slot_index,
            classification_id: r.classification_id,
            classification_abbreviation: r.classification_abbreviation,
            min_headcount: r.min_headcount,
            target_headcount: r.target_headcount,
        })
        .collect();

    let assignment_rows = sqlx::query!(
        r#"
        SELECT
            a.id AS assignment_id,
            a.user_id,
            a.is_overtime,
            u.first_name,
            u.last_name,
            u.classification_id AS "classification_id?",
            st.name AS shift_name,
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

    let assignments = assignment_rows
        .into_iter()
        .map(|r| DayGridAssignmentRow {
            assignment_id: r.assignment_id,
            user_id: r.user_id,
            is_overtime: r.is_overtime,
            first_name: r.first_name,
            last_name: r.last_name,
            classification_id: r.classification_id,
            shift_name: r.shift_name,
            start_time: r.start_time,
            end_time: r.end_time,
            crosses_midnight: r.crosses_midnight,
        })
        .collect();

    let overnight_rows = sqlx::query!(
        r#"
        SELECT
            a.id AS assignment_id,
            a.user_id,
            a.is_overtime,
            u.first_name,
            u.last_name,
            u.classification_id AS "classification_id?",
            st.name AS shift_name,
            st.start_time,
            st.end_time,
            st.crosses_midnight
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

    let overnight = overnight_rows
        .into_iter()
        .map(|r| DayGridAssignmentRow {
            assignment_id: r.assignment_id,
            user_id: r.user_id,
            is_overtime: r.is_overtime,
            first_name: r.first_name,
            last_name: r.last_name,
            classification_id: r.classification_id,
            shift_name: r.shift_name,
            start_time: r.start_time,
            end_time: r.end_time,
            crosses_midnight: r.crosses_midnight,
        })
        .collect();

    let ot_rows = sqlx::query!(
        r#"
        SELECT
            ora.id AS ora_id,
            ora.user_id,
            u.first_name,
            u.last_name,
            otr.classification_id,
            otr.start_time,
            otr.end_time
        FROM ot_request_assignments ora
        JOIN ot_requests otr ON otr.id = ora.ot_request_id
        JOIN users u ON u.id = ora.user_id
        WHERE otr.org_id = $1 AND otr.date = $2
          AND ora.cancelled_at IS NULL
          AND otr.status != 'cancelled'
        "#,
        org_id,
        date,
    )
    .fetch_all(pool)
    .await?;

    let ot_assignments = ot_rows
        .into_iter()
        .map(|r| DayGridOtRow {
            ora_id: r.ora_id,
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            classification_id: r.classification_id,
            start_time: r.start_time,
            end_time: r.end_time,
        })
        .collect();

    let ot_overnight_rows = sqlx::query!(
        r#"
        SELECT
            ora.id AS ora_id,
            ora.user_id,
            u.first_name,
            u.last_name,
            otr.classification_id,
            otr.end_time
        FROM ot_request_assignments ora
        JOIN ot_requests otr ON otr.id = ora.ot_request_id
        JOIN users u ON u.id = ora.user_id
        WHERE otr.org_id = $1 AND otr.date = $2
          AND otr.end_time < otr.start_time
          AND ora.cancelled_at IS NULL
          AND otr.status != 'cancelled'
        "#,
        org_id,
        prev_date,
    )
    .fetch_all(pool)
    .await?;

    let ot_overnight = ot_overnight_rows
        .into_iter()
        .map(|r| DayGridOtOvernightRow {
            ora_id: r.ora_id,
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            classification_id: r.classification_id,
            end_time: r.end_time,
        })
        .collect();

    Ok(DayGridData {
        slots,
        assignments,
        overnight,
        ot_assignments,
        ot_overnight,
    })
}

/// Phase 2 — build per-slot headcount and employee maps from raw data.
///
/// Processes regular assignments, overnight spillover, OT request assignments,
/// and overnight OT. OT entries are deduplicated against regular assignments so
/// the same person is never double-counted within the same slot.
fn build_slot_maps(data: &DayGridData) -> DayGridMaps {
    use crate::api::helpers::{overnight_end_slot, time_to_slot_range};
    use std::collections::{HashMap, HashSet};

    fn time_str(t: time::Time) -> String {
        format!("{:02}:{:02}", t.hour(), t.minute())
    }

    let mut actual: HashMap<(Uuid, i16), i32> = HashMap::new();
    let mut emp_map: HashMap<(Uuid, i16), Vec<BlockEmployee>> = HashMap::new();

    // Regular assignments for the date
    for a in &data.assignments {
        let Some(class_id) = a.classification_id else {
            continue;
        };
        let (start_slot, end_slot) = time_to_slot_range(a.start_time, a.end_time, a.crosses_midnight);

        let emp = BlockEmployee {
            user_id: a.user_id,
            first_name: a.first_name.clone(),
            last_name: a.last_name.clone(),
            shift_name: a.shift_name.clone(),
            shift_start: time_str(a.start_time),
            shift_end: time_str(a.end_time),
            is_overtime: a.is_overtime,
            assignment_id: a.assignment_id,
        };

        for slot in start_slot..=end_slot {
            *actual.entry((class_id, slot)).or_insert(0) += 1;
            emp_map.entry((class_id, slot)).or_default().push(emp.clone());
        }
    }

    // Overnight assignments from previous day — contribute from slot 0 to end_time
    for a in &data.overnight {
        let Some(class_id) = a.classification_id else {
            continue;
        };
        let Some(end_slot) = overnight_end_slot(a.end_time) else {
            continue;
        };

        let emp = BlockEmployee {
            user_id: a.user_id,
            first_name: a.first_name.clone(),
            last_name: a.last_name.clone(),
            shift_name: a.shift_name.clone(),
            shift_start: "00:00".to_string(),
            shift_end: time_str(a.end_time),
            is_overtime: a.is_overtime,
            assignment_id: a.assignment_id,
        };

        for slot in 0..=end_slot {
            *actual.entry((class_id, slot)).or_insert(0) += 1;
            emp_map.entry((class_id, slot)).or_default().push(emp.clone());
        }
    }

    // Build the deduplication set: slots already covered by regular assignments,
    // so OT for the same user isn't double-counted.
    let mut user_slot_covered: HashSet<(Uuid, Uuid, i16)> = HashSet::new();
    for ((class_id, slot), emps) in &emp_map {
        for e in emps {
            user_slot_covered.insert((e.user_id, *class_id, *slot));
        }
    }

    // OT request assignments — contribute based on ot_requests start/end time
    for ot in &data.ot_assignments {
        let crosses_midnight = ot.end_time < ot.start_time;
        let (start_slot, end_slot) = time_to_slot_range(ot.start_time, ot.end_time, crosses_midnight);

        let emp = BlockEmployee {
            user_id: ot.user_id,
            first_name: ot.first_name.clone(),
            last_name: ot.last_name.clone(),
            shift_name: format!(
                "OT {}-{}",
                time_str(ot.start_time),
                time_str(ot.end_time)
            ),
            shift_start: time_str(ot.start_time),
            shift_end: time_str(ot.end_time),
            is_overtime: true,
            assignment_id: ot.ora_id,
        };

        for slot in start_slot..=end_slot {
            if !user_slot_covered.contains(&(ot.user_id, ot.classification_id, slot)) {
                *actual.entry((ot.classification_id, slot)).or_insert(0) += 1;
            }
            emp_map
                .entry((ot.classification_id, slot))
                .or_default()
                .push(emp.clone());
        }
    }

    // Overnight OT from previous day — contribute from slot 0 to end_time on this date
    for ot in &data.ot_overnight {
        let Some(end_slot) = overnight_end_slot(ot.end_time) else {
            continue;
        };

        let emp = BlockEmployee {
            user_id: ot.user_id,
            first_name: ot.first_name.clone(),
            last_name: ot.last_name.clone(),
            shift_name: format!("OT (overnight) ->{}", time_str(ot.end_time)),
            shift_start: "00:00".to_string(),
            shift_end: time_str(ot.end_time),
            is_overtime: true,
            assignment_id: ot.ora_id,
        };

        for slot in 0..=end_slot {
            if !user_slot_covered.contains(&(ot.user_id, ot.classification_id, slot)) {
                *actual.entry((ot.classification_id, slot)).or_insert(0) += 1;
            }
            emp_map
                .entry((ot.classification_id, slot))
                .or_default()
                .push(emp.clone());
        }
    }

    DayGridMaps { actual, emp_map }
}

/// Phase 3 — build the 2-hour classification blocks from slot maps and slot targets.
///
/// Returns one `DayGridClassification` per classification found in either the
/// coverage plan slots or the actual assignment data. A supplemental DB query
/// fetches abbreviations for any classification that has assignments but no
/// coverage-plan slot definition.
async fn build_classification_blocks(
    pool: &PgPool,
    data: &DayGridData,
    maps: &DayGridMaps,
) -> Result<Vec<DayGridClassification>> {
    use std::collections::{BTreeMap, BTreeSet, HashMap};

    // Build lookup: (classification_id, slot_index) -> (min, target)
    let mut slot_targets: HashMap<(Uuid, i16), (i16, i16)> = HashMap::new();
    let mut class_info: BTreeMap<Uuid, String> = BTreeMap::new();

    for s in &data.slots {
        class_info
            .entry(s.classification_id)
            .or_insert_with(|| s.classification_abbreviation.clone());
        slot_targets.insert(
            (s.classification_id, s.slot_index),
            (s.min_headcount, s.target_headcount),
        );
    }

    // Include classifications that have employees but no coverage plan slots
    let mut all_class_ids: BTreeSet<Uuid> = class_info.keys().copied().collect();
    for ((cid, _), _) in &maps.actual {
        all_class_ids.insert(*cid);
    }

    // Fetch abbreviations for any classification not covered by the plan slots
    if all_class_ids.len() > class_info.len() {
        let missing: Vec<Uuid> = all_class_ids
            .iter()
            .filter(|id| !class_info.contains_key(id))
            .copied()
            .collect();
        if !missing.is_empty() {
            let abbrs = sqlx::query!(
                "SELECT id, abbreviation FROM classifications WHERE id = ANY($1)",
                &missing,
            )
            .fetch_all(pool)
            .await?;
            for r in abbrs {
                class_info.insert(r.id, r.abbreviation);
            }
        }
    }

    // Build 2-hour blocks (12 blocks × 4 half-hour slots each = 48 slots/day)
    let mut classifications: Vec<DayGridClassification> = Vec::new();

    for &class_id in &all_class_ids {
        let abbr = class_info.get(&class_id).cloned().unwrap_or_default();
        let mut blocks: Vec<ClassificationBlock> = Vec::new();

        for block_idx in 0u8..12 {
            let base_slot = block_idx as i16 * 4;
            let block_start_hour = block_idx * 2;
            let block_end_hour = block_start_hour + 2;

            // Within this 2-hour block (4 half-hour slots), find:
            // - peak target (max target across the 4 slots)
            // - peak min (max min across the 4 slots)
            // - min actual (worst-case staffing within the block)
            let mut peak_target: i16 = 0;
            let mut peak_min: i16 = 0;
            let mut min_actual: i32 = i32::MAX;
            let mut has_target = false;

            for offset in 0..4i16 {
                let si = base_slot + offset;
                if let Some(&(mn, tgt)) = slot_targets.get(&(class_id, si)) {
                    has_target = true;
                    peak_target = peak_target.max(tgt);
                    peak_min = peak_min.max(mn);
                }
                let a = maps.actual.get(&(class_id, si)).copied().unwrap_or(0);
                min_actual = min_actual.min(a);
            }

            if min_actual == i32::MAX {
                min_actual = 0;
            }

            let status = if !has_target && min_actual == 0 {
                "green" // no requirement, no employees — fine
            } else if peak_min == 0 || min_actual >= peak_min as i32 {
                "green"
            } else {
                "red"
            };

            // Deduplicate employees across the 4 slots (same person appears once per block)
            let mut seen_users: BTreeSet<Uuid> = BTreeSet::new();
            let mut block_employees: Vec<BlockEmployee> = Vec::new();
            for offset in 0..4i16 {
                let si = base_slot + offset;
                if let Some(emps) = maps.emp_map.get(&(class_id, si)) {
                    for e in emps {
                        if seen_users.insert(e.user_id) {
                            block_employees.push(e.clone());
                        }
                    }
                }
            }

            blocks.push(ClassificationBlock {
                block_index: block_idx,
                start_time: format!("{:02}:00", block_start_hour),
                end_time: format!("{:02}:00", block_end_hour),
                min: peak_min,
                target: peak_target,
                actual: min_actual,
                status: status.to_string(),
                employees: block_employees,
            });
        }

        classifications.push(DayGridClassification {
            classification_id: class_id,
            abbreviation: abbr,
            blocks,
        });
    }

    Ok(classifications)
}

/// Phase 4 — build aggregate per-block coverage totals from the classification grid.
fn build_coverage_blocks(classifications: &[DayGridClassification]) -> Vec<CoverageBlock> {
    (0u8..12)
        .map(|block_idx| {
            let total_min: i32 = classifications
                .iter()
                .map(|c| c.blocks[block_idx as usize].min as i32)
                .sum();
            let total_actual: i32 = classifications
                .iter()
                .map(|c| c.blocks[block_idx as usize].actual)
                .sum();
            let any_red = classifications
                .iter()
                .any(|c| c.blocks[block_idx as usize].status == "red");
            CoverageBlock {
                block_index: block_idx,
                total_target: total_min, // field name kept for API compat, value is min
                total_actual,
                status: if any_red { "red" } else { "green" }.to_string(),
            }
        })
        .collect()
}

/// GET /api/coverage-plans/day-grid/:date
///
/// Returns per-classification 2-hour coverage blocks with employee-level detail.
pub async fn day_grid(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(date_str): Path<String>,
) -> Result<Json<DayGridResponse>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    let date = parse_date(&date_str)?;

    let plan_id = match resolve_plan_id(&pool, auth.org_id, date).await? {
        Some(id) => id,
        None => {
            return Ok(Json(DayGridResponse {
                date: date_str,
                classifications: vec![],
                blocks: vec![],
            }));
        }
    };

    let data = fetch_day_grid_data(&pool, auth.org_id, plan_id, date).await?;
    let maps = build_slot_maps(&data);
    let classifications = build_classification_blocks(&pool, &data, &maps).await?;
    let blocks = build_coverage_blocks(&classifications);

    Ok(Json(DayGridResponse {
        date: date_str,
        classifications,
        blocks,
    }))
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

/// Internal per-shift coverage result with per-classification breakdown.
pub(crate) struct ShiftCoverageStatus {
    pub status: String,
    pub total_shortage: i32,
    pub by_classification: Vec<crate::models::schedule::ClassificationCoverageDetail>,
}

/// Per-shift coverage status using per-classification gap analysis.
///
/// For each classification within a shift, finds the worst single-slot shortage
/// (max of `min_headcount - actual_headcount` at the same time slot). This avoids
/// the old bug of comparing peak_min at one slot against min_actual at a different slot.
/// Per-shift coverage status using per-classification gap analysis.
///
/// `shift_classifications` maps each shift_template_id to the set of
/// classification_ids that actually have shift_slots for it. When provided,
/// only those classifications are considered for coverage. When `None`, all
/// classifications are checked (legacy behavior).
pub(crate) fn coverage_status_per_shift(
    slot_coverage: &[SlotCoverage],
    shifts: &[(Uuid, time::Time, time::Time, bool)],
    shift_classifications: Option<&std::collections::HashMap<Uuid, std::collections::HashSet<Uuid>>>,
) -> std::collections::HashMap<Uuid, ShiftCoverageStatus> {
    use crate::api::helpers::time_to_slot_range;
    use std::collections::HashMap;

    // Index slot coverage by (classification_id, slot_index)
    let mut by_key: HashMap<(Uuid, i16), &SlotCoverage> = HashMap::new();
    for sc in slot_coverage {
        by_key.insert((sc.classification_id, sc.slot_index), sc);
    }

    // Collect distinct classification IDs with their abbreviations
    let mut class_info: HashMap<Uuid, String> = HashMap::new();
    for sc in slot_coverage {
        class_info
            .entry(sc.classification_id)
            .or_insert_with(|| sc.classification_abbreviation.clone());
    }

    let mut result = HashMap::new();

    for &(template_id, start_time, end_time, crosses_midnight) in shifts {
        let (start_slot, end_slot) = time_to_slot_range(start_time, end_time, crosses_midnight);
        let end_slot = end_slot.max(start_slot);

        let mut total_shortage: i32 = 0;
        let mut by_classification = Vec::new();

        for (&class_id, abbreviation) in &class_info {
            // Skip classifications not assigned to this shift template
            if let Some(sc_map) = shift_classifications {
                if let Some(class_set) = sc_map.get(&template_id) {
                    if !class_set.contains(&class_id) {
                        continue;
                    }
                } else {
                    // Shift template has no slots at all — skip all classifications
                    continue;
                }
            }

            // Find the worst single-slot shortage for this classification
            let mut worst_shortage: i32 = 0;

            for slot_idx in start_slot..=end_slot {
                if let Some(sc) = by_key.get(&(class_id, slot_idx)) {
                    let slot_shortage = (sc.min_headcount as i32) - sc.actual_headcount;
                    if slot_shortage > worst_shortage {
                        worst_shortage = slot_shortage;
                    }
                }
            }

            if worst_shortage > 0 {
                total_shortage += worst_shortage;
                by_classification.push(
                    crate::models::schedule::ClassificationCoverageDetail {
                        classification_abbreviation: abbreviation.clone(),
                        shortage: worst_shortage,
                    },
                );
            }
        }

        // Sort by shortage descending for consistent display
        by_classification.sort_by(|a, b| b.shortage.cmp(&a.shortage));

        let status = if total_shortage > 0 { "red" } else { "green" };
        result.insert(
            template_id,
            ShiftCoverageStatus {
                status: status.to_string(),
                total_shortage,
                by_classification,
            },
        );
    }

    result
}

// ── Internal helper ───────────────────────────────────────────────────────────

