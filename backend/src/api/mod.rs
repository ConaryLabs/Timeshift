pub mod auth;
pub mod users;
pub mod shifts;
pub mod schedule;
pub mod leave;
pub mod callout;
pub mod organizations;
pub mod classifications;
pub mod teams;

use axum::{Router, routing::{get, post, delete, patch, put}};
use crate::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        // Auth
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/me", get(auth::me))
        // Organizations
        .route("/api/organizations", get(organizations::list).post(organizations::create))
        .route("/api/organizations/{id}", get(organizations::get))
        // Classifications
        .route("/api/classifications", get(classifications::list).post(classifications::create))
        .route("/api/classifications/{id}", put(classifications::update))
        // Teams
        .route("/api/teams", get(teams::list_teams).post(teams::create_team))
        .route("/api/teams/{id}", get(teams::get_team).put(teams::update_team))
        .route("/api/teams/{id}/slots", get(teams::list_slots).post(teams::create_slot))
        // Shift slots (cross-team update)
        .route("/api/shift-slots/{id}", put(teams::update_slot))
        // Users
        .route("/api/users", get(users::list).post(users::create))
        .route("/api/users/{id}", get(users::get_one).put(users::update).delete(users::deactivate))
        // Shift templates
        .route("/api/shifts/templates", get(shifts::list_templates).post(shifts::create_template))
        .route("/api/shifts/templates/{id}", get(shifts::get_template).put(shifts::update_template))
        // Scheduled shifts
        .route("/api/shifts/scheduled", get(shifts::list_scheduled).post(shifts::create_scheduled))
        .route("/api/shifts/scheduled/{id}", get(shifts::get_scheduled).delete(shifts::delete_scheduled))
        // Schedule / assignments
        .route("/api/schedule", get(schedule::staffing_view))
        .route("/api/schedule/assignments", post(schedule::create_assignment))
        .route("/api/schedule/assignments/{id}", delete(schedule::delete_assignment))
        // Schedule periods
        .route("/api/schedule/periods", get(schedule::list_periods).post(schedule::create_period))
        .route("/api/schedule/periods/{id}/assign", post(schedule::assign_slot))
        // Leave types
        .route("/api/leave/types", get(leave::list_types))
        // Leave requests
        .route("/api/leave", get(leave::list).post(leave::create))
        .route("/api/leave/{id}", get(leave::get_one).delete(leave::cancel))
        .route("/api/leave/{id}/review", patch(leave::review))
        // Callout
        .route("/api/callout/events", get(callout::list_events).post(callout::create_event))
        .route("/api/callout/events/{id}", get(callout::get_event))
        .route("/api/callout/events/{id}/list", get(callout::callout_list))
        .route("/api/callout/events/{id}/attempt", post(callout::record_attempt))
        .route("/api/callout/events/{id}/cancel", post(callout::cancel_event))
        .with_state(state)
}
