#![allow(dead_code)]
use std::net::SocketAddr;

use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHasher,
};
use sqlx::{postgres::PgPoolOptions, PgPool};
use uuid::Uuid;

use axum::routing::post;
use timeshift_backend::{api, AppState, api::callout, api::ot};

fn database_url() -> String {
    std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must be set — tests write/delete data and should not run against a shared database")
}
const JWT_SECRET: &str = "test-secret-that-is-at-least-32-chars-long!!";
const ACCESS_TOKEN_EXPIRY_MINUTES: u64 = 15;

/// Spin up a real Axum server on a random port, returning its address and the
/// database pool.  All tests share the same dev database; test isolation comes
/// from creating unique orgs/users per test and cleaning up afterwards.
pub async fn setup_test_app() -> (SocketAddr, PgPool) {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url())
        .await
        .expect("Failed to connect to test database");

    // Run migrations to ensure schema is up-to-date
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    let state = AppState {
        pool: pool.clone(),
        jwt_secret: JWT_SECRET.to_string(),
        access_token_expiry_minutes: ACCESS_TOKEN_EXPIRY_MINUTES,
        refresh_token_expiry_days: 30,
        cookie_secure: false,
    };

    // Build the app router. Routes with rate limiting in main.rs are added here
    // without the rate limiter so tests can exercise them normally.
    let login_router = axum::Router::new()
        .route("/api/auth/login", post(api::auth::login))
        .with_state(state.clone());

    // Bump and volunteer routes are rate-limited in main.rs; add them without
    // the limiter for tests.
    let callout_action_router = axum::Router::new()
        .route("/api/callout/events/:id/bump", post(callout::create_bump_request))
        .route("/api/callout/events/:id/volunteer", post(ot::volunteer))
        .with_state(state.clone());

    let app = api::router(state).merge(login_router).merge(callout_action_router);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind to random port");
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    (addr, pool)
}

/// Create a test organization with a unique slug. Returns the org ID.
pub async fn create_test_org(pool: &PgPool, suffix: &str) -> Uuid {
    let id = Uuid::new_v4();
    let slug = format!("test-org-{}-{}", suffix, &id.to_string()[..8]);
    let name = format!("Test Org {}", suffix);

    sqlx::query("INSERT INTO organizations (id, name, slug, timezone) VALUES ($1, $2, $3, 'UTC')")
        .bind(id)
        .bind(&name)
        .bind(&slug)
        .execute(pool)
        .await
        .expect("Failed to create test org");

    id
}

/// Create a test user with Argon2-hashed password. Returns (user_id, plaintext_password).
pub async fn create_test_user(
    pool: &PgPool,
    org_id: Uuid,
    role: &str,
    email: &str,
) -> (Uuid, String) {
    let user_id = Uuid::new_v4();
    let password = "testpass123";
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .expect("Failed to hash password")
        .to_string();

    sqlx::query(
        "INSERT INTO users (id, org_id, first_name, last_name, email, password_hash, role, is_active) \
         VALUES ($1, $2, 'Test', 'User', $3, $4, $5::app_role, true)"
    )
        .bind(user_id)
        .bind(org_id)
        .bind(email)
        .bind(&hash)
        .bind(role)
        .execute(pool)
        .await
        .expect("Failed to create test user");

    (user_id, password.to_string())
}

/// Create an inactive test user. Returns (user_id, plaintext_password).
pub async fn create_inactive_user(pool: &PgPool, org_id: Uuid, email: &str) -> (Uuid, String) {
    let user_id = Uuid::new_v4();
    let password = "testpass123";
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .expect("Failed to hash password")
        .to_string();

    sqlx::query(
        "INSERT INTO users (id, org_id, first_name, last_name, email, password_hash, role, is_active) \
         VALUES ($1, $2, 'Inactive', 'User', $3, $4, 'employee'::app_role, false)"
    )
        .bind(user_id)
        .bind(org_id)
        .bind(email)
        .bind(&hash)
        .execute(pool)
        .await
        .expect("Failed to create inactive user");

    (user_id, password.to_string())
}

/// Log in via the HTTP API and return the JWT token (extracted from Set-Cookie header).
pub async fn get_auth_token(addr: SocketAddr, email: &str, password: &str) -> String {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{}/api/auth/login", addr))
        .json(&serde_json::json!({
            "email": email,
            "password": password,
        }))
        .send()
        .await
        .expect("Login request failed");

    assert_eq!(resp.status(), 200, "Login should return 200");

    // Token is now in HttpOnly cookie — extract from Set-Cookie header
    let cookie_header = resp
        .headers()
        .get_all("set-cookie")
        .iter()
        .find_map(|v| {
            let s = v.to_str().ok()?;
            if s.starts_with("auth_token=") {
                Some(s.to_string())
            } else {
                None
            }
        })
        .expect("Response should contain auth_token cookie");

    // Extract the token value from "auth_token=<token>; HttpOnly; ..."
    cookie_header
        .strip_prefix("auth_token=")
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string()
}

/// Create a JWT token that is already expired (exp in the past).
/// Uses the same secret as the test app.
pub fn create_expired_token(user_id: Uuid, org_id: Uuid) -> String {
    use jsonwebtoken::{encode, EncodingKey, Header};
    use timeshift_backend::auth::{Claims, Role};

    let now = time::OffsetDateTime::now_utc();
    let claims = Claims {
        sub: user_id,
        org_id,
        role: Role::Employee,
        exp: (now - time::Duration::hours(1)).unix_timestamp(), // expired 1 hour ago
        iat: (now - time::Duration::hours(2)).unix_timestamp(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .expect("Failed to create expired token")
}

/// Build a reqwest client (reusable across requests in a test).
pub fn http_client() -> reqwest::Client {
    reqwest::Client::new()
}

/// Clean up all test data for a given org. Call this at the end of tests.
pub async fn cleanup_test_org(pool: &PgPool, org_id: Uuid) {
    // Delete in dependency order (child tables first)
    let cleanup_queries = [
        // Vacation bidding chain
        "DELETE FROM vacation_bids WHERE vacation_bid_window_id IN (SELECT vbw.id FROM vacation_bid_windows vbw JOIN vacation_bid_periods vbp ON vbp.id = vbw.vacation_bid_period_id WHERE vbp.org_id = $1)",
        "DELETE FROM vacation_bid_windows WHERE vacation_bid_period_id IN (SELECT id FROM vacation_bid_periods WHERE org_id = $1)",
        "DELETE FROM vacation_bid_periods WHERE org_id = $1",
        // Shift bidding chain
        "DELETE FROM bid_submissions WHERE bid_window_id IN (SELECT bw.id FROM bid_windows bw JOIN schedule_periods sp ON sp.id = bw.period_id WHERE sp.org_id = $1)",
        "DELETE FROM bid_windows WHERE period_id IN (SELECT id FROM schedule_periods WHERE org_id = $1)",
        // Trade requests
        "DELETE FROM trade_requests WHERE org_id = $1",
        // Callout chain
        "DELETE FROM bump_requests WHERE org_id = $1",
        "DELETE FROM ot_volunteers WHERE callout_event_id IN (SELECT ce.id FROM callout_events ce JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id WHERE ss.org_id = $1)",
        "DELETE FROM callout_attempts WHERE event_id IN (SELECT ce.id FROM callout_events ce JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id WHERE ss.org_id = $1)",
        "DELETE FROM callout_events WHERE scheduled_shift_id IN (SELECT id FROM scheduled_shifts WHERE org_id = $1)",
        // Schedule chain
        "DELETE FROM assignments WHERE scheduled_shift_id IN (SELECT id FROM scheduled_shifts WHERE org_id = $1)",
        "DELETE FROM scheduled_shifts WHERE org_id = $1",
        "DELETE FROM slot_assignments WHERE slot_id IN (SELECT ss.id FROM shift_slots ss JOIN teams t ON t.id = ss.team_id WHERE t.org_id = $1)",
        "DELETE FROM shift_slots WHERE team_id IN (SELECT id FROM teams WHERE org_id = $1)",
        "DELETE FROM teams WHERE org_id = $1",
        "DELETE FROM schedule_annotations WHERE org_id = $1",
        "DELETE FROM schedule_periods WHERE org_id = $1",
        // Leave chain
        "DELETE FROM leave_request_lines WHERE leave_request_id IN (SELECT lr.id FROM leave_requests lr JOIN users u ON u.id = lr.user_id WHERE u.org_id = $1)",
        "DELETE FROM accrual_transactions WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)",
        "DELETE FROM leave_balances WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)",
        "DELETE FROM leave_requests WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)",
        "DELETE FROM accrual_schedules WHERE org_id = $1",
        "DELETE FROM leave_types WHERE org_id = $1",
        // OT chain
        "DELETE FROM ot_queue_positions WHERE org_id = $1",
        "DELETE FROM ot_hours WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)",
        "DELETE FROM ot_reasons WHERE org_id = $1",
        // Coverage & shift templates
        "DELETE FROM coverage_requirements WHERE org_id = $1",
        "DELETE FROM shift_templates WHERE org_id = $1",
        // User-related
        "DELETE FROM employee_preferences WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)",
        "DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)",
        "DELETE FROM seniority_records WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)",
        "DELETE FROM users WHERE org_id = $1",
        // Org-level
        "DELETE FROM holiday_calendar WHERE org_id = $1",
        "DELETE FROM org_settings WHERE org_id = $1",
        "DELETE FROM classifications WHERE org_id = $1",
        "DELETE FROM organizations WHERE id = $1",
    ];

    for q in cleanup_queries {
        let _ = sqlx::query(q).bind(org_id).execute(pool).await;
    }
}

/// Create a test classification for an org. Returns the classification ID.
pub async fn create_test_classification(pool: &PgPool, org_id: Uuid) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO classifications (id, org_id, name, abbreviation) VALUES ($1, $2, 'Dispatcher', 'DISP')",
    )
    .bind(id)
    .bind(org_id)
    .execute(pool)
    .await
    .expect("Failed to create test classification");
    id
}

/// Create a test shift template for an org. Returns the template ID.
pub async fn create_test_shift_template(pool: &PgPool, org_id: Uuid) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO shift_templates (id, org_id, name, start_time, end_time, duration_minutes, color) \
         VALUES ($1, $2, 'Day Shift', '07:00:00', '19:00:00', 720, '#3B82F6')",
    )
    .bind(id)
    .bind(org_id)
    .execute(pool)
    .await
    .expect("Failed to create test shift template");
    id
}

/// Create a test scheduled shift. Returns the scheduled shift ID.
pub async fn create_test_scheduled_shift(
    pool: &PgPool,
    org_id: Uuid,
    shift_template_id: Uuid,
    date: time::Date,
) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO scheduled_shifts (id, org_id, shift_template_id, date) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(org_id)
    .bind(shift_template_id)
    .bind(date)
    .execute(pool)
    .await
    .expect("Failed to create test scheduled shift");
    id
}

/// Create a test user with a specific classification. Returns the user ID.
pub async fn create_test_user_with_classification(
    pool: &PgPool,
    org_id: Uuid,
    classification_id: Uuid,
    role: &str,
    email: &str,
) -> (Uuid, String) {
    let user_id = Uuid::new_v4();
    let password = "testpass123";
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .expect("Failed to hash password")
        .to_string();

    sqlx::query(
        "INSERT INTO users (id, org_id, first_name, last_name, email, password_hash, role, classification_id, is_active) \
         VALUES ($1, $2, 'Test', 'User', $3, $4, $5::app_role, $6, true)",
    )
    .bind(user_id)
    .bind(org_id)
    .bind(email)
    .bind(&hash)
    .bind(role)
    .bind(classification_id)
    .execute(pool)
    .await
    .expect("Failed to create test user with classification");

    (user_id, password.to_string())
}

/// Create a callout event directly in the DB. Returns the event ID.
pub async fn create_test_callout_event(
    pool: &PgPool,
    scheduled_shift_id: Uuid,
    initiated_by: Uuid,
    classification_id: Uuid,
) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO callout_events (id, scheduled_shift_id, initiated_by, classification_id, status) \
         VALUES ($1, $2, $3, $4, 'open')",
    )
    .bind(id)
    .bind(scheduled_shift_id)
    .bind(initiated_by)
    .bind(classification_id)
    .execute(pool)
    .await
    .expect("Failed to create test callout event");
    id
}

/// Create a test leave type for an org. Returns the leave type ID.
pub async fn create_test_leave_type(pool: &PgPool, org_id: Uuid, code: &str, name: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO leave_types (id, org_id, code, name, requires_approval, is_active) \
         VALUES ($1, $2, $3, $4, true, true)",
    )
    .bind(id)
    .bind(org_id)
    .bind(code)
    .bind(name)
    .execute(pool)
    .await
    .expect("Failed to create test leave type");
    id
}

/// Create a test assignment (non-OT) for a scheduled shift. Returns the assignment ID.
pub async fn create_test_assignment(
    pool: &PgPool,
    scheduled_shift_id: Uuid,
    user_id: Uuid,
    created_by: Uuid,
) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO assignments (id, scheduled_shift_id, user_id, is_overtime, is_trade, created_by) \
         VALUES ($1, $2, $3, false, false, $4)",
    )
    .bind(id)
    .bind(scheduled_shift_id)
    .bind(user_id)
    .bind(created_by)
    .execute(pool)
    .await
    .expect("Failed to create test assignment");
    id
}

/// Create a test team. Returns the team ID.
pub async fn create_test_team(pool: &PgPool, org_id: Uuid, name: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO teams (id, org_id, name) VALUES ($1, $2, $3)",
    )
    .bind(id)
    .bind(org_id)
    .bind(name)
    .execute(pool)
    .await
    .expect("Failed to create test team");
    id
}
