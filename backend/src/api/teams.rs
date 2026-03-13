use axum::{
    extract::{Path, State},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, Result},
    models::team::{
        CreateShiftSlotRequest, CreateTeamRequest, ShiftSlotView, Team, TeamMember, TeamSummary,
        TeamWithSlots, UpdateShiftSlotRequest, UpdateTeamRequest,
    },
    org_guard,
};

pub async fn list_teams(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Vec<TeamSummary>>> {
    let rows = sqlx::query!(
        r#"
        SELECT t.id, t.name, t.supervisor_id, t.parent_team_id, t.is_active,
               u.first_name || ' ' || u.last_name AS supervisor_name,
               pt.name AS "parent_team_name?",
               COUNT(DISTINCT ss.id)::BIGINT AS slot_count,
               COUNT(DISTINCT sa.user_id)::BIGINT AS member_count
        FROM teams t
        LEFT JOIN users u ON u.id = t.supervisor_id
        LEFT JOIN teams pt ON pt.id = t.parent_team_id
        LEFT JOIN shift_slots ss ON ss.team_id = t.id AND ss.is_active = true
        LEFT JOIN slot_assignments sa ON sa.slot_id = ss.id
        WHERE t.org_id = $1 AND t.is_active = true
        GROUP BY t.id, t.name, t.supervisor_id, t.parent_team_id, t.is_active, u.first_name, u.last_name, pt.name
        ORDER BY t.name
        "#,
        auth.org_id
    )
    .fetch_all(&pool)
    .await?;

    let teams = rows
        .into_iter()
        .map(|r| TeamSummary {
            id: r.id,
            name: r.name,
            supervisor_id: r.supervisor_id,
            supervisor_name: r.supervisor_name,
            parent_team_id: r.parent_team_id,
            parent_team_name: r.parent_team_name,
            is_active: r.is_active,
            slot_count: r.slot_count.unwrap_or(0),
            member_count: r.member_count.unwrap_or(0),
        })
        .collect();

    Ok(Json(teams))
}

pub async fn get_team(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<TeamWithSlots>> {
    let team = sqlx::query_as!(
        Team,
        r#"
        SELECT id, org_id, name, supervisor_id, parent_team_id, is_active, created_at, updated_at
        FROM teams WHERE id = $1 AND org_id = $2
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    let slots = fetch_slot_views(&pool, id).await?;

    Ok(Json(TeamWithSlots { team, slots }))
}

pub async fn create_team(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(req): Json<CreateTeamRequest>,
) -> Result<Json<Team>> {
    use validator::Validate;
    req.validate()?;

    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    if let Some(sup_id) = req.supervisor_id {
        org_guard::verify_user(&pool, sup_id, auth.org_id).await?;
    }

    if let Some(parent_id) = req.parent_team_id {
        org_guard::verify_team(&pool,parent_id, auth.org_id).await?;
    }

    let team = sqlx::query_as!(
        Team,
        r#"
        INSERT INTO teams (id, org_id, name, supervisor_id, parent_team_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, org_id, name, supervisor_id, parent_team_id, is_active, created_at, updated_at
        "#,
        Uuid::new_v4(),
        auth.org_id,
        req.name,
        req.supervisor_id,
        req.parent_team_id,
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(team))
}

pub async fn update_team(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTeamRequest>,
) -> Result<Json<Team>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Optimistic locking: check if the record has been modified since the client last fetched it
    if let Some(expected) = req.expected_updated_at {
        let current = sqlx::query_scalar!(
            "SELECT updated_at FROM teams WHERE id = $1 AND org_id = $2",
            id,
            auth.org_id
        )
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

        if current != expected {
            return Err(AppError::Conflict(
                "This record has been modified by another user. Please refresh and try again."
                    .into(),
            ));
        }
    }

    // Verify optional supervisor belongs to caller's org
    if let Some(Some(sup_id)) = req.supervisor_id {
        org_guard::verify_user(&pool, sup_id, auth.org_id).await?;
    }

    // Verify optional parent team and check for cycles
    if let Some(Some(parent_id)) = req.parent_team_id {
        if parent_id == id {
            return Err(AppError::BadRequest(
                "A team cannot be its own parent".into(),
            ));
        }
        org_guard::verify_team(&pool,parent_id, auth.org_id).await?;
        check_team_cycle(&pool, id, parent_id).await?;
    }

    let sup_provided = req.supervisor_id.is_some();
    let sup_val = req.supervisor_id.flatten();
    let parent_provided = req.parent_team_id.is_some();
    let parent_val = req.parent_team_id.flatten();

    let team = sqlx::query_as!(
        Team,
        r#"
        UPDATE teams
        SET name            = COALESCE($2, name),
            supervisor_id   = CASE WHEN $3 THEN $4 ELSE supervisor_id END,
            parent_team_id  = CASE WHEN $7 THEN $8 ELSE parent_team_id END,
            is_active       = COALESCE($5, is_active),
            updated_at      = NOW()
        WHERE id = $1 AND org_id = $6
        RETURNING id, org_id, name, supervisor_id, parent_team_id, is_active, created_at, updated_at
        "#,
        id,
        req.name,
        sup_provided,
        sup_val,
        req.is_active,
        auth.org_id,
        parent_provided,
        parent_val,
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    Ok(Json(team))
}

pub async fn list_slots(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(team_id): Path<Uuid>,
) -> Result<Json<Vec<ShiftSlotView>>> {
    // Verify team belongs to org
    org_guard::verify_team(&pool, team_id, auth.org_id).await?;

    let slots = fetch_slot_views(&pool, team_id).await?;
    Ok(Json(slots))
}

pub async fn create_slot(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(team_id): Path<Uuid>,
    Json(req): Json<CreateShiftSlotRequest>,
) -> Result<Json<ShiftSlotView>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify team belongs to org
    org_guard::verify_team(&pool, team_id, auth.org_id).await?;

    // Verify shift_template and classification belong to caller's org
    org_guard::verify_shift_template(&pool, req.shift_template_id, auth.org_id).await?;
    org_guard::verify_classification(&pool, req.classification_id, auth.org_id).await?;

    let slot_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO shift_slots (id, team_id, shift_template_id, classification_id, days_of_week, label)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
        slot_id,
        team_id,
        req.shift_template_id,
        req.classification_id,
        &req.days_of_week,
        req.label,
    )
    .execute(&pool)
    .await?;

    let view = fetch_single_slot_view(&pool, slot_id).await?;
    Ok(Json(view))
}

pub async fn update_slot(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(slot_id): Path<Uuid>,
    Json(req): Json<UpdateShiftSlotRequest>,
) -> Result<Json<ShiftSlotView>> {
    if !auth.role.can_manage_schedule() {
        return Err(AppError::Forbidden);
    }

    // Verify slot belongs to a team in the user's org
    org_guard::verify_slot(&pool, slot_id, auth.org_id).await?;

    // Verify optional FK references belong to caller's org
    if let Some(tmpl_id) = req.shift_template_id {
        org_guard::verify_shift_template(&pool, tmpl_id, auth.org_id).await?;
    }
    if let Some(class_id) = req.classification_id {
        org_guard::verify_classification(&pool, class_id, auth.org_id).await?;
    }

    sqlx::query!(
        r#"
        UPDATE shift_slots
        SET shift_template_id = COALESCE($2, shift_template_id),
            classification_id = COALESCE($3, classification_id),
            days_of_week      = COALESCE($4, days_of_week),
            label             = COALESCE($5, label),
            is_active         = COALESCE($6, is_active)
        WHERE id = $1
        "#,
        slot_id,
        req.shift_template_id,
        req.classification_id,
        req.days_of_week.as_deref(),
        req.label,
        req.is_active,
    )
    .execute(&pool)
    .await?;

    let view = fetch_single_slot_view(&pool, slot_id).await?;
    Ok(Json(view))
}

async fn check_team_cycle(pool: &PgPool, team_id: Uuid, new_parent_id: Uuid) -> Result<()> {
    let mut current = Some(new_parent_id);
    let mut visited = std::collections::HashSet::new();
    visited.insert(team_id);

    while let Some(cid) = current {
        if !visited.insert(cid) {
            return Err(AppError::BadRequest(
                "Setting this parent would create a circular reference".into(),
            ));
        }
        current = sqlx::query_scalar!("SELECT parent_team_id FROM teams WHERE id = $1", cid)
            .fetch_optional(pool)
            .await?
            .flatten();
    }
    Ok(())
}

pub async fn team_members(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(team_id): Path<Uuid>,
) -> Result<Json<Vec<TeamMember>>> {
    org_guard::verify_team(&pool, team_id, auth.org_id).await?;

    let rows = sqlx::query!(
        r#"
        SELECT DISTINCT ON (u.id)
            u.id AS user_id,
            u.first_name,
            u.last_name,
            c.abbreviation AS "classification_abbreviation?",
            u.role AS "role!: String",
            st.name AS "shift_name?"
        FROM slot_assignments sa
        JOIN shift_slots ss ON ss.id = sa.slot_id
        JOIN users u ON u.id = sa.user_id
        LEFT JOIN classifications c ON c.id = u.classification_id
        LEFT JOIN shift_templates st ON st.id = ss.shift_template_id
        WHERE ss.team_id = $1 AND u.is_active = true
        ORDER BY u.id, st.start_time
        "#,
        team_id,
    )
    .fetch_all(&pool)
    .await?;

    let mut members: Vec<TeamMember> = rows
        .into_iter()
        .map(|r| TeamMember {
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            classification_abbreviation: r.classification_abbreviation,
            role: r.role,
            shift_name: r.shift_name,
        })
        .collect();

    // Sort: supervisors first, then by last name
    members.sort_by(|a, b| {
        let a_sup = a.role == "supervisor" || a.role == "admin";
        let b_sup = b.role == "supervisor" || b.role == "admin";
        b_sup.cmp(&a_sup).then(a.last_name.cmp(&b.last_name))
    });

    Ok(Json(members))
}

async fn fetch_single_slot_view(pool: &PgPool, slot_id: Uuid) -> Result<ShiftSlotView> {
    let row = sqlx::query!(
        r#"
        SELECT ss.id, ss.team_id, ss.shift_template_id,
               st.name AS shift_template_name, st.start_time, st.end_time,
               ss.classification_id,
               c.abbreviation AS classification_abbreviation,
               ss.days_of_week, ss.label, ss.is_active
        FROM shift_slots ss
        JOIN shift_templates st ON st.id = ss.shift_template_id
        JOIN classifications c ON c.id = ss.classification_id
        WHERE ss.id = $1
        "#,
        slot_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Shift slot not found".into()))?;

    Ok(ShiftSlotView {
        id: row.id,
        team_id: row.team_id,
        shift_template_id: row.shift_template_id,
        shift_template_name: row.shift_template_name,
        start_time: row.start_time,
        end_time: row.end_time,
        classification_id: row.classification_id,
        classification_abbreviation: row.classification_abbreviation,
        days_of_week: row.days_of_week,
        label: row.label,
        is_active: row.is_active,
    })
}

async fn fetch_slot_views(
    pool: &PgPool,
    team_id: Uuid,
) -> std::result::Result<Vec<ShiftSlotView>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        SELECT ss.id, ss.team_id, ss.shift_template_id,
               st.name AS shift_template_name, st.start_time, st.end_time,
               ss.classification_id,
               c.abbreviation AS classification_abbreviation,
               ss.days_of_week, ss.label, ss.is_active
        FROM shift_slots ss
        JOIN shift_templates st ON st.id = ss.shift_template_id
        JOIN classifications c ON c.id = ss.classification_id
        WHERE ss.team_id = $1 AND ss.is_active = true
        ORDER BY st.start_time, c.display_order
        "#,
        team_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| ShiftSlotView {
            id: r.id,
            team_id: r.team_id,
            shift_template_id: r.shift_template_id,
            shift_template_name: r.shift_template_name,
            start_time: r.start_time,
            end_time: r.end_time,
            classification_id: r.classification_id,
            classification_abbreviation: r.classification_abbreviation,
            days_of_week: r.days_of_week,
            label: r.label,
            is_active: r.is_active,
        })
        .collect())
}
