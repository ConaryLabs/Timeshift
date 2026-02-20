#![allow(dead_code)]
use std::net::SocketAddr;

use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHasher,
};
use sqlx::{postgres::PgPoolOptions, PgPool};
use uuid::Uuid;

use axum::routing::post;
use timeshift_backend::{api, AppState};

fn database_url() -> String {
    std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must be set — tests write/delete data and should not run against a shared database")
}
const JWT_SECRET: &str = "test-secret-that-is-at-least-32-chars-long!!";
const JWT_EXPIRY_HOURS: u64 = 12;

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
        jwt_expiry_hours: JWT_EXPIRY_HOURS,
    };

    // Build the app router. The login route was moved to main.rs (with rate
    // limiting) so we add it here for tests without the rate limiter.
    let login_router = axum::Router::new()
        .route("/api/auth/login", post(api::auth::login))
        .with_state(state.clone());

    let app = api::router(state).merge(login_router);

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

/// Log in via the HTTP API and return the JWT token.
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

    let body: serde_json::Value = resp.json().await.expect("Failed to parse login response");
    body["token"]
        .as_str()
        .expect("Response should contain token")
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
        "DELETE FROM callout_attempts WHERE event_id IN (SELECT ce.id FROM callout_events ce JOIN scheduled_shifts ss ON ss.id = ce.scheduled_shift_id WHERE ss.org_id = $1)",
        "DELETE FROM callout_events WHERE scheduled_shift_id IN (SELECT id FROM scheduled_shifts WHERE org_id = $1)",
        "DELETE FROM assignments WHERE scheduled_shift_id IN (SELECT id FROM scheduled_shifts WHERE org_id = $1)",
        "DELETE FROM scheduled_shifts WHERE org_id = $1",
        "DELETE FROM slot_assignments WHERE slot_id IN (SELECT ss.id FROM shift_slots ss JOIN teams t ON t.id = ss.team_id WHERE t.org_id = $1)",
        "DELETE FROM shift_slots WHERE team_id IN (SELECT id FROM teams WHERE org_id = $1)",
        "DELETE FROM teams WHERE org_id = $1",
        "DELETE FROM shift_templates WHERE org_id = $1",
        "DELETE FROM schedule_periods WHERE org_id = $1",
        "DELETE FROM leave_requests WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)",
        "DELETE FROM leave_types WHERE org_id = $1",
        "DELETE FROM ot_hours WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)",
        "DELETE FROM ot_reasons WHERE org_id = $1",
        "DELETE FROM seniority_records WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)",
        "DELETE FROM users WHERE org_id = $1",
        "DELETE FROM classifications WHERE org_id = $1",
        "DELETE FROM organizations WHERE id = $1",
    ];

    for q in cleanup_queries {
        let _ = sqlx::query(q).bind(org_id).execute(pool).await;
    }
}
