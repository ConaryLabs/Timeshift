pub mod auth;
pub mod bidding;
pub mod callout;
pub mod classifications;
pub mod coverage;
pub mod employee;
pub mod holidays;
pub mod leave;
pub mod leave_balances;
pub mod organizations;
pub mod ot;
pub mod reports;
pub mod schedule;
pub mod shifts;
pub mod teams;
pub mod trades;
pub mod users;
pub mod vacation_bids;

use crate::AppState;
use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};

pub fn router(state: AppState) -> Router {
    Router::new()
        // Auth (login route is in main.rs with rate limiting)
        .route("/api/auth/me", get(auth::me))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/refresh", post(auth::refresh))
        // Organization (own org only)
        .route(
            "/api/organization",
            get(organizations::get_own).put(organizations::update_own),
        )
        // Classifications
        .route(
            "/api/classifications",
            get(classifications::list).post(classifications::create),
        )
        .route("/api/classifications/:id", put(classifications::update))
        // Teams
        .route(
            "/api/teams",
            get(teams::list_teams).post(teams::create_team),
        )
        .route(
            "/api/teams/:id",
            get(teams::get_team).put(teams::update_team),
        )
        .route(
            "/api/teams/:id/slots",
            get(teams::list_slots).post(teams::create_slot),
        )
        // Shift slots (cross-team update)
        .route("/api/shift-slots/:id", put(teams::update_slot))
        // Employee portal (must be before /api/users/:id to avoid param capture)
        .route(
            "/api/users/me/preferences",
            get(employee::get_preferences).put(employee::update_preferences),
        )
        .route("/api/users/me/schedule", get(employee::my_schedule))
        .route("/api/users/me/dashboard", get(employee::my_dashboard))
        // Users
        .route("/api/users", get(users::list).post(users::create))
        .route(
            "/api/users/:id",
            get(users::get_one)
                .put(users::update)
                .delete(users::deactivate),
        )
        // Shift templates
        .route(
            "/api/shifts/templates",
            get(shifts::list_templates).post(shifts::create_template),
        )
        .route(
            "/api/shifts/templates/:id",
            get(shifts::get_template).put(shifts::update_template),
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
        // Coverage requirements
        .route("/api/coverage", get(coverage::list).post(coverage::create))
        .route(
            "/api/coverage/:id",
            put(coverage::update).delete(coverage::delete),
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
            put(leave_balances::update_accrual_schedule)
                .delete(leave_balances::delete_accrual_schedule),
        )
        // Leave requests
        .route("/api/leave", get(leave::list).post(leave::create))
        .route("/api/leave/bulk-review", post(leave::bulk_review))
        .route("/api/leave/:id", get(leave::get_one).delete(leave::cancel))
        .route("/api/leave/:id/review", patch(leave::review))
        // Trades
        .route("/api/trades", get(trades::list).post(trades::create))
        .route("/api/trades/bulk-review", post(trades::bulk_review))
        .route(
            "/api/trades/:id",
            get(trades::get_one).delete(trades::cancel),
        )
        .route("/api/trades/:id/respond", patch(trades::respond))
        .route("/api/trades/:id/review", patch(trades::review))
        // Callout
        .route(
            "/api/callout/events",
            get(callout::list_events).post(callout::create_event),
        )
        .route("/api/callout/events/:id", get(callout::get_event))
        .route("/api/callout/events/:id/list", get(callout::callout_list))
        .route(
            "/api/callout/events/:id/attempt",
            post(callout::record_attempt),
        )
        .route(
            "/api/callout/events/:id/cancel",
            patch(callout::cancel_event),
        )
        .route("/api/callout/events/:id/volunteer", post(ot::volunteer))
        .route(
            "/api/callout/events/:id/volunteers",
            get(ot::list_volunteers),
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
            "/api/vacation-bids/periods/:id/open",
            post(vacation_bids::open_bidding),
        )
        .route(
            "/api/vacation-bids/periods/:id/windows",
            get(vacation_bids::list_windows),
        )
        .route(
            "/api/vacation-bids/periods/:id/process",
            post(vacation_bids::process_bids),
        )
        .route(
            "/api/vacation-bids/windows/:id",
            get(vacation_bids::get_window),
        )
        .route(
            "/api/vacation-bids/windows/:id/submit",
            post(vacation_bids::submit_bid),
        )
        // Holidays
        .route("/api/holidays", get(holidays::list).post(holidays::create))
        .route(
            "/api/holidays/:id",
            put(holidays::update).delete(holidays::delete),
        )
        // Reports
        .route("/api/reports/coverage", get(reports::coverage))
        .route("/api/reports/ot-summary", get(reports::ot_summary))
        .route("/api/reports/leave-summary", get(reports::leave_summary))
        // Organization settings
        .route(
            "/api/organization/settings",
            get(organizations::list_settings).put(organizations::set_setting),
        )
        // OT Queue & Hours
        .route("/api/ot/queue", get(ot::get_queue))
        .route("/api/ot/queue/reorder", post(ot::reorder_queue))
        .route("/api/ot/hours", get(ot::get_hours))
        .route("/api/ot/hours/adjust", post(ot::adjust_hours))
        .with_state(state)
}
