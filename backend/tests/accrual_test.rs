mod common;

use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHasher,
};
use common::{cleanup_test_org, create_test_org, create_test_user, get_auth_token, http_client, setup_test_app};
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// Helper: create a leave type for the test org
async fn create_leave_type(pool: &PgPool, org_id: Uuid, code: &str, name: &str) -> Uuid {
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
    .expect("create leave type");
    id
}

/// Helper: create an accrual schedule
#[allow(clippy::too_many_arguments)]
async fn create_schedule(
    pool: &PgPool,
    org_id: Uuid,
    leave_type_id: Uuid,
    employee_type: &str,
    bargaining_unit: Option<&str>,
    yos_min: i32,
    yos_max: Option<i32>,
    hours_per_period: f64,
    max_balance: Option<f64>,
) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO accrual_schedules (id, org_id, leave_type_id, employee_type, bargaining_unit, \
         years_of_service_min, years_of_service_max, hours_per_pay_period, max_balance_hours, effective_date) \
         VALUES ($1, $2, $3, $4::TEXT::employee_type_enum, $5, $6, $7, $8::FLOAT8::NUMERIC, $9::FLOAT8::NUMERIC, '2025-01-01')"
    )
    .bind(id)
    .bind(org_id)
    .bind(leave_type_id)
    .bind(employee_type)
    .bind(bargaining_unit)
    .bind(yos_min)
    .bind(yos_max)
    .bind(hours_per_period)
    .bind(max_balance)
    .execute(pool)
    .await
    .expect("create schedule");
    id
}

/// Helper: ensure the test org has an admin user (needed by accrual engine for created_by).
/// Idempotent — safe to call multiple times for the same org.
async fn ensure_admin_user(pool: &PgPool, org_id: Uuid) {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE org_id = $1 AND role = 'admin' AND is_active = true)",
    )
    .bind(org_id)
    .fetch_one(pool)
    .await
    .unwrap();

    if !exists {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(b"admin123", &salt)
            .unwrap()
            .to_string();

        sqlx::query(
            "INSERT INTO users (id, org_id, first_name, last_name, email, password_hash, role, \
             employee_type, bargaining_unit, is_active) \
             VALUES ($1, $2, 'System', 'Admin', $3, $4, 'admin'::app_role, \
             'temp_part_time'::employee_type_enum, 'non_represented', true)",
        )
        .bind(Uuid::new_v4())
        .bind(org_id)
        .bind(format!("admin-{}@accrual.test", &org_id.to_string()[..8]))
        .bind(&hash)
        .execute(pool)
        .await
        .expect("create admin user for accrual");
    }
}

/// Helper: create a user with employee_type and bargaining_unit, plus a seniority record
#[allow(clippy::too_many_arguments)]
async fn create_accrual_user(
    pool: &PgPool,
    org_id: Uuid,
    email: &str,
    first: &str,
    last: &str,
    employee_type: &str,
    bargaining_unit: &str,
    hire_date: &str,
) -> Uuid {
    let user_id = Uuid::new_v4();
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(b"testpass123", &salt)
        .unwrap()
        .to_string();

    sqlx::query(
        "INSERT INTO users (id, org_id, first_name, last_name, email, password_hash, role, \
         employee_type, bargaining_unit, hire_date, is_active) \
         VALUES ($1, $2, $3, $4, $5, $6, 'employee'::app_role, \
         $7::TEXT::employee_type_enum, $8, $9::DATE, true)",
    )
    .bind(user_id)
    .bind(org_id)
    .bind(first)
    .bind(last)
    .bind(email)
    .bind(&hash)
    .bind(employee_type)
    .bind(bargaining_unit)
    .bind(hire_date)
    .execute(pool)
    .await
    .expect("create accrual user");

    // Create seniority record with overall_seniority_date = hire_date
    sqlx::query(
        "INSERT INTO seniority_records (id, user_id, org_id, overall_seniority_date) \
         VALUES ($1, $2, $3, $4::DATE)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(org_id)
    .bind(hire_date)
    .execute(pool)
    .await
    .expect("create seniority record");

    user_id
}

/// Helper: get a user's leave balance
async fn get_balance(pool: &PgPool, org_id: Uuid, user_id: Uuid, leave_type_id: Uuid) -> f64 {
    let row = sqlx::query(
        "SELECT CAST(balance_hours AS FLOAT8) AS balance FROM leave_balances \
         WHERE org_id = $1 AND user_id = $2 AND leave_type_id = $3",
    )
    .bind(org_id)
    .bind(user_id)
    .bind(leave_type_id)
    .fetch_optional(pool)
    .await
    .unwrap();

    row.map(|r| r.get::<f64, _>("balance")).unwrap_or(0.0)
}

/// Helper: count accrual transactions for a user
async fn count_transactions(pool: &PgPool, user_id: Uuid, leave_type_id: Uuid) -> i64 {
    let row = sqlx::query(
        "SELECT COUNT(*) AS cnt FROM accrual_transactions \
         WHERE user_id = $1 AND leave_type_id = $2 AND reason = 'accrual'",
    )
    .bind(user_id)
    .bind(leave_type_id)
    .fetch_one(pool)
    .await
    .unwrap();

    row.get::<i64, _>("cnt")
}

// ─── Tests ────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_accrual_basic_credit() {
    let (_addr, pool) = setup_test_app().await;
    let org_id = create_test_org(&pool, "accrual-basic").await;
    ensure_admin_user(&pool, org_id).await;

    let vac_id = create_leave_type(&pool, org_id, "VAC", "Vacation").await;
    // Schedule: 4.0 hrs/period for regular_full_time, 0+ YOS
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 0, None, 4.0, None).await;

    // User hired 2 years ago
    let user_id = create_accrual_user(
        &pool, org_id, "basic@accrual.test", "Alice", "Basic",
        "regular_full_time", "union_a", "2024-01-01",
    ).await;

    let result = timeshift_backend::services::accrual::run_org_accrual(
        &pool, org_id, "Test Org", "UTC", false,
    ).await.expect("accrual run");

    assert_eq!(result.credits_applied, 1);
    assert!(result.users_processed >= 1, "At least the test user should be processed");
    assert!((get_balance(&pool, org_id, user_id, vac_id).await - 4.0).abs() < 0.01);
    assert_eq!(count_transactions(&pool, user_id, vac_id).await, 1);

    cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn test_accrual_yos_tier_matching() {
    let (_addr, pool) = setup_test_app().await;
    let org_id = create_test_org(&pool, "accrual-yos").await;
    ensure_admin_user(&pool, org_id).await;

    let vac_id = create_leave_type(&pool, org_id, "VAC", "Vacation").await;

    // Tier 1: 0-5 YOS → 3.0 hrs
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 0, Some(5), 3.0, None).await;
    // Tier 2: 5-10 YOS → 5.0 hrs
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 5, Some(10), 5.0, None).await;
    // Tier 3: 10+ YOS → 7.0 hrs
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 10, None, 7.0, None).await;

    // User with 2 YOS → should match tier 1 (3.0 hrs)
    let user_new = create_accrual_user(
        &pool, org_id, "new@accrual.test", "New", "Employee",
        "regular_full_time", "union_a", "2024-01-01",
    ).await;

    // User with ~8 YOS → should match tier 2 (5.0 hrs)
    let user_mid = create_accrual_user(
        &pool, org_id, "mid@accrual.test", "Mid", "Employee",
        "regular_full_time", "union_a", "2018-01-01",
    ).await;

    // User with ~15 YOS → should match tier 3 (7.0 hrs)
    let user_senior = create_accrual_user(
        &pool, org_id, "senior@accrual.test", "Senior", "Employee",
        "regular_full_time", "union_a", "2011-01-01",
    ).await;

    let result = timeshift_backend::services::accrual::run_org_accrual(
        &pool, org_id, "Test Org", "UTC", false,
    ).await.expect("accrual run");

    assert_eq!(result.credits_applied, 3);

    let bal_new = get_balance(&pool, org_id, user_new, vac_id).await;
    let bal_mid = get_balance(&pool, org_id, user_mid, vac_id).await;
    let bal_senior = get_balance(&pool, org_id, user_senior, vac_id).await;

    assert!((bal_new - 3.0).abs() < 0.01, "New employee should get 3.0, got {bal_new}");
    assert!((bal_mid - 5.0).abs() < 0.01, "Mid employee should get 5.0, got {bal_mid}");
    assert!((bal_senior - 7.0).abs() < 0.01, "Senior employee should get 7.0, got {bal_senior}");

    cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn test_accrual_bu_precedence() {
    let (_addr, pool) = setup_test_app().await;
    let org_id = create_test_org(&pool, "accrual-bu").await;
    ensure_admin_user(&pool, org_id).await;

    let vac_id = create_leave_type(&pool, org_id, "VAC", "Vacation").await;

    // Wildcard schedule (NULL BU): 2.0 hrs
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 0, None, 2.0, None).await;
    // BU-specific schedule for union_a: 4.0 hrs
    create_schedule(&pool, org_id, vac_id, "regular_full_time", Some("union_a"), 0, None, 4.0, None).await;

    // Union A user → should get BU-specific (4.0)
    let user_union_a = create_accrual_user(
        &pool, org_id, "union-a@accrual.test", "UnionA", "Employee",
        "regular_full_time", "union_a", "2024-01-01",
    ).await;

    // Union B user → should fall back to wildcard (2.0)
    let user_union_b = create_accrual_user(
        &pool, org_id, "union-b@accrual.test", "UnionB", "Employee",
        "regular_full_time", "union_b", "2024-01-01",
    ).await;

    let result = timeshift_backend::services::accrual::run_org_accrual(
        &pool, org_id, "Test Org", "UTC", false,
    ).await.expect("accrual run");

    assert_eq!(result.credits_applied, 2);

    let bal_union_a = get_balance(&pool, org_id, user_union_a, vac_id).await;
    let bal_union_b = get_balance(&pool, org_id, user_union_b, vac_id).await;

    assert!((bal_union_a - 4.0).abs() < 0.01, "Union A should get 4.0 (BU-specific), got {bal_union_a}");
    assert!((bal_union_b - 2.0).abs() < 0.01, "Union B should get 2.0 (wildcard), got {bal_union_b}");

    cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn test_accrual_pause_skips_user() {
    let (_addr, pool) = setup_test_app().await;
    let org_id = create_test_org(&pool, "accrual-pause").await;
    ensure_admin_user(&pool, org_id).await;

    let vac_id = create_leave_type(&pool, org_id, "VAC", "Vacation").await;
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 0, None, 4.0, None).await;

    // Create a user that is paused
    let user_id = create_accrual_user(
        &pool, org_id, "paused@accrual.test", "Paused", "Employee",
        "regular_full_time", "union_a", "2024-01-01",
    ).await;

    // Set leave_accrual_paused_at
    sqlx::query("UPDATE users SET leave_accrual_paused_at = CURRENT_DATE WHERE id = $1")
        .bind(user_id)
        .execute(&pool)
        .await
        .expect("pause user");

    let result = timeshift_backend::services::accrual::run_org_accrual(
        &pool, org_id, "Test Org", "UTC", false,
    ).await.expect("accrual run");

    assert_eq!(result.credits_applied, 0, "Paused user should get no credits");
    assert_eq!(result.credits_skipped_paused, 1, "Should count 1 paused skip");
    assert!((get_balance(&pool, org_id, user_id, vac_id).await).abs() < 0.01);

    cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn test_accrual_max_balance_cap() {
    let (_addr, pool) = setup_test_app().await;
    let org_id = create_test_org(&pool, "accrual-cap").await;
    ensure_admin_user(&pool, org_id).await;

    let vac_id = create_leave_type(&pool, org_id, "VAC", "Vacation").await;
    // Schedule: 4.0 hrs/period, max 5.0 hrs balance
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 0, None, 4.0, Some(5.0)).await;

    let user_id = create_accrual_user(
        &pool, org_id, "cap@accrual.test", "Capped", "Employee",
        "regular_full_time", "union_a", "2024-01-01",
    ).await;

    // Pre-set balance to 3.0 hrs (so 4.0 would exceed cap of 5.0)
    sqlx::query(
        "INSERT INTO leave_balances (id, org_id, user_id, leave_type_id, balance_hours, as_of_date) \
         VALUES ($1, $2, $3, $4, 3.0::NUMERIC, CURRENT_DATE)",
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind(user_id)
    .bind(vac_id)
    .execute(&pool)
    .await
    .expect("pre-set balance");

    // Clear accrual_last_run_date to prevent pollution from concurrent run_all_orgs
    sqlx::query("DELETE FROM org_settings WHERE org_id = $1 AND key = 'accrual_last_run_date'")
        .bind(org_id)
        .execute(&pool)
        .await
        .expect("clear last run date");

    let result = timeshift_backend::services::accrual::run_org_accrual(
        &pool, org_id, "Test Org", "UTC", false,
    ).await.expect("accrual run");

    assert_eq!(result.credits_applied, 1);
    let detail = &result.details[0];
    assert!(detail.capped, "Credit should be marked as capped");
    assert!((detail.hours_credited - 2.0).abs() < 0.01, "Should only credit 2.0 to reach cap, got {}", detail.hours_credited);

    let bal = get_balance(&pool, org_id, user_id, vac_id).await;
    assert!((bal - 5.0).abs() < 0.01, "Balance should be at cap (5.0), got {bal}");

    cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn test_accrual_max_balance_already_at_cap() {
    let (_addr, pool) = setup_test_app().await;
    let org_id = create_test_org(&pool, "accrual-atcap").await;
    ensure_admin_user(&pool, org_id).await;

    let vac_id = create_leave_type(&pool, org_id, "VAC", "Vacation").await;
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 0, None, 4.0, Some(10.0)).await;

    let user_id = create_accrual_user(
        &pool, org_id, "atcap@accrual.test", "AtCap", "Employee",
        "regular_full_time", "union_a", "2024-01-01",
    ).await;

    // Pre-set balance at exactly the cap
    sqlx::query(
        "INSERT INTO leave_balances (id, org_id, user_id, leave_type_id, balance_hours, as_of_date) \
         VALUES ($1, $2, $3, $4, 10.0::NUMERIC, CURRENT_DATE)",
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind(user_id)
    .bind(vac_id)
    .execute(&pool)
    .await
    .expect("pre-set balance at cap");

    // Clear accrual_last_run_date to prevent pollution from concurrent run_all_orgs
    sqlx::query("DELETE FROM org_settings WHERE org_id = $1 AND key = 'accrual_last_run_date'")
        .bind(org_id)
        .execute(&pool)
        .await
        .expect("clear last run date");

    let result = timeshift_backend::services::accrual::run_org_accrual(
        &pool, org_id, "Test Org", "UTC", false,
    ).await.expect("accrual run");

    assert_eq!(result.credits_applied, 0, "No credits when already at cap");
    assert_eq!(result.credits_skipped_capped, 1, "Should count 1 capped skip");

    cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn test_accrual_idempotent_rerun() {
    let (_addr, pool) = setup_test_app().await;
    let org_id = create_test_org(&pool, "accrual-idempotent").await;
    ensure_admin_user(&pool, org_id).await;

    let vac_id = create_leave_type(&pool, org_id, "VAC", "Vacation").await;
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 0, None, 4.0, None).await;

    let user_id = create_accrual_user(
        &pool, org_id, "idempotent@accrual.test", "Idempotent", "Employee",
        "regular_full_time", "union_a", "2024-01-01",
    ).await;

    // First run
    let result1 = timeshift_backend::services::accrual::run_org_accrual(
        &pool, org_id, "Test Org", "UTC", false,
    ).await.expect("first run");
    assert_eq!(result1.credits_applied, 1);

    // Set the last-run date to today so run_all_orgs will skip
    let today_str = format!("{}", time::OffsetDateTime::now_utc().date());
    let today_json = serde_json::json!(today_str);
    sqlx::query(
        "INSERT INTO org_settings (id, org_id, key, value, updated_at) \
         VALUES ($1, $2, 'accrual_last_run_date', $3, NOW()) \
         ON CONFLICT (org_id, key) DO UPDATE SET value = $3, updated_at = NOW()",
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind(&today_json)
    .execute(&pool)
    .await
    .expect("set last run date");

    // Second run via run_all_orgs should skip (idempotent)
    let results = timeshift_backend::services::accrual::run_all_orgs(&pool, false)
        .await
        .expect("second run");

    // Our test org should have been skipped (present in results but 0 credits)
    let our_result = results.iter().find(|r| r.org_id == org_id);
    if let Some(r) = our_result {
        assert_eq!(r.credits_applied, 0, "Org should apply 0 credits on re-run (already ran today)");
    }
    // If not present at all, that's also fine (fully skipped)

    // Balance should still be 4.0, not 8.0
    let bal = get_balance(&pool, org_id, user_id, vac_id).await;
    assert!((bal - 4.0).abs() < 0.01, "Balance should be 4.0 (not double-credited), got {bal}");

    cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn test_accrual_dry_run() {
    let (_addr, pool) = setup_test_app().await;
    let org_id = create_test_org(&pool, "accrual-dryrun").await;
    ensure_admin_user(&pool, org_id).await;

    let vac_id = create_leave_type(&pool, org_id, "VAC", "Vacation").await;
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 0, None, 4.0, None).await;

    let user_id = create_accrual_user(
        &pool, org_id, "dryrun@accrual.test", "DryRun", "Employee",
        "regular_full_time", "union_a", "2024-01-01",
    ).await;

    let result = timeshift_backend::services::accrual::run_org_accrual(
        &pool, org_id, "Test Org", "UTC", true, // dry_run = true
    ).await.expect("dry run");

    assert_eq!(result.credits_applied, 1, "Dry run should still count credits");
    assert!(!result.details.is_empty(), "Details should be populated");
    assert!((result.details[0].hours_credited - 4.0).abs() < 0.01);

    // But no actual writes
    let bal = get_balance(&pool, org_id, user_id, vac_id).await;
    assert!((bal).abs() < 0.01, "Dry run should not change balance, got {bal}");
    assert_eq!(count_transactions(&pool, user_id, vac_id).await, 0, "No transactions in dry run");

    cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn test_accrual_admin_endpoint() {
    let (addr, pool) = setup_test_app().await;
    let org_id = create_test_org(&pool, "accrual-endpoint").await;

    let (_admin_id, admin_pw) = create_test_user(&pool, org_id, "admin", "accrual-admin@accrual.test").await;
    let token = get_auth_token(addr, "accrual-admin@accrual.test", &admin_pw).await;

    let vac_id = create_leave_type(&pool, org_id, "VAC", "Vacation").await;
    create_schedule(&pool, org_id, vac_id, "regular_full_time", None, 0, None, 4.0, None).await;

    // The admin user itself should get the accrual (it's active, regular_full_time)
    // But create_test_user doesn't set employee_type, so let's create a proper user
    let _user_id = create_accrual_user(
        &pool, org_id, "endpoint-emp@accrual.test", "Endpoint", "Employee",
        "regular_full_time", "union_a", "2024-01-01",
    ).await;

    let client = http_client();

    // Test dry run
    let resp = client
        .post(format!("http://{}/api/leave/accrual-run?dry_run=true", addr))
        .bearer_auth(&token)
        .send()
        .await
        .expect("dry run request");
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert!(body["credits_applied"].as_u64().unwrap() >= 1);

    // Test actual run
    let resp = client
        .post(format!("http://{}/api/leave/accrual-run", addr))
        .bearer_auth(&token)
        .send()
        .await
        .expect("accrual run request");
    assert_eq!(resp.status(), 200);

    cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn test_accrual_endpoint_forbidden_for_employee() {
    let (addr, pool) = setup_test_app().await;
    let org_id = create_test_org(&pool, "accrual-forbid").await;

    let (_emp_id, emp_pw) = create_test_user(&pool, org_id, "employee", "accrual-emp@accrual.test").await;
    let token = get_auth_token(addr, "accrual-emp@accrual.test", &emp_pw).await;

    let client = http_client();
    let resp = client
        .post(format!("http://{}/api/leave/accrual-run", addr))
        .bearer_auth(&token)
        .send()
        .await
        .expect("forbidden request");
    assert_eq!(resp.status(), 403);

    cleanup_test_org(&pool, org_id).await;
}
