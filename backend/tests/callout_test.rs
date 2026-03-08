mod common;

use uuid::Uuid;

/// Helper to generate a unique email for each test run.
fn unique_email(prefix: &str) -> String {
    format!("{}+{}@test.local", prefix, &Uuid::new_v4().to_string()[..8])
}

// ---------------------------------------------------------------------------
// Test: Create a callout event via the API
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_create_callout_event() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "callout-create").await;
    let classification_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("callout-create-admin");
    let (_, password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "admin",
        &email,
    )
    .await;
    let shift_template_id = common::create_test_shift_template(&pool, org_id).await;
    let future_date = time::Date::from_calendar_date(2027, time::Month::June, 15).unwrap();
    let scheduled_shift_id =
        common::create_test_scheduled_shift(&pool, org_id, shift_template_id, future_date).await;

    let token = common::get_auth_token(addr, &email, &password).await;
    let client = common::http_client();

    let resp = client
        .post(format!("http://{}/api/callout/events", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "scheduled_shift_id": scheduled_shift_id,
            "classification_id": classification_id,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200, "Create callout event should return 200");

    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["status"].as_str().unwrap(), "open");
    assert_eq!(
        body["classification_id"].as_str().unwrap(),
        classification_id.to_string()
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Advance callout step ordering is enforced
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_advance_step_ordering() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "callout-step").await;
    let classification_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("callout-step-admin");
    let (admin_id, password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "admin",
        &email,
    )
    .await;
    let shift_template_id = common::create_test_shift_template(&pool, org_id).await;
    let future_date = time::Date::from_calendar_date(2027, time::Month::June, 15).unwrap();
    let scheduled_shift_id =
        common::create_test_scheduled_shift(&pool, org_id, shift_template_id, future_date).await;
    let event_id =
        common::create_test_callout_event(&pool, scheduled_shift_id, admin_id, classification_id)
            .await;

    let token = common::get_auth_token(addr, &email, &password).await;
    let client = common::http_client();
    let url = format!("http://{}/api/callout/events/{}/step", addr, event_id);

    // DB defaults current_step to 'volunteers', so the next valid step is 'low_ot_hours'.
    // Step 1: low_ot_hours (correct next step after default 'volunteers')
    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "step": "low_ot_hours" }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "Advancing to 'low_ot_hours' should succeed"
    );

    // Step 2: inverse_seniority (correct next step)
    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "step": "inverse_seniority" }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "Advancing to 'inverse_seniority' should succeed"
    );

    // Step 3: going back to 'low_ot_hours' is allowed (supervisors can revisit steps)
    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "step": "low_ot_hours" }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "Going back to 'low_ot_hours' should succeed"
    );

    // Step 4: skipping to 'mandatory' is allowed (any step is valid)
    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "step": "mandatory" }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "Skipping to 'mandatory' should succeed"
    );

    // Step 5: moving to the same step should fail
    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "step": "mandatory" }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        400,
        "Moving to the same step should return 400"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Record attempt with no_answer does NOT stamp OT queue
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_record_attempt_no_answer_no_queue_stamp() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "callout-attempt").await;
    let classification_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("callout-attempt-admin");
    let (admin_id, admin_password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "admin",
        &admin_email,
    )
    .await;

    let emp_email = unique_email("callout-attempt-emp");
    let (emp_id, _) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "employee",
        &emp_email,
    )
    .await;

    let shift_template_id = common::create_test_shift_template(&pool, org_id).await;
    let future_date = time::Date::from_calendar_date(2027, time::Month::June, 15).unwrap();
    let scheduled_shift_id =
        common::create_test_scheduled_shift(&pool, org_id, shift_template_id, future_date).await;
    let event_id =
        common::create_test_callout_event(&pool, scheduled_shift_id, admin_id, classification_id)
            .await;

    let token = common::get_auth_token(addr, &admin_email, &admin_password).await;
    let client = common::http_client();
    let url = format!("http://{}/api/callout/events/{}/attempt", addr, event_id);

    // Record no_answer -- should NOT stamp the OT queue
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "user_id": emp_id,
            "response": "no_answer",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "no_answer attempt should return 200");

    // Verify no OT queue position was created
    let queue_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ot_queue_positions WHERE user_id = $1 AND org_id = $2",
    )
    .bind(emp_id)
    .bind(org_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        queue_count, 0,
        "no_answer should NOT stamp OT queue position"
    );

    // Now record declined -- SHOULD stamp the OT queue
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "user_id": emp_id,
            "response": "declined",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "declined attempt should return 200");

    // Verify OT queue position was created
    let queue_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ot_queue_positions WHERE user_id = $1 AND org_id = $2",
    )
    .bind(emp_id)
    .bind(org_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(queue_count, 1, "declined should stamp OT queue position");

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Create bump request - cannot bump yourself
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_create_bump_request_self_bump_rejected() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "callout-bump-self").await;
    let classification_id = common::create_test_classification(&pool, org_id).await;

    let emp_email = unique_email("callout-bump-self-emp");
    let (emp_id, emp_password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "employee",
        &emp_email,
    )
    .await;

    // Need an admin to create the event
    let admin_email = unique_email("callout-bump-self-admin");
    let (admin_id, _) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "admin",
        &admin_email,
    )
    .await;

    let shift_template_id = common::create_test_shift_template(&pool, org_id).await;
    let future_date = time::Date::from_calendar_date(2027, time::Month::June, 15).unwrap();
    let scheduled_shift_id =
        common::create_test_scheduled_shift(&pool, org_id, shift_template_id, future_date).await;
    let event_id =
        common::create_test_callout_event(&pool, scheduled_shift_id, admin_id, classification_id)
            .await;

    // Mark event as filled and create an OT assignment for the employee
    sqlx::query("UPDATE callout_events SET status = 'filled' WHERE id = $1")
        .bind(event_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO assignments (id, scheduled_shift_id, user_id, is_overtime, created_by, ot_type) \
         VALUES ($1, $2, $3, true, $4, 'voluntary')",
    )
    .bind(Uuid::new_v4())
    .bind(scheduled_shift_id)
    .bind(emp_id)
    .bind(admin_id)
    .execute(&pool)
    .await
    .unwrap();

    let emp_token = common::get_auth_token(addr, &emp_email, &emp_password).await;
    let client = common::http_client();

    // Try to bump yourself -> should get 400
    let resp = client
        .post(format!(
            "http://{}/api/callout/events/{}/bump",
            addr, event_id
        ))
        .header("Authorization", format!("Bearer {}", emp_token))
        .json(&serde_json::json!({
            "displaced_user_id": emp_id,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 400, "Self-bump should return 400");

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Review bump request - approve flow
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_review_bump_request_approve() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "callout-bump-approve").await;
    let classification_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("callout-bump-approve-admin");
    let (admin_id, admin_password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "admin",
        &admin_email,
    )
    .await;

    // Displaced user (higher OT hours)
    let displaced_email = unique_email("callout-bump-displaced");
    let (displaced_id, _) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "employee",
        &displaced_email,
    )
    .await;

    // Requesting user (lower OT hours)
    let requester_email = unique_email("callout-bump-requester");
    let (requester_id, requester_password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "employee",
        &requester_email,
    )
    .await;

    let shift_template_id = common::create_test_shift_template(&pool, org_id).await;
    let future_date = time::Date::from_calendar_date(2027, time::Month::June, 15).unwrap();
    let scheduled_shift_id =
        common::create_test_scheduled_shift(&pool, org_id, shift_template_id, future_date).await;
    let event_id =
        common::create_test_callout_event(&pool, scheduled_shift_id, admin_id, classification_id)
            .await;

    // Mark event filled, create assignment for displaced user
    sqlx::query("UPDATE callout_events SET status = 'filled' WHERE id = $1")
        .bind(event_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO assignments (id, scheduled_shift_id, user_id, is_overtime, created_by, ot_type) \
         VALUES ($1, $2, $3, true, $4, 'voluntary')",
    )
    .bind(Uuid::new_v4())
    .bind(scheduled_shift_id)
    .bind(displaced_id)
    .bind(admin_id)
    .execute(&pool)
    .await
    .unwrap();

    // Give displaced user higher OT hours so requester outranks them
    let fiscal_year = 2027i32;
    sqlx::query(
        "INSERT INTO ot_hours (id, user_id, fiscal_year, classification_id, hours_worked, hours_declined) \
         VALUES ($1, $2, $3, $4, 100.0, 0.0)",
    )
    .bind(Uuid::new_v4())
    .bind(displaced_id)
    .bind(fiscal_year)
    .bind(classification_id)
    .execute(&pool)
    .await
    .unwrap();

    // Requester has 0 OT hours (no row needed - defaults to 0)

    // Create bump request as requester
    let requester_token = common::get_auth_token(addr, &requester_email, &requester_password).await;
    let client = common::http_client();

    let resp = client
        .post(format!(
            "http://{}/api/callout/events/{}/bump",
            addr, event_id
        ))
        .header("Authorization", format!("Bearer {}", requester_token))
        .json(&serde_json::json!({
            "displaced_user_id": displaced_id,
            "reason": "I have lower OT hours",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "Create bump request should return 200");

    let bump: serde_json::Value = resp.json().await.unwrap();
    let bump_id = bump["id"].as_str().unwrap();
    assert_eq!(bump["status"].as_str().unwrap(), "pending");

    // Admin approves the bump request
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_password).await;

    let resp = client
        .patch(format!(
            "http://{}/api/callout/bump-requests/{}/review",
            addr, bump_id
        ))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({
            "approved": true,
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "Approve bump request should return 200");

    let reviewed: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(reviewed["status"].as_str().unwrap(), "approved");
    assert!(reviewed["reviewed_by"].as_str().is_some());

    // Verify displaced user's assignment is now cancelled
    let cancelled: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM assignments WHERE scheduled_shift_id = $1 AND user_id = $2 AND cancelled_at IS NOT NULL)",
    )
    .bind(scheduled_shift_id)
    .bind(displaced_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(cancelled, "Displaced user's assignment should be cancelled");

    // Verify requester has a new active assignment
    let requester_assigned: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM assignments WHERE scheduled_shift_id = $1 AND user_id = $2 AND cancelled_at IS NULL AND is_overtime = true)",
    )
    .bind(scheduled_shift_id)
    .bind(requester_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(
        requester_assigned,
        "Requester should have an active OT assignment"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Cancel OT assignment - voluntary within 24h blocked for employee
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_cancel_ot_assignment_voluntary_24h_block() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "callout-cancel-ot").await;
    let classification_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("callout-cancel-admin");
    let (admin_id, admin_password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "admin",
        &admin_email,
    )
    .await;

    let emp_email = unique_email("callout-cancel-emp");
    let (emp_id, emp_password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "employee",
        &emp_email,
    )
    .await;

    let shift_template_id = common::create_test_shift_template(&pool, org_id).await;

    // Use today's date so the shift start (07:00 UTC today) is guaranteed within 24h
    let today = time::OffsetDateTime::now_utc().date();
    let scheduled_shift_id =
        common::create_test_scheduled_shift(&pool, org_id, shift_template_id, today).await;

    let event_id =
        common::create_test_callout_event(&pool, scheduled_shift_id, admin_id, classification_id)
            .await;

    // Mark event filled
    sqlx::query("UPDATE callout_events SET status = 'filled' WHERE id = $1")
        .bind(event_id)
        .execute(&pool)
        .await
        .unwrap();

    // Create OT assignment for employee
    sqlx::query(
        "INSERT INTO assignments (id, scheduled_shift_id, user_id, is_overtime, created_by, ot_type) \
         VALUES ($1, $2, $3, true, $4, 'voluntary')",
    )
    .bind(Uuid::new_v4())
    .bind(scheduled_shift_id)
    .bind(emp_id)
    .bind(admin_id)
    .execute(&pool)
    .await
    .unwrap();

    // Insert callout_attempt so cancel_ot_assignment can find the assignment via the join
    sqlx::query(
        "INSERT INTO callout_attempts (id, event_id, user_id, list_position, contacted_at, response, ot_hours_at_contact) \
         VALUES ($1, $2, $3, 1, NOW(), 'accepted', 0.0)",
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(emp_id)
    .execute(&pool)
    .await
    .unwrap();

    let client = common::http_client();

    // Employee tries to cancel within 24h -> should get 409
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_password).await;
    let resp = client
        .post(format!(
            "http://{}/api/callout/events/{}/cancel-ot",
            addr, event_id
        ))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        409,
        "Employee should not be able to cancel voluntary OT within 24h"
    );

    // Admin/supervisor can always cancel
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_password).await;
    let resp = client
        .post(format!(
            "http://{}/api/callout/events/{}/cancel-ot",
            addr, event_id
        ))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "Admin should be able to cancel OT regardless of 24h window"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ---------------------------------------------------------------------------
// Test: Callout list ordering returns entries
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_callout_list_ordering() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "callout-list").await;
    let classification_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("callout-list-admin");
    let (admin_id, admin_password) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "admin",
        &admin_email,
    )
    .await;

    // Create two employees in the same classification
    let emp1_email = unique_email("callout-list-emp1");
    let (_, _) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "employee",
        &emp1_email,
    )
    .await;

    let emp2_email = unique_email("callout-list-emp2");
    let (_, _) = common::create_test_user_with_classification(
        &pool,
        org_id,
        classification_id,
        "employee",
        &emp2_email,
    )
    .await;

    let shift_template_id = common::create_test_shift_template(&pool, org_id).await;
    let future_date = time::Date::from_calendar_date(2027, time::Month::June, 15).unwrap();
    let scheduled_shift_id =
        common::create_test_scheduled_shift(&pool, org_id, shift_template_id, future_date).await;
    let event_id =
        common::create_test_callout_event(&pool, scheduled_shift_id, admin_id, classification_id)
            .await;

    let token = common::get_auth_token(addr, &admin_email, &admin_password).await;
    let client = common::http_client();

    let resp = client
        .get(format!(
            "http://{}/api/callout/events/{}/queue",
            addr, event_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "Callout list should return 200");

    let entries: Vec<serde_json::Value> = resp.json().await.unwrap();
    // Should have at least 3 users (admin + 2 employees, all with classification)
    assert!(
        entries.len() >= 3,
        "Callout list should include at least 3 users (admin + 2 employees)"
    );

    // All entries should have position, user_id, is_available, phone
    for entry in &entries {
        assert!(entry["position"].is_number());
        assert!(entry["user_id"].is_string());
        assert!(entry["is_available"].is_boolean());
        assert!(entry.get("phone").is_some(), "Entry should have a phone field (can be null)");
    }

    // Positions should be sequential starting from 1
    for (i, entry) in entries.iter().enumerate() {
        assert_eq!(
            entry["position"].as_i64().unwrap(),
            (i + 1) as i64,
            "Position should be sequential"
        );
    }

    common::cleanup_test_org(&pool, org_id).await;
}
