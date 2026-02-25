pub mod auth;
pub mod bidding;
pub mod callout;
pub mod classifications;
pub mod coverage_plans;
pub mod duty_positions;
pub mod employee;
pub mod holidays;
pub mod leave;
pub mod leave_balances;
pub mod leave_donation;
pub mod leave_sellback;
pub mod nav;
pub mod notifications;
pub mod organizations;
pub mod ot;
pub mod ot_request;
pub mod reports;
pub mod saved_filters;
pub mod schedule;
pub mod shift_patterns;
pub mod shifts;
pub mod special_assignments;
pub mod teams;
pub mod trades;
pub mod users;
pub mod vacation_bids;

use crate::AppState;
use axum::{
    extract::State,
    routing::{delete, get, patch, post},
    Json, Router,
};
use sqlx::PgPool;

async fn health(State(pool): State<PgPool>) -> Json<serde_json::Value> {
    let db_ok = sqlx::query_scalar!("SELECT 1 AS \"one!\"")
        .fetch_one(&pool)
        .await
        .is_ok();

    Json(serde_json::json!({
        "status": if db_ok { "ok" } else { "degraded" },
        "database": db_ok,
    }))
}

pub fn router(state: AppState) -> Router {
    Router::new()
        // Health check (no auth required)
        .route("/api/health", get(health))
        // Auth (login route is in main.rs with rate limiting)
        .route("/api/auth/me", get(auth::me))
        .route("/api/auth/logout", post(auth::logout))
        // Organization (own org only)
        .route(
            "/api/organization",
            get(organizations::get_own).patch(organizations::update_own),
        )
        // Classifications
        .route(
            "/api/classifications",
            get(classifications::list).post(classifications::create),
        )
        .route("/api/classifications/:id", patch(classifications::update))
        // Teams
        .route(
            "/api/teams",
            get(teams::list_teams).post(teams::create_team),
        )
        .route(
            "/api/teams/:id",
            get(teams::get_team).patch(teams::update_team),
        )
        .route(
            "/api/teams/:id/slots",
            get(teams::list_slots).post(teams::create_slot),
        )
        // Shift slots (cross-team update)
        .route("/api/shift-slots/:id", patch(teams::update_slot))
        // Special Assignments
        .route(
            "/api/special-assignments",
            get(special_assignments::list).post(special_assignments::create),
        )
        .route(
            "/api/special-assignments/:id",
            get(special_assignments::get_one)
                .patch(special_assignments::update)
                .delete(special_assignments::delete),
        )
        // Employee portal (must be before /api/users/:id to avoid param capture)
        .route(
            "/api/users/me/preferences",
            get(employee::get_preferences).patch(employee::update_preferences),
        )
        .route("/api/users/me/schedule", get(employee::my_schedule))
        .route("/api/users/me/dashboard", get(employee::my_dashboard))
        .route("/api/nav/badges", get(nav::badges))
        // Users (directory must be before /api/users/:id to avoid param capture)
        .route("/api/users/directory", get(users::directory))
        .route("/api/users", get(users::list).post(users::create))
        .route(
            "/api/users/:id",
            get(users::get_one)
                .patch(users::update)
                .delete(users::deactivate),
        )
        // Shift templates
        .route(
            "/api/shifts/templates",
            get(shifts::list_templates).post(shifts::create_template),
        )
        .route(
            "/api/shifts/templates/:id",
            get(shifts::get_template).patch(shifts::update_template),
        )
        // Scheduled shifts
        .route(
            "/api/shifts/scheduled",
            get(shifts::list_scheduled).post(shifts::create_scheduled),
        )
        .route(
            "/api/shifts/scheduled/:id",
            get(shifts::get_scheduled).delete(shifts::delete_scheduled),
        )
        // Schedule / assignments
        .route("/api/schedule", get(schedule::staffing_view))
        .route(
            "/api/schedule/assignments",
            post(schedule::create_assignment),
        )
        .route(
            "/api/schedule/assignments/:id",
            delete(schedule::delete_assignment),
        )
        // Schedule periods
        .route(
            "/api/schedule/periods",
            get(schedule::list_periods).post(schedule::create_period),
        )
        .route("/api/schedule/periods/:id", get(schedule::get_period))
        .route(
            "/api/schedule/periods/:id/assign",
            post(schedule::assign_slot),
        )
        .route(
            "/api/schedule/periods/:id/assignments",
            get(schedule::list_period_assignments),
        )
        .route(
            "/api/schedule/periods/:id/assignments/:slot_id",
            delete(schedule::remove_slot_assignment),
        )
        // Shift bidding
        .route(
            "/api/schedule/periods/:id/open-bidding",
            post(bidding::open_bidding),
        )
        .route(
            "/api/schedule/periods/:id/bid-windows",
            get(bidding::list_bid_windows),
        )
        .route(
            "/api/schedule/periods/:id/process-bids",
            post(bidding::process_bids),
        )
        .route("/api/bid-windows/:id", get(bidding::get_bid_window))
        .route("/api/bid-windows/:id/submit", post(bidding::submit_bid))
        .route(
            "/api/bid-windows/:id/approve",
            post(bidding::approve_bid_window),
        )
        // Schedule views
        .route("/api/schedule/grid", get(schedule::grid))
        .route("/api/schedule/day/:date", get(schedule::day_view))
        .route("/api/schedule/dashboard", get(schedule::dashboard))
        // Schedule annotations
        .route(
            "/api/schedule/annotations",
            get(schedule::list_annotations).post(schedule::create_annotation),
        )
        .route(
            "/api/schedule/annotations/:id",
            delete(schedule::delete_annotation),
        )
        // Coverage plans (per-half-hour-slot system)
        // Static sub-paths before /:id to avoid param capture
        .route(
            "/api/coverage-plans",
            get(coverage_plans::list_plans).post(coverage_plans::create_plan),
        )
        .route(
            "/api/coverage-plans/assignments",
            get(coverage_plans::list_assignments).post(coverage_plans::create_assignment),
        )
        .route(
            "/api/coverage-plans/assignments/:id",
            delete(coverage_plans::delete_assignment),
        )
        .route(
            "/api/coverage-plans/resolved/:date",
            get(coverage_plans::resolved_coverage),
        )
        .route(
            "/api/coverage-plans/:id",
            get(coverage_plans::get_plan)
                .patch(coverage_plans::update_plan)
                .delete(coverage_plans::delete_plan),
        )
        .route(
            "/api/coverage-plans/:id/slots",
            get(coverage_plans::list_slots),
        )
        .route(
            "/api/coverage-plans/:id/slots/bulk",
            post(coverage_plans::bulk_upsert_slots),
        )
        // Duty Positions
        .route(
            "/api/duty-positions",
            get(duty_positions::list_positions).post(duty_positions::create_position),
        )
        .route(
            "/api/duty-positions/:id",
            patch(duty_positions::update_position).delete(duty_positions::delete_position),
        )
        // Duty Assignments
        .route(
            "/api/duty-assignments",
            get(duty_positions::list_assignments).post(duty_positions::create_assignment),
        )
        .route(
            "/api/duty-assignments/:id",
            patch(duty_positions::update_assignment).delete(duty_positions::delete_assignment),
        )
        // Leave types
        .route("/api/leave/types", get(leave::list_types))
        // Leave balances (put /adjust before /:user_id to avoid param capture)
        .route("/api/leave/balances", get(leave_balances::list))
        .route("/api/leave/balances/adjust", post(leave_balances::adjust))
        .route(
            "/api/leave/balances/:user_id/history",
            get(leave_balances::history),
        )
        // Accrual schedules
        .route(
            "/api/leave/accrual-schedules",
            get(leave_balances::list_accrual_schedules)
                .post(leave_balances::create_accrual_schedule),
        )
        .route(
            "/api/leave/accrual-schedules/:id",
            patch(leave_balances::update_accrual_schedule)
                .delete(leave_balances::delete_accrual_schedule),
        )
        // Leave requests
        .route("/api/leave", get(leave::list).post(leave::create))
        .route("/api/leave/bulk-review", post(leave::bulk_review))
        .route(
            "/api/leave/carryover-enforcement",
            post(leave::carryover_enforcement),
        )
        .route("/api/leave/longevity-credit", post(leave::longevity_credit))
        // Holiday sellback
        .route(
            "/api/leave/sellback",
            get(leave_sellback::list).post(leave_sellback::create),
        )
        .route(
            "/api/leave/sellback/:id/review",
            patch(leave_sellback::review),
        )
        .route(
            "/api/leave/sellback/:id/cancel",
            patch(leave_sellback::cancel),
        )
        // Sick leave donations
        .route(
            "/api/leave/donations",
            get(leave_donation::list).post(leave_donation::create),
        )
        .route(
            "/api/leave/donations/:id/review",
            patch(leave_donation::review),
        )
        .route(
            "/api/leave/donations/:id/cancel",
            patch(leave_donation::cancel),
        )
        .route("/api/leave/:id", get(leave::get_one))
        .route("/api/leave/:id/cancel", patch(leave::cancel))
        .route("/api/leave/:id/review", patch(leave::review))
        // Trades
        .route("/api/trades", get(trades::list).post(trades::create))
        .route("/api/trades/bulk-review", post(trades::bulk_review))
        .route("/api/trades/:id", get(trades::get_one))
        .route("/api/trades/:id/cancel", patch(trades::cancel))
        .route("/api/trades/:id/respond", patch(trades::respond))
        .route("/api/trades/:id/review", patch(trades::review))
        // Callout
        .route(
            "/api/callout/events",
            get(callout::list_events).post(callout::create_event),
        )
        .route("/api/callout/events/:id", get(callout::get_event))
        .route("/api/callout/events/:id/queue", get(callout::callout_list))
        .route(
            "/api/callout/events/:id/attempt",
            post(callout::record_attempt),
        )
        .route(
            "/api/callout/events/:id/cancel",
            patch(callout::cancel_event),
        )
        .route(
            "/api/callout/events/:id/cancel-ot",
            post(callout::cancel_ot_assignment),
        )
        // GET /volunteers stays here; POST /volunteer and POST /bump are rate-limited in main.rs
        .route(
            "/api/callout/events/:id/volunteers",
            get(ot::list_volunteers),
        )
        .route(
            "/api/callout/events/:id/bump-requests",
            get(callout::list_bump_requests),
        )
        .route(
            "/api/callout/bump-requests/:id/review",
            patch(callout::review_bump_request),
        )
        .route("/api/callout/events/:id/step", patch(ot::advance_step))
        // Vacation Bids
        .route(
            "/api/vacation-bids/periods",
            get(vacation_bids::list_periods).post(vacation_bids::create_period),
        )
        .route(
            "/api/vacation-bids/periods/:id",
            delete(vacation_bids::delete_period),
        )
        .route(
            "/api/vacation-bids/periods/:id/open-bidding",
            post(vacation_bids::open_bidding),
        )
        .route(
            "/api/vacation-bids/periods/:id/bid-windows",
            get(vacation_bids::list_windows),
        )
        .route(
            "/api/vacation-bids/periods/:id/process-bids",
            post(vacation_bids::process_bids),
        )
        .route(
            "/api/vacation-bids/bid-windows/:id",
            get(vacation_bids::get_window),
        )
        .route(
            "/api/vacation-bids/bid-windows/:id/submit",
            post(vacation_bids::submit_bid),
        )
        // Holidays
        .route("/api/holidays", get(holidays::list).post(holidays::create))
        .route(
            "/api/holidays/:id",
            patch(holidays::update).delete(holidays::delete),
        )
        // Notifications (static sub-paths before /:id to avoid param capture)
        .route("/api/notifications", get(notifications::list))
        .route(
            "/api/notifications/unread-count",
            get(notifications::unread_count),
        )
        .route(
            "/api/notifications/read-all",
            post(notifications::mark_all_read),
        )
        .route(
            "/api/notifications/:id/read",
            patch(notifications::mark_read),
        )
        .route("/api/notifications/:id", delete(notifications::delete))
        // Reports
        .route("/api/reports/coverage", get(reports::coverage))
        .route("/api/reports/ot-summary", get(reports::ot_summary))
        .route("/api/reports/leave-summary", get(reports::leave_summary))
        .route("/api/reports/ot-by-period", get(reports::ot_by_period))
        .route("/api/reports/work-summary", get(reports::work_summary))
        // Saved Filters
        .route(
            "/api/saved-filters",
            get(saved_filters::list).post(saved_filters::create),
        )
        .route("/api/saved-filters/:id", delete(saved_filters::delete))
        .route(
            "/api/saved-filters/:id/default",
            patch(saved_filters::set_default),
        )
        // Shift Patterns
        .route(
            "/api/shift-patterns",
            get(shift_patterns::list).post(shift_patterns::create),
        )
        .route(
            "/api/shift-patterns/:id",
            patch(shift_patterns::update).delete(shift_patterns::delete),
        )
        .route("/api/shift-patterns/:id/cycle", get(shift_patterns::cycle))
        // Shift Pattern Assignments
        .route(
            "/api/shift-pattern-assignments",
            get(shift_patterns::list_assignments).post(shift_patterns::create_assignment),
        )
        .route(
            "/api/shift-pattern-assignments/:id",
            delete(shift_patterns::delete_assignment),
        )
        // Organization settings
        .route(
            "/api/organization/settings",
            get(organizations::list_settings).patch(organizations::set_setting),
        )
        // OT Queue & Hours
        .route("/api/ot/queue", get(ot::get_queue))
        .route("/api/ot/queue/set-position", patch(ot::set_queue_position))
        .route("/api/ot/hours", get(ot::get_hours))
        .route("/api/ot/hours/adjust", post(ot::adjust_hours))
        // OT Requests (standalone, decoupled from callout)
        .route(
            "/api/ot-requests",
            get(ot_request::list).post(ot_request::create),
        )
        .route(
            "/api/ot-requests/:id",
            get(ot_request::get_one).patch(ot_request::update),
        )
        .route("/api/ot-requests/:id/cancel", patch(ot_request::cancel))
        .route(
            "/api/ot-requests/:id/volunteer",
            post(ot_request::volunteer),
        )
        .route(
            "/api/ot-requests/:id/volunteer/withdraw",
            patch(ot_request::withdraw_volunteer),
        )
        .route("/api/ot-requests/:id/assign", post(ot_request::assign))
        .route(
            "/api/ot-requests/:id/assign/:user_id",
            delete(ot_request::cancel_assignment),
        )
        .with_state(state)
}
