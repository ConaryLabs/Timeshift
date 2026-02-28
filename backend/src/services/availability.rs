//! OT availability computation: determines which employees are eligible and available
//! for overtime based on eligibility rules, cross-classification windows, leave overlap,
//! and current OT queue position.

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::Result;
use crate::models::callout::CalloutListEntry;

/// Compute the ordered list of available (and unavailable) employees for a potential
/// OT assignment on a given shift.
///
/// CBA (VCCEA Article 15 — Overtime Distribution):
/// Employees are ordered by:
/// 1. Primary classification employees first (same-class before cross-class)
/// 2. Available employees before unavailable
/// 3. OT queue position (last_ot_event_at ASC NULLS FIRST = never-called = top priority)
/// 4. Accumulated OT hours ASC (equalize OT distribution across the bargaining unit)
/// 5. Overall seniority date DESC NULLS FIRST (tie-breaker: inverse seniority — least senior first)
pub async fn compute_available_employees(
    pool: &PgPool,
    org_id: Uuid,
    org_timezone: &str,
    scheduled_shift_id: Uuid,
    classification_id: Uuid,
    shift_date: time::Date,
    shift_start: time::Time,
    shift_duration_minutes: i32,
) -> Result<Vec<CalloutListEntry>> {
    let fy_start =
        crate::services::org_settings::get_i64(pool, org_id, "fiscal_year_start_month", 1)
            .await as u32;
    let fiscal_year: i32 =
        crate::services::timezone::fiscal_year_for_date(shift_date, fy_start);

    // Precompute shift time bounds as minutes-from-midnight for partial-day leave overlap check.
    // shift_end_mins may exceed 1440 for overnight shifts (e.g., 22:00-06:00 → 1320..1800).
    let shift_start_mins: i32 =
        shift_start.hour() as i32 * 60 + shift_start.minute() as i32;
    let shift_end_mins: i32 = shift_start_mins + shift_duration_minutes;

    // CBA (LOU 25-10): Cross-classification OT eligibility window. When a shift is within
    // this many days (default 10), employees from other classifications become eligible.
    let window_days: i64 = sqlx::query_scalar!(
        r#"SELECT CAST(value AS BIGINT) FROM org_settings WHERE org_id = $1 AND key = 'ot_cross_class_window_days'"#,
        org_id
    )
    .fetch_optional(pool)
    .await?
    .flatten()
    .unwrap_or(10);

    let today = crate::services::timezone::org_today(org_timezone);
    let days_until_shift = (shift_date - today).whole_days();
    let cross_class_eligible = days_until_shift >= 0 && days_until_shift <= window_days;

    // CTE computes blocking conditions once, then the outer SELECT derives
    // is_available and unavailable_reason from those flags. This eliminates
    // the previous triple-duplication of the leave-overlap subquery.
    let rows = sqlx::query!(
        r#"
        WITH eligible AS (
            SELECT
                u.id,
                u.employee_id,
                u.first_name,
                u.last_name,
                u.phone,
                u.classification_id,
                u.medical_ot_exempt,
                cl.abbreviation AS classification_abbreviation,
                sr.overall_seniority_date,
                COALESCE(ot.hours_worked, 0.0)::FLOAT8 AS ot_hours,
                oq.last_ot_event_at,
                -- Blocking: already assigned to this shift
                EXISTS (
                    SELECT 1 FROM assignments a
                    WHERE a.user_id = u.id AND a.scheduled_shift_id = $1
                      AND a.cancelled_at IS NULL
                ) AS is_already_scheduled,
                -- Blocking: assigned to an OT request on this date
                EXISTS (
                    SELECT 1 FROM ot_request_assignments ora
                    JOIN ot_requests otr ON otr.id = ora.ot_request_id
                    WHERE ora.user_id = u.id
                      AND otr.org_id = $2
                      AND otr.date = $8::DATE
                      AND ora.cancelled_at IS NULL
                      AND otr.status != 'cancelled'
                ) AS is_assigned_ot,
                -- Blocking: on approved leave that overlaps the shift
                EXISTS (
                    SELECT 1 FROM leave_requests lr
                    WHERE lr.user_id = u.id
                      AND lr.org_id = $2
                      AND lr.status = 'approved'
                      AND lr.start_date <= $8::DATE
                      AND lr.end_date   >= $8::DATE
                      -- Exclude non-overlapping partial-day leave
                      AND NOT (
                          EXISTS (
                              SELECT 1 FROM leave_request_lines lrl
                              WHERE lrl.leave_request_id = lr.id AND lrl.date = $8::DATE
                                AND lrl.start_time IS NOT NULL AND lrl.end_time IS NOT NULL
                          )
                          AND NOT EXISTS (
                              SELECT 1 FROM leave_request_lines lrl
                              WHERE lrl.leave_request_id = lr.id AND lrl.date = $8::DATE
                                AND (lrl.start_time IS NULL OR lrl.end_time IS NULL)
                          )
                          AND NOT EXISTS (
                              SELECT 1 FROM leave_request_lines lrl
                              CROSS JOIN LATERAL (
                                  SELECT
                                      EXTRACT(HOUR FROM lrl.start_time)::INT * 60
                                          + EXTRACT(MINUTE FROM lrl.start_time)::INT AS ls,
                                      CASE
                                          WHEN EXTRACT(HOUR FROM lrl.end_time)::INT * 60
                                                  + EXTRACT(MINUTE FROM lrl.end_time)::INT
                                              <= EXTRACT(HOUR FROM lrl.start_time)::INT * 60
                                                  + EXTRACT(MINUTE FROM lrl.start_time)::INT
                                          THEN EXTRACT(HOUR FROM lrl.end_time)::INT * 60
                                                  + EXTRACT(MINUTE FROM lrl.end_time)::INT + 1440
                                          ELSE EXTRACT(HOUR FROM lrl.end_time)::INT * 60
                                                  + EXTRACT(MINUTE FROM lrl.end_time)::INT
                                      END AS le
                              ) t
                              WHERE lrl.leave_request_id = lr.id AND lrl.date = $8::DATE
                                AND lrl.start_time IS NOT NULL AND lrl.end_time IS NOT NULL
                                AND (
                                    (t.ls < $6 AND t.le > $7)
                                    OR (t.ls + 1440 < $6 AND t.le + 1440 > $7)
                                )
                          )
                      )
                ) AS is_on_leave
            FROM users u
            LEFT JOIN classifications cl ON cl.id = u.classification_id
            LEFT JOIN seniority_records sr ON sr.user_id = u.id
            LEFT JOIN ot_hours ot ON ot.user_id = u.id
                AND ot.fiscal_year = $3
                AND ot.classification_id = $4
            LEFT JOIN ot_queue_positions oq ON
                oq.org_id = $2
                AND oq.user_id = u.id
                AND oq.fiscal_year = $3
                AND oq.classification_id = u.classification_id
            WHERE u.is_active = true AND u.employee_status = 'active' AND u.org_id = $2
              AND ($5 OR u.classification_id = $4)
              AND u.classification_id IS NOT NULL
        )
        SELECT
            e.id,
            e.employee_id,
            e.first_name,
            e.last_name,
            e.phone AS "phone?",
            (e.classification_id IS DISTINCT FROM $4) AS "is_cross_class!: bool",
            e.classification_abbreviation AS "classification_abbreviation?",
            e.overall_seniority_date AS "overall_seniority_date?",
            e.ot_hours,
            (NOT e.medical_ot_exempt AND NOT e.is_already_scheduled
                AND NOT e.is_assigned_ot AND NOT e.is_on_leave) AS is_available,
            CASE
                WHEN e.medical_ot_exempt THEN 'Medical OT exempt'
                WHEN e.is_already_scheduled THEN 'Already scheduled'
                WHEN e.is_assigned_ot THEN 'Assigned to OT'
                WHEN e.is_on_leave THEN 'On approved leave'
                ELSE NULL
            END AS unavailable_reason
        FROM eligible e
        ORDER BY
            (e.classification_id = $4) DESC,
            (NOT e.medical_ot_exempt AND NOT e.is_already_scheduled
                AND NOT e.is_assigned_ot AND NOT e.is_on_leave) DESC,
            e.last_ot_event_at ASC NULLS FIRST,
            e.ot_hours ASC,
            -- Tie-breaker: inverse seniority (least senior = most recent hire date first;
            -- NULL seniority = no date = least senior = highest OT priority)
            e.overall_seniority_date DESC NULLS FIRST
        "#,
        scheduled_shift_id,   // $1
        org_id,               // $2
        fiscal_year,          // $3
        classification_id,    // $4
        cross_class_eligible, // $5
        shift_end_mins,       // $6
        shift_start_mins,     // $7
        shift_date,           // $8
    )
    .fetch_all(pool)
    .await?;

    let entries = rows
        .into_iter()
        .enumerate()
        .map(|(i, r)| CalloutListEntry {
            position: i as i32 + 1,
            user_id: r.id,
            employee_id: r.employee_id,
            first_name: r.first_name,
            last_name: r.last_name,
            classification_abbreviation: r.classification_abbreviation,
            overall_seniority_date: r.overall_seniority_date,
            ot_hours: r.ot_hours.unwrap_or(0.0),
            phone: r.phone,
            is_available: r.is_available.unwrap_or(false),
            unavailable_reason: r.unavailable_reason,
            is_cross_class: r.is_cross_class,
        })
        .collect();

    Ok(entries)
}
