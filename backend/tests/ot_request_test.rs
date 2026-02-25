mod common;

use uuid::Uuid;

fn unique_email(prefix: &str) -> String {
    format!("{}+{}@test.local", prefix, &Uuid::new_v4().to_string()[..8])
}

/// Clean up OT request data for an org before calling cleanup_test_org.
/// The generic cleanup helper does not know about the ot_request tables yet.
async fn cleanup_ot_request_data(pool: &sqlx::PgPool, org_id: Uuid) {
    let queries = [
        "DELETE FROM ot_request_assignments WHERE ot_request_id IN (SELECT id FROM ot_requests WHERE org_id = $1)",
        "DELETE FROM ot_request_volunteers WHERE ot_request_id IN (SELECT id FROM ot_requests WHERE org_id = $1)",
        // Clear the callout_events FK that points to ot_requests (migration 0030)
        "UPDATE callout_events SET ot_request_id = NULL WHERE ot_request_id IN (SELECT id FROM ot_requests WHERE org_id = $1)",
        "DELETE FROM ot_requests WHERE org_id = $1",
    ];
    for q in queries {
        let _ = sqlx::query(q).bind(org_id).execute(pool).await;
    }
}

/// Helper: create an OT request via the API and return the parsed JSON body.
async fn create_ot_request(
    client: &reqwest::Client,
    addr: std::net::SocketAddr,
    token: &str,
    classification_id: Uuid,
    overrides: Option<serde_json::Value>,
) -> serde_json::Value {
    let mut body = serde_json::json!({
        "date": "2026-06-15",
        "start_time": "06:00:00",
        "end_time": "08:00:00",
        "classification_id": classification_id.to_string(),
    });
    if let Some(extra) = overrides {
        if let (Some(base), Some(extra)) = (body.as_object_mut(), extra.as_object()) {
            for (k, v) in extra {
                base.insert(k.clone(), v.clone());
            }
        }
    }

    let resp = client
        .post(format!("http://{}/api/ot-requests", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&body)
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "create OT request should succeed");
    resp.json().await.unwrap()
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD Basics
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn admin_can_create_ot_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-create").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-admin");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let body = create_ot_request(
        &client,
        addr,
        &token,
        class_id,
        Some(serde_json::json!({
            "location": "Communications Room",
            "notes": "Need extra staffing",
            "is_fixed_coverage": false,
        })),
    )
    .await;

    assert_eq!(body["status"], "open");
    assert_eq!(body["classification_id"], class_id.to_string());
    assert_eq!(body["location"], "Communications Room");
    assert_eq!(body["notes"], "Need extra staffing");
    assert_eq!(body["is_fixed_coverage"], false);
    assert_eq!(body["hours"], 2.0);
    assert_eq!(body["volunteer_count"], 0);
    assert_eq!(body["assignment_count"], 0);
    assert_eq!(body["user_volunteered"], false);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn supervisor_can_create_ot_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-sup-create").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-sup");
    let (_uid, password) = common::create_test_user(&pool, org_id, "supervisor", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let body = create_ot_request(&client, addr, &token, class_id, None).await;
    assert_eq!(body["status"], "open");

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn get_ot_request_detail() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-detail").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-det");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let detail: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(detail["id"], id);
    assert_eq!(detail["status"], "open");
    // Detail should have empty volunteers and assignments arrays
    assert!(detail["volunteers"].as_array().unwrap().is_empty());
    assert!(detail["assignments"].as_array().unwrap().is_empty());

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn list_ot_requests() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-list").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-list");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    // Create two requests on different dates
    create_ot_request(
        &client,
        addr,
        &token,
        class_id,
        Some(serde_json::json!({
            "date": "2026-06-15",
        })),
    )
    .await;
    create_ot_request(
        &client,
        addr,
        &token,
        class_id,
        Some(serde_json::json!({
            "date": "2026-06-16",
        })),
    )
    .await;

    let resp = client
        .get(format!("http://{}/api/ot-requests", addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let items: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(items.len(), 2);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn update_ot_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-update").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-upd");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    let resp = client
        .patch(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "location": "Updated Location",
            "notes": "Updated notes",
            "is_fixed_coverage": true,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["location"], "Updated Location");
    assert_eq!(body["notes"], "Updated notes");
    assert_eq!(body["is_fixed_coverage"], true);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn cancel_ot_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-cancel").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-can");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    let resp = client
        .patch(format!("http://{}/api/ot-requests/{}/cancel", addr, id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    // Verify status is cancelled in detail
    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    let detail: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(detail["status"], "cancelled");
    assert!(
        detail["cancelled_at"].is_string(),
        "cancelled_at should be set"
    );
    assert!(
        !detail["cancelled_by"].is_null(),
        "cancelled_by should be set"
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn cancel_already_cancelled_returns_not_found() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-double-cancel").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-dc");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Cancel once
    client
        .patch(format!("http://{}/api/ot-requests/{}/cancel", addr, id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    // Cancel again should fail
    let resp = client
        .patch(format!("http://{}/api/ot-requests/{}/cancel", addr, id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 404);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn cannot_update_cancelled_ot_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-upd-cancel").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-uc");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Cancel first
    client
        .patch(format!("http://{}/api/ot-requests/{}/cancel", addr, id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    // Try to update
    let resp = client
        .patch(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "notes": "Should fail" }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        409,
        "Updating cancelled request should return 409"
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Authorization
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn employee_cannot_create_ot_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-emp-deny").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-emp");
    let (_uid, password) = common::create_test_user(&pool, org_id, "employee", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/ot-requests", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "date": "2026-06-15",
            "start_time": "06:00:00",
            "end_time": "08:00:00",
            "classification_id": class_id.to_string(),
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 403);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn employee_cannot_cancel_ot_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-emp-cancel").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-ec-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-ec-emp");
    let (_emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    let resp = client
        .patch(format!("http://{}/api/ot-requests/{}/cancel", addr, id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 403);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn employee_cannot_assign_ot_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-emp-assign").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-ea-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-ea-emp");
    let (emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .json(&serde_json::json!({ "user_id": emp_id.to_string() }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 403);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Org Isolation
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn org_isolation_cannot_see_other_org_ot_requests() {
    let (addr, pool) = common::setup_test_app().await;
    let org_a = common::create_test_org(&pool, "otr-iso-a").await;
    let org_b = common::create_test_org(&pool, "otr-iso-b").await;
    let class_a = common::create_test_classification(&pool, org_a).await;

    let email_a = unique_email("otr-isoa");
    let (_uid_a, pass_a) = common::create_test_user(&pool, org_a, "admin", &email_a).await;
    let token_a = common::get_auth_token(addr, &email_a, &pass_a).await;

    let email_b = unique_email("otr-isob");
    let (_uid_b, pass_b) = common::create_test_user(&pool, org_b, "admin", &email_b).await;
    let token_b = common::get_auth_token(addr, &email_b, &pass_b).await;

    let client = common::http_client();

    // Org A creates an OT request
    let created = create_ot_request(&client, addr, &token_a, class_a, None).await;
    let id = created["id"].as_str().unwrap();

    // Org B should not see it in list
    let resp = client
        .get(format!("http://{}/api/ot-requests", addr))
        .header("Authorization", format!("Bearer {}", token_b))
        .send()
        .await
        .unwrap();
    let items: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert!(items.is_empty(), "Org B should not see Org A's OT requests");

    // Org B should not get it by ID
    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", token_b))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        404,
        "Org B should get 404 for Org A's OT request"
    );

    // Org B should not be able to cancel it
    let resp = client
        .patch(format!("http://{}/api/ot-requests/{}/cancel", addr, id))
        .header("Authorization", format!("Bearer {}", token_b))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        404,
        "Org B should get 404 cancelling Org A's OT request"
    );

    // Org B should not be able to update it
    let resp = client
        .patch(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", token_b))
        .json(&serde_json::json!({ "notes": "Hacked" }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        404,
        "Org B should get 404 updating Org A's OT request"
    );

    cleanup_ot_request_data(&pool, org_a).await;
    cleanup_ot_request_data(&pool, org_b).await;
    common::cleanup_test_org(&pool, org_a).await;
    common::cleanup_test_org(&pool, org_b).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Volunteer Flow
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn employee_can_volunteer_for_ot_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-vol").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-v-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-v-emp");
    let (_emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Employee volunteers
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/volunteer", addr, id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Verify volunteer appears in detail
    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    let detail: serde_json::Value = resp.json().await.unwrap();
    let volunteers = detail["volunteers"].as_array().unwrap();
    assert_eq!(volunteers.len(), 1);
    assert!(volunteers[0]["withdrawn_at"].is_null());

    // Verify volunteer_count and user_volunteered in list (as employee)
    let resp = client
        .get(format!("http://{}/api/ot-requests", addr))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    let items: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(items[0]["volunteer_count"], 1);
    assert_eq!(items[0]["user_volunteered"], true);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn cannot_volunteer_twice() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-vol-dup").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-vd-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-vd-emp");
    let (_emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // First volunteer
    client
        .post(format!("http://{}/api/ot-requests/{}/volunteer", addr, id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();

    // Second volunteer should conflict
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/volunteer", addr, id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 409, "Duplicate volunteer should return 409");

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn cannot_volunteer_for_cancelled_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-vol-cancel").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-vc-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-vc-emp");
    let (_emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Cancel it
    client
        .patch(format!("http://{}/api/ot-requests/{}/cancel", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();

    // Employee tries to volunteer
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/volunteer", addr, id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        409,
        "Volunteering for cancelled request should return 409"
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Withdrawal
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn employee_can_withdraw_volunteer() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-withdraw").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-w-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-w-emp");
    let (_emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Volunteer
    client
        .post(format!("http://{}/api/ot-requests/{}/volunteer", addr, id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();

    // Withdraw
    let resp = client
        .patch(format!(
            "http://{}/api/ot-requests/{}/volunteer/withdraw",
            addr, id
        ))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Detail should show volunteer with withdrawn_at set
    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    let detail: serde_json::Value = resp.json().await.unwrap();
    let volunteers = detail["volunteers"].as_array().unwrap();
    assert_eq!(volunteers.len(), 1);
    assert!(
        volunteers[0]["withdrawn_at"].is_string(),
        "withdrawn_at should be set after withdrawal"
    );

    // List should show volunteer_count=0 (withdrawn doesn't count)
    let resp = client
        .get(format!("http://{}/api/ot-requests", addr))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    let items: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(items[0]["volunteer_count"], 0);
    assert_eq!(items[0]["user_volunteered"], false);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn withdraw_without_volunteering_returns_not_found() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-withdraw-nv").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-wnv-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-wnv-emp");
    let (_emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Try to withdraw without having volunteered
    let resp = client
        .patch(format!(
            "http://{}/api/ot-requests/{}/volunteer/withdraw",
            addr, id
        ))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 404);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn re_volunteer_after_withdrawal() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-revol").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-rv-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-rv-emp");
    let (_emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Volunteer
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/volunteer", addr, id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Withdraw
    let resp = client
        .patch(format!(
            "http://{}/api/ot-requests/{}/volunteer/withdraw",
            addr, id
        ))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Re-volunteer should succeed (reactivates the withdrawn entry)
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/volunteer", addr, id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Verify active volunteer again
    let resp = client
        .get(format!("http://{}/api/ot-requests", addr))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    let items: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(items[0]["volunteer_count"], 1);
    assert_eq!(items[0]["user_volunteered"], true);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Assignment
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn assign_user_to_ot_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-assign").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-a-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-a-emp");
    let (emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let _emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Assign employee
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({
            "user_id": emp_id.to_string(),
            "ot_type": "voluntary",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let assignment: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(assignment["user_id"], emp_id.to_string());
    assert_eq!(assignment["ot_type"], "voluntary");

    // Verify detail shows assignment and status change
    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    let detail: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(detail["assignments"].as_array().unwrap().len(), 1);
    // Non-fixed coverage goes to partially_filled
    assert_eq!(detail["status"], "partially_filled");

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn assign_increments_ot_hours() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-ot-hrs").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-oh-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-oh-emp");
    let (emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let _emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    // Create request: 06:00 to 08:00 = 2 hours, date 2026-06-15 (fiscal year 2026)
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Assign employee
    client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({ "user_id": emp_id.to_string() }))
        .send()
        .await
        .unwrap();

    // Check ot_hours table directly (use non-macro query to avoid sqlx cache issue)
    let hours: f64 = sqlx::query_scalar(
        "SELECT CAST(hours_worked AS FLOAT8) FROM ot_hours WHERE user_id = $1 AND fiscal_year = 2026",
    )
    .bind(emp_id)
    .fetch_one(&pool)
    .await
    .expect("ot_hours row should exist");
    assert!(
        (hours - 2.0).abs() < 0.01,
        "OT hours should be 2.0, got {}",
        hours
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn cancel_assignment_reverts_ot_hours() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-revert-hrs").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-rh-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-rh-emp");
    let (emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let _emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Assign employee (adds 2 hours)
    client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({ "user_id": emp_id.to_string() }))
        .send()
        .await
        .unwrap();

    // Cancel assignment (should revert 2 hours)
    let resp = client
        .delete(format!(
            "http://{}/api/ot-requests/{}/assign/{}",
            addr, id, emp_id
        ))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // OT hours should be 0
    let hours: f64 = sqlx::query_scalar(
        "SELECT CAST(hours_worked AS FLOAT8) FROM ot_hours WHERE user_id = $1 AND fiscal_year = 2026",
    )
    .bind(emp_id)
    .fetch_one(&pool)
    .await
    .expect("ot_hours row should still exist");
    assert!(
        (hours).abs() < 0.01,
        "OT hours should be 0 after cancel, got {}",
        hours
    );

    // OT request status should revert to open (no active assignments)
    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    let detail: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(
        detail["status"], "open",
        "Status should revert to open after all assignments cancelled"
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn cannot_assign_same_user_twice() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-dup-assign").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-da-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-da-emp");
    let (emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let _emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // First assignment
    client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({ "user_id": emp_id.to_string() }))
        .send()
        .await
        .unwrap();

    // Second assignment for same user should conflict
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({ "user_id": emp_id.to_string() }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 409, "Duplicate assignment should return 409");

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn cannot_assign_to_cancelled_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-assign-cancel").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-ac-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-ac-emp");
    let (emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let _emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Cancel the request
    client
        .patch(format!("http://{}/api/ot-requests/{}/cancel", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();

    // Try to assign
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({ "user_id": emp_id.to_string() }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        409,
        "Assigning to cancelled request should return 409"
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Status Transitions
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn fixed_coverage_fills_after_one_assignment() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-fixed").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-fx-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-fx-emp");
    let (emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let _emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(
        &client,
        addr,
        &admin_token,
        class_id,
        Some(serde_json::json!({
            "is_fixed_coverage": true,
        })),
    )
    .await;
    let id = created["id"].as_str().unwrap();
    assert_eq!(created["is_fixed_coverage"], true);
    assert_eq!(created["status"], "open");

    // Assign one employee — fixed coverage should fill immediately
    client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({ "user_id": emp_id.to_string() }))
        .send()
        .await
        .unwrap();

    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    let detail: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(
        detail["status"], "filled",
        "Fixed coverage should be filled after 1 assignment"
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn cannot_assign_to_filled_request() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-filled-deny").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-fd-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp1_email = unique_email("otr-fd-e1");
    let (emp1_id, emp1_pass) =
        common::create_test_user(&pool, org_id, "employee", &emp1_email).await;
    let _emp1_token = common::get_auth_token(addr, &emp1_email, &emp1_pass).await;

    let emp2_email = unique_email("otr-fd-e2");
    let (emp2_id, emp2_pass) =
        common::create_test_user(&pool, org_id, "employee", &emp2_email).await;
    let _emp2_token = common::get_auth_token(addr, &emp2_email, &emp2_pass).await;

    let client = common::http_client();
    // Create fixed coverage (fills after 1 assignment)
    let created = create_ot_request(
        &client,
        addr,
        &admin_token,
        class_id,
        Some(serde_json::json!({
            "is_fixed_coverage": true,
        })),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    // Assign first employee => fills
    client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({ "user_id": emp1_id.to_string() }))
        .send()
        .await
        .unwrap();

    // Try to assign second employee => should fail
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({ "user_id": emp2_id.to_string() }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        409,
        "Assigning to filled request should return 409"
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn non_fixed_coverage_partially_fills() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-partial").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-pf-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp1_email = unique_email("otr-pf-e1");
    let (emp1_id, emp1_pass) =
        common::create_test_user(&pool, org_id, "employee", &emp1_email).await;
    let _emp1_token = common::get_auth_token(addr, &emp1_email, &emp1_pass).await;

    let emp2_email = unique_email("otr-pf-e2");
    let (emp2_id, emp2_pass) =
        common::create_test_user(&pool, org_id, "employee", &emp2_email).await;
    let _emp2_token = common::get_auth_token(addr, &emp2_email, &emp2_pass).await;

    let client = common::http_client();
    // Non-fixed coverage (default is_fixed_coverage=false)
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    // Assign first employee => partially_filled
    client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({ "user_id": emp1_id.to_string() }))
        .send()
        .await
        .unwrap();

    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    let detail: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(detail["status"], "partially_filled");

    // Assign second employee => still partially_filled (non-fixed needs manual fill)
    client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({ "user_id": emp2_id.to_string() }))
        .send()
        .await
        .unwrap();

    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    let detail: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(detail["status"], "partially_filled");
    assert_eq!(detail["assignments"].as_array().unwrap().len(), 2);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn create_rejects_same_start_end_time() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-same-time").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-st");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/ot-requests", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "date": "2026-06-15",
            "start_time": "08:00:00",
            "end_time": "08:00:00",
            "classification_id": class_id.to_string(),
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        400,
        "Same start and end time should be rejected"
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn create_rejects_invalid_classification() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-bad-class").await;
    let email = unique_email("otr-bc");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/ot-requests", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "date": "2026-06-15",
            "start_time": "06:00:00",
            "end_time": "08:00:00",
            "classification_id": Uuid::new_v4().to_string(),
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        404,
        "Non-existent classification should return 404"
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn create_computes_hours_for_midnight_crossing() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-midnight").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-mid");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    // 22:00 to 02:00 crosses midnight = 4 hours
    let body = create_ot_request(
        &client,
        addr,
        &token,
        class_id,
        Some(serde_json::json!({
            "start_time": "22:00:00",
            "end_time": "02:00:00",
        })),
    )
    .await;

    assert!(
        (body["hours"].as_f64().unwrap() - 4.0).abs() < 0.01,
        "Midnight crossing should compute 4 hours, got {}",
        body["hours"]
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn update_rejects_invalid_status() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-bad-status").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-bs");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    let resp = client
        .patch(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "status": "bogus_status" }))
        .send()
        .await
        .unwrap();
    assert!(
        resp.status() == 400 || resp.status() == 422,
        "Invalid status value should be rejected (got {})",
        resp.status()
    );

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn assign_rejects_invalid_ot_type() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-bad-ot-type").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-bot-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-bot-emp");
    let (emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let _emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();
    let created = create_ot_request(&client, addr, &admin_token, class_id, None).await;
    let id = created["id"].as_str().unwrap();

    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({
            "user_id": emp_id.to_string(),
            "ot_type": "invalid_type",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 400, "Invalid ot_type should be rejected");

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Filtering
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn filter_by_status() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-filter-status").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-fs");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    // Create two open requests
    create_ot_request(
        &client,
        addr,
        &token,
        class_id,
        Some(serde_json::json!({
            "date": "2026-06-15",
        })),
    )
    .await;
    let second = create_ot_request(
        &client,
        addr,
        &token,
        class_id,
        Some(serde_json::json!({
            "date": "2026-06-16",
        })),
    )
    .await;
    let second_id = second["id"].as_str().unwrap();

    // Cancel the second one
    client
        .patch(format!(
            "http://{}/api/ot-requests/{}/cancel",
            addr, second_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    // Filter by open
    let resp = client
        .get(format!("http://{}/api/ot-requests?status=open", addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    let items: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(items.len(), 1, "Should only see 1 open request");
    assert_eq!(items[0]["status"], "open");

    // Filter by cancelled
    let resp = client
        .get(format!("http://{}/api/ot-requests?status=cancelled", addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    let items: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(items.len(), 1, "Should only see 1 cancelled request");
    assert_eq!(items[0]["status"], "cancelled");

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn filter_by_date_range() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-filter-date").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("otr-fd");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    create_ot_request(
        &client,
        addr,
        &token,
        class_id,
        Some(serde_json::json!({
            "date": "2026-06-10",
        })),
    )
    .await;
    create_ot_request(
        &client,
        addr,
        &token,
        class_id,
        Some(serde_json::json!({
            "date": "2026-06-20",
        })),
    )
    .await;
    create_ot_request(
        &client,
        addr,
        &token,
        class_id,
        Some(serde_json::json!({
            "date": "2026-06-30",
        })),
    )
    .await;

    // Filter: only June 15-25
    let resp = client
        .get(format!(
            "http://{}/api/ot-requests?date_from=2026-06-15&date_to=2026-06-25",
            addr
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    let items: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(items.len(), 1, "Only one request falls in June 15-25");
    assert_eq!(items[0]["date"], "2026-06-20");

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn filter_by_classification() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-filter-class").await;
    let class_a = common::create_test_classification(&pool, org_id).await;

    // Create a second classification
    let class_b = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO classifications (id, org_id, name, abbreviation) VALUES ($1, $2, 'Call Taker', 'CT')",
    )
    .bind(class_b)
    .bind(org_id)
    .execute(&pool)
    .await
    .unwrap();

    let email = unique_email("otr-fc");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    create_ot_request(&client, addr, &token, class_a, None).await;
    create_ot_request(&client, addr, &token, class_b, None).await;

    // Filter by class_a
    let resp = client
        .get(format!(
            "http://{}/api/ot-requests?classification_id={}",
            addr, class_a
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    let items: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["classification_id"], class_a.to_string());

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn filter_volunteered_by_me() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-filter-vol").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-fv-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-fv-emp");
    let (_emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();

    // Create two requests
    let req1 = create_ot_request(
        &client,
        addr,
        &admin_token,
        class_id,
        Some(serde_json::json!({
            "date": "2026-06-15",
        })),
    )
    .await;
    let req1_id = req1["id"].as_str().unwrap();
    create_ot_request(
        &client,
        addr,
        &admin_token,
        class_id,
        Some(serde_json::json!({
            "date": "2026-06-16",
        })),
    )
    .await;

    // Employee volunteers for only the first
    client
        .post(format!(
            "http://{}/api/ot-requests/{}/volunteer",
            addr, req1_id
        ))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();

    // Filter volunteered_by_me
    let resp = client
        .get(format!(
            "http://{}/api/ot-requests?volunteered_by_me=true",
            addr
        ))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    let items: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(
        items.len(),
        1,
        "Should only see 1 request the employee volunteered for"
    );
    assert_eq!(items[0]["id"], req1_id);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Full Volunteer → Assign Flow
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn full_volunteer_and_assign_flow() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-full-flow").await;
    let class_id = common::create_test_classification(&pool, org_id).await;

    let admin_email = unique_email("otr-ff-adm");
    let (_admin_id, admin_pass) =
        common::create_test_user(&pool, org_id, "admin", &admin_email).await;
    let admin_token = common::get_auth_token(addr, &admin_email, &admin_pass).await;

    let emp_email = unique_email("otr-ff-emp");
    let (emp_id, emp_pass) = common::create_test_user(&pool, org_id, "employee", &emp_email).await;
    let emp_token = common::get_auth_token(addr, &emp_email, &emp_pass).await;

    let client = common::http_client();

    // 1. Admin creates fixed coverage OT request
    let created = create_ot_request(
        &client,
        addr,
        &admin_token,
        class_id,
        Some(serde_json::json!({
            "is_fixed_coverage": true,
            "location": "Com Room",
            "notes": "Need coverage for sick call",
        })),
    )
    .await;
    let id = created["id"].as_str().unwrap();
    assert_eq!(created["status"], "open");

    // 2. Employee volunteers
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/volunteer", addr, id))
        .header("Authorization", format!("Bearer {}", emp_token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // 3. Admin sees volunteer in detail
    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    let detail: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(detail["volunteers"].as_array().unwrap().len(), 1);

    // 4. Admin assigns the employee
    let resp = client
        .post(format!("http://{}/api/ot-requests/{}/assign", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&serde_json::json!({
            "user_id": emp_id.to_string(),
            "ot_type": "voluntary",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // 5. Request should now be filled (fixed coverage)
    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, id))
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .unwrap();
    let detail: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(detail["status"], "filled");
    assert_eq!(detail["assignments"].as_array().unwrap().len(), 1);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Get non-existent request
// ═══════════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn get_nonexistent_ot_request_returns_404() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "otr-404").await;
    let email = unique_email("otr-404");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let fake_id = Uuid::new_v4();
    let resp = client
        .get(format!("http://{}/api/ot-requests/{}", addr, fake_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 404);

    cleanup_ot_request_data(&pool, org_id).await;
    common::cleanup_test_org(&pool, org_id).await;
}
