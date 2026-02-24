mod common;

use uuid::Uuid;

/// Helper to generate a unique email for each test run.
fn unique_email(prefix: &str) -> String {
    format!("{}+{}@test.local", prefix, &Uuid::new_v4().to_string()[..8])
}

/// Shared setup for trade tests: creates org, classification, shift template,
/// two future scheduled shifts, two employees each with an assignment, and a supervisor.
/// Returns (addr, pool, org_id, classification_id,
///          requester_id, requester_email, requester_password, requester_assignment_id,
///          partner_id, partner_email, partner_password, partner_assignment_id,
///          supervisor_email, supervisor_password).
#[allow(clippy::type_complexity)]
async fn setup_trade_scenario(
    suffix: &str,
) -> (
    std::net::SocketAddr,
    sqlx::PgPool,
    Uuid,
    Uuid,
    Uuid,
    String,
    String,
    Uuid,
    Uuid,
    String,
    String,
    Uuid,
    String,
    String,
) {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, suffix).await;
    let classification_id = common::create_test_classification(&pool, org_id).await;
    let shift_template_id = common::create_test_shift_template(&pool, org_id).await;

    // Two future dates for the two shifts being traded
    let date1 = time::Date::from_calendar_date(2027, time::Month::August, 10).unwrap();
    let date2 = time::Date::from_calendar_date(2027, time::Month::August, 12).unwrap();
    let scheduled_shift_id_1 =
        common::create_test_scheduled_shift(&pool, org_id, shift_template_id, date1).await;
    let scheduled_shift_id_2 =
        common::create_test_scheduled_shift(&pool, org_id, shift_template_id, date2).await;

    // Requester employee
    let req_email = unique_email(&format!("{}-req", suffix));
    let (requester_id, req_password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "employee",
        &req_email,
    )
    .await;

    // Partner employee
    let par_email = unique_email(&format!("{}-par", suffix));
    let (partner_id, par_password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "employee",
        &par_email,
    )
    .await;

    // Supervisor
    let sup_email = unique_email(&format!("{}-sup", suffix));
    let (sup_id, sup_password) =
        common::create_test_user(&pool, org_id, "supervisor", &sup_email).await;

    // Assignments: requester has shift1, partner has shift2
    let req_assignment_id =
        common::create_test_assignment(&pool, scheduled_shift_id_1, requester_id, sup_id).await;
    let par_assignment_id =
        common::create_test_assignment(&pool, scheduled_shift_id_2, partner_id, sup_id).await;

    (
        addr,
        pool,
        org_id,
        classification_id,
        requester_id,
        req_email,
        req_password,
        req_assignment_id,
        partner_id,
        par_email,
        par_password,
        par_assignment_id,
        sup_email,
        sup_password,
    )
}

// ---------------------------------------------------------------------------
// Test: Create a valid trade request
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_create_trade_request() {
    let (
        addr,
        pool,
        org_id,
        _classification_id,
        _requester_id,
        req_email,
        req_password,
        req_assignment_id,
        partner_id,
        _par_email,
        _par_password,
        par_assignment_id,
        _sup_email,
        _sup_password,
    ) = setup_trade_scenario("trade-create").await;

    let token = common::get_auth_token(addr, &req_email, &req_password).await;
    let client = common::http_client();

    let resp = client
        .post(format!("http://{}/api/trades", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "partner_id": partner_id,
            "requester_assignment_id": req_assignment_id,
            "partner_assignment_id": par_assignment_id,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200, "Create trade request should return 200");

    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["status"].as_str().unwrap(), "pending_partner");
    assert_eq!(
        body["requester_assignment_id"].as_str().unwrap(),
        req_assignment_id.to_string()
    );
    assert_eq!(
        body["partner_assignment_id"].as_str().unwrap(),
        par_assignment_id.to_string()
    );
    assert_eq!(
        body["partner_id"].as_str().unwrap(),
        partner_id.to_string()
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Self-trade is rejected (cannot trade with yourself)
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_trade_request_self_trade_rejected() {
    let (
        addr,
        pool,
        org_id,
        _classification_id,
        requester_id,
        req_email,
        req_password,
        req_assignment_id,
        _partner_id,
        _par_email,
        _par_password,
        par_assignment_id,
        _sup_email,
        _sup_password,
    ) = setup_trade_scenario("trade-self").await;

    let token = common::get_auth_token(addr, &req_email, &req_password).await;
    let client = common::http_client();

    // Try to trade with yourself
    let resp = client
        .post(format!("http://{}/api/trades", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "partner_id": requester_id,
            "requester_assignment_id": req_assignment_id,
            "partner_assignment_id": par_assignment_id,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(
        resp.status(),
        400,
        "Self-trade should return 400 Bad Request"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Supervisor approves trade (via partner accept + supervisor review)
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_review_trade_approve() {
    let (
        addr,
        pool,
        org_id,
        _classification_id,
        _requester_id,
        req_email,
        req_password,
        req_assignment_id,
        partner_id,
        par_email,
        par_password,
        par_assignment_id,
        sup_email,
        sup_password,
    ) = setup_trade_scenario("trade-approve").await;

    let client = common::http_client();

    // Step 1: Requester creates trade request
    let req_token = common::get_auth_token(addr, &req_email, &req_password).await;
    let resp = client
        .post(format!("http://{}/api/trades", addr))
        .header("Authorization", format!("Bearer {}", req_token))
        .json(&serde_json::json!({
            "partner_id": partner_id,
            "requester_assignment_id": req_assignment_id,
            "partner_assignment_id": par_assignment_id,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let trade: serde_json::Value = resp.json().await.unwrap();
    let trade_id = trade["id"].as_str().unwrap();
    assert_eq!(trade["status"].as_str().unwrap(), "pending_partner");

    // Step 2: Partner accepts the trade
    let par_token = common::get_auth_token(addr, &par_email, &par_password).await;
    let resp = client
        .patch(format!("http://{}/api/trades/{}/respond", addr, trade_id))
        .header("Authorization", format!("Bearer {}", par_token))
        .json(&serde_json::json!({
            "accept": true,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "Partner accept should return 200");
    let trade: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(trade["status"].as_str().unwrap(), "pending_approval");

    // Step 3: Supervisor approves the trade
    let sup_token = common::get_auth_token(addr, &sup_email, &sup_password).await;
    let resp = client
        .patch(format!("http://{}/api/trades/{}/review", addr, trade_id))
        .header("Authorization", format!("Bearer {}", sup_token))
        .json(&serde_json::json!({
            "status": "approved",
            "reviewer_notes": "Trade approved",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "Supervisor approve should return 200");

    let reviewed: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(reviewed["status"].as_str().unwrap(), "approved");
    assert!(reviewed["reviewed_by"].as_str().is_some());

    // Verify assignments were swapped: requester's assignment now belongs to partner
    let req_user_id: Uuid = sqlx::query_scalar(
        "SELECT user_id FROM assignments WHERE id = $1",
    )
    .bind(req_assignment_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(req_user_id, partner_id, "Requester's assignment should now belong to partner");

    // Partner's assignment now belongs to requester
    let par_user_id: Uuid = sqlx::query_scalar(
        "SELECT user_id FROM assignments WHERE id = $1",
    )
    .bind(par_assignment_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(par_user_id, _requester_id, "Partner's assignment should now belong to requester");

    // Both assignments should have is_trade = true
    let req_is_trade: bool = sqlx::query_scalar(
        "SELECT is_trade FROM assignments WHERE id = $1",
    )
    .bind(req_assignment_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(req_is_trade, "Requester's assignment should have is_trade = true");

    let par_is_trade: bool = sqlx::query_scalar(
        "SELECT is_trade FROM assignments WHERE id = $1",
    )
    .bind(par_assignment_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(par_is_trade, "Partner's assignment should have is_trade = true");

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Employee cannot approve a trade (403 Forbidden)
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_employee_cannot_approve_trade() {
    let (
        addr,
        pool,
        org_id,
        _classification_id,
        _requester_id,
        req_email,
        req_password,
        req_assignment_id,
        partner_id,
        par_email,
        par_password,
        par_assignment_id,
        _sup_email,
        _sup_password,
    ) = setup_trade_scenario("trade-emp-approve").await;

    let client = common::http_client();

    // Step 1: Requester creates trade request
    let req_token = common::get_auth_token(addr, &req_email, &req_password).await;
    let resp = client
        .post(format!("http://{}/api/trades", addr))
        .header("Authorization", format!("Bearer {}", req_token))
        .json(&serde_json::json!({
            "partner_id": partner_id,
            "requester_assignment_id": req_assignment_id,
            "partner_assignment_id": par_assignment_id,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let trade: serde_json::Value = resp.json().await.unwrap();
    let trade_id = trade["id"].as_str().unwrap();

    // Step 2: Partner accepts the trade
    let par_token = common::get_auth_token(addr, &par_email, &par_password).await;
    let resp = client
        .patch(format!("http://{}/api/trades/{}/respond", addr, trade_id))
        .header("Authorization", format!("Bearer {}", par_token))
        .json(&serde_json::json!({
            "accept": true,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let trade: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(trade["status"].as_str().unwrap(), "pending_approval");

    // Step 3: Employee (requester) tries to approve the trade
    let resp = client
        .patch(format!("http://{}/api/trades/{}/review", addr, trade_id))
        .header("Authorization", format!("Bearer {}", req_token))
        .json(&serde_json::json!({
            "status": "approved",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        403,
        "Employee should not be able to approve trades"
    );

    common::cleanup_test_org(&pool, org_id).await;
}
