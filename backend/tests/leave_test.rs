mod common;

use uuid::Uuid;

/// Helper to generate a unique email for each test run.
fn unique_email(prefix: &str) -> String {
    format!("{}+{}@test.local", prefix, &Uuid::new_v4().to_string()[..8])
}

/// Convert a (year, month, day) to the serde_json value that `time::Date` serializes to.
/// time 0.3 with `serde` feature (no `serde-human-readable`) uses `[year, ordinal_day]`.
fn date_json(year: i32, month: u8, day: u8) -> serde_json::Value {
    let d = time::Date::from_calendar_date(
        year,
        time::Month::try_from(month).unwrap(),
        day,
    )
    .unwrap();
    serde_json::json!([d.year(), d.ordinal()])
}

// ---------------------------------------------------------------------------
// Test: Create a valid leave request returns pending status
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_create_leave_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "leave-create").await;
    let leave_type_id =
        common::create_test_leave_type(&pool, org_id, "vacation", "Vacation").await;
    let email = unique_email("leave-create-emp");
    let (_, password) = common::create_test_user(&pool, org_id, "employee", &email).await;

    let token = common::get_auth_token(addr, &email, &password).await;
    let client = common::http_client();

    let resp = client
        .post(format!("http://{}/api/leave", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "leave_type_id": leave_type_id,
            "start_date": date_json(2027, 7, 1),
            "end_date": date_json(2027, 7, 5),
            "hours": 40.0,
            "reason": "Family vacation",
        }))
        .send()
        .await
        .unwrap();

    let status = resp.status();
    let body_text = resp.text().await.unwrap();
    assert_eq!(status, 200, "Create leave request should return 200, body: {}", body_text);

    let body: serde_json::Value = serde_json::from_str(&body_text).unwrap();
    assert_eq!(body["status"].as_str().unwrap(), "pending");
    assert_eq!(body["leave_type_code"].as_str().unwrap(), "vacation");
    assert_eq!(body["start_date"], date_json(2027, 7, 1));
    assert_eq!(body["end_date"], date_json(2027, 7, 5));
    assert!(body["hours"].as_f64().is_some());
    assert_eq!(body["reason"].as_str().unwrap(), "Family vacation");

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Overlapping leave request returns 409 Conflict
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_create_leave_request_overlapping_dates() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "leave-overlap").await;
    let leave_type_id =
        common::create_test_leave_type(&pool, org_id, "vacation", "Vacation").await;
    let email = unique_email("leave-overlap-emp");
    let (_, password) = common::create_test_user(&pool, org_id, "employee", &email).await;

    let token = common::get_auth_token(addr, &email, &password).await;
    let client = common::http_client();

    // Create the first leave request
    let resp = client
        .post(format!("http://{}/api/leave", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "leave_type_id": leave_type_id,
            "start_date": date_json(2027, 8, 1),
            "end_date": date_json(2027, 8, 10),
            "hours": 80.0,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "First leave request should succeed");

    // Create a second request overlapping the first
    let resp = client
        .post(format!("http://{}/api/leave", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "leave_type_id": leave_type_id,
            "start_date": date_json(2027, 8, 5),
            "end_date": date_json(2027, 8, 15),
            "hours": 80.0,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        409,
        "Overlapping leave request should return 409 Conflict"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Supervisor approves a leave request, status changes to approved
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_review_leave_request_approve() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "leave-approve").await;
    let leave_type_id =
        common::create_test_leave_type(&pool, org_id, "vacation", "Vacation").await;

    let emp_email = unique_email("leave-approve-emp");
    let (_, emp_password) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;

    let sup_email = unique_email("leave-approve-sup");
    let (_, sup_password) =
        common::create_test_user(&pool, org_id, "supervisor", &sup_email).await;

    let client = common::http_client();

    // Employee creates a leave request
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_password).await;
    let resp = client
        .post(format!("http://{}/api/leave", addr))
        .header("Authorization", format!("Bearer {}", emp_token))
        .json(&serde_json::json!({
            "leave_type_id": leave_type_id,
            "start_date": date_json(2027, 9, 1),
            "end_date": date_json(2027, 9, 3),
            "hours": 24.0,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let leave: serde_json::Value = resp.json().await.unwrap();
    let leave_id = leave["id"].as_str().unwrap();
    assert_eq!(leave["status"].as_str().unwrap(), "pending");

    // Supervisor approves
    let sup_token = common::get_auth_token(addr, &sup_email, &sup_password).await;
    let resp = client
        .patch(format!("http://{}/api/leave/{}/review", addr, leave_id))
        .header("Authorization", format!("Bearer {}", sup_token))
        .json(&serde_json::json!({
            "status": "approved",
            "reviewer_notes": "Approved - enjoy your time off",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "Supervisor review should return 200");

    let reviewed: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(reviewed["status"].as_str().unwrap(), "approved");
    assert!(reviewed["reviewed_by"].as_str().is_some());
    assert_eq!(
        reviewed["reviewer_notes"].as_str().unwrap(),
        "Approved - enjoy your time off"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Supervisor denies a leave request, status changes to denied
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_review_leave_request_deny() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "leave-deny").await;
    let leave_type_id =
        common::create_test_leave_type(&pool, org_id, "vacation", "Vacation").await;

    let emp_email = unique_email("leave-deny-emp");
    let (_, emp_password) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;

    let sup_email = unique_email("leave-deny-sup");
    let (_, sup_password) =
        common::create_test_user(&pool, org_id, "supervisor", &sup_email).await;

    let client = common::http_client();

    // Employee creates a leave request
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_password).await;
    let resp = client
        .post(format!("http://{}/api/leave", addr))
        .header("Authorization", format!("Bearer {}", emp_token))
        .json(&serde_json::json!({
            "leave_type_id": leave_type_id,
            "start_date": date_json(2027, 10, 1),
            "end_date": date_json(2027, 10, 3),
            "hours": 24.0,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let leave: serde_json::Value = resp.json().await.unwrap();
    let leave_id = leave["id"].as_str().unwrap();

    // Supervisor denies
    let sup_token = common::get_auth_token(addr, &sup_email, &sup_password).await;
    let resp = client
        .patch(format!("http://{}/api/leave/{}/review", addr, leave_id))
        .header("Authorization", format!("Bearer {}", sup_token))
        .json(&serde_json::json!({
            "status": "denied",
            "reviewer_notes": "Insufficient staffing",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "Supervisor deny should return 200");

    let reviewed: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(reviewed["status"].as_str().unwrap(), "denied");
    assert_eq!(
        reviewed["reviewer_notes"].as_str().unwrap(),
        "Insufficient staffing"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Employee cannot review their own leave request (403 Forbidden)
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_employee_cannot_review_own_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "leave-self-review").await;
    let leave_type_id =
        common::create_test_leave_type(&pool, org_id, "vacation", "Vacation").await;

    let emp_email = unique_email("leave-self-review-emp");
    let (_, emp_password) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;

    let client = common::http_client();

    // Employee creates a leave request
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_password).await;
    let resp = client
        .post(format!("http://{}/api/leave", addr))
        .header("Authorization", format!("Bearer {}", emp_token))
        .json(&serde_json::json!({
            "leave_type_id": leave_type_id,
            "start_date": date_json(2027, 11, 1),
            "end_date": date_json(2027, 11, 2),
            "hours": 12.0,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let leave: serde_json::Value = resp.json().await.unwrap();
    let leave_id = leave["id"].as_str().unwrap();

    // Employee tries to approve their own request
    let resp = client
        .patch(format!("http://{}/api/leave/{}/review", addr, leave_id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .json(&serde_json::json!({
            "status": "approved",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        403,
        "Employee should not be able to review leave requests"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Employee cancels their own pending leave request
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_cancel_pending_leave_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "leave-cancel").await;
    let leave_type_id =
        common::create_test_leave_type(&pool, org_id, "vacation", "Vacation").await;

    let emp_email = unique_email("leave-cancel-emp");
    let (_, emp_password) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;

    let client = common::http_client();

    // Employee creates a leave request
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_password).await;
    let resp = client
        .post(format!("http://{}/api/leave", addr))
        .header("Authorization", format!("Bearer {}", emp_token))
        .json(&serde_json::json!({
            "leave_type_id": leave_type_id,
            "start_date": date_json(2027, 12, 1),
            "end_date": date_json(2027, 12, 5),
            "hours": 40.0,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let leave: serde_json::Value = resp.json().await.unwrap();
    let leave_id = leave["id"].as_str().unwrap();
    assert_eq!(leave["status"].as_str().unwrap(), "pending");

    // Employee cancels the pending request
    let resp = client
        .patch(format!("http://{}/api/leave/{}/cancel", addr, leave_id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "Cancel pending leave should return 200");

    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["ok"].as_bool().unwrap(), true);

    // Verify the leave request is now cancelled by fetching it
    let resp = client
        .get(format!("http://{}/api/leave/{}", addr, leave_id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let leave: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(leave["status"].as_str().unwrap(), "cancelled");

    common::cleanup_test_org(&pool, org_id).await;
}
