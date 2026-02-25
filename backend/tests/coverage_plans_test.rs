mod common;

use uuid::Uuid;

fn unique_email(prefix: &str) -> String {
    format!("{}+{}@test.local", prefix, &Uuid::new_v4().to_string()[..8])
}

// ── Plan CRUD ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn admin_can_create_coverage_plan() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-create").await;
    let email = unique_email("cp-admin");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "name": "Weekday Plan",
            "description": "Standard weekday coverage",
            "is_default": true,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200, "Admin should create a plan");
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["name"], "Weekday Plan");
    assert_eq!(body["is_default"], true);
    assert_eq!(body["is_active"], true);

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn employee_cannot_create_coverage_plan() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-emp-deny").await;
    let email = unique_email("cp-emp");
    let (_uid, password) = common::create_test_user(&pool, org_id, "employee", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Should Fail" }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 403);

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn list_coverage_plans() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-list").await;
    let email = unique_email("cp-list");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    // Create two plans
    for name in ["Plan A", "Plan B"] {
        client
            .post(format!("http://{}/api/coverage-plans", addr))
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({ "name": name }))
            .send()
            .await
            .unwrap();
    }

    let resp = client
        .get(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(body.len(), 2);

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn update_coverage_plan() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-update").await;
    let email = unique_email("cp-upd");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    // Create
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Original" }))
        .send()
        .await
        .unwrap();
    let plan: serde_json::Value = resp.json().await.unwrap();
    let plan_id = plan["id"].as_str().unwrap();

    // Update
    let resp = client
        .patch(format!("http://{}/api/coverage-plans/{}", addr, plan_id))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "name": "Renamed",
            "description": "Updated desc",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["name"], "Renamed");
    assert_eq!(body["description"], "Updated desc");

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn delete_coverage_plan() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-delete").await;
    let email = unique_email("cp-del");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Deleteme" }))
        .send()
        .await
        .unwrap();
    let plan: serde_json::Value = resp.json().await.unwrap();
    let plan_id = plan["id"].as_str().unwrap();

    let resp = client
        .delete(format!("http://{}/api/coverage-plans/{}", addr, plan_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Verify it's gone
    let resp = client
        .get(format!("http://{}/api/coverage-plans/{}", addr, plan_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 404);

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn only_one_default_plan_per_org() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-default").await;
    let email = unique_email("cp-def");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    // Create first plan as default
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Plan A", "is_default": true }))
        .send()
        .await
        .unwrap();
    let plan_a: serde_json::Value = resp.json().await.unwrap();
    let plan_a_id = plan_a["id"].as_str().unwrap();
    assert_eq!(plan_a["is_default"], true);

    // Create second plan as default — should succeed and unset Plan A
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Plan B", "is_default": true }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let plan_b: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(plan_b["is_default"], true);

    // Plan A should no longer be default
    let resp = client
        .get(format!("http://{}/api/coverage-plans/{}", addr, plan_a_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    let plan_a_refreshed: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(plan_a_refreshed["is_default"], false);

    common::cleanup_test_org(&pool, org_id).await;
}

// ── Slot Bulk Upsert ─────────────────────────────────────────────────────────

#[tokio::test]
async fn bulk_upsert_slots() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-slots").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("cp-slots");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    // Create plan
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Slot Test Plan" }))
        .send()
        .await
        .unwrap();
    let plan: serde_json::Value = resp.json().await.unwrap();
    let plan_id = plan["id"].as_str().unwrap();

    // Bulk upsert 3 slots for Monday (dow=1)
    let slots = serde_json::json!({
        "slots": [
            { "classification_id": class_id.to_string(), "day_of_week": 1, "slot_index": 12, "min_headcount": 1, "target_headcount": 2, "max_headcount": 3 },
            { "classification_id": class_id.to_string(), "day_of_week": 1, "slot_index": 13, "min_headcount": 1, "target_headcount": 2, "max_headcount": 3 },
            { "classification_id": class_id.to_string(), "day_of_week": 1, "slot_index": 14, "min_headcount": 0, "target_headcount": 1, "max_headcount": 2 },
        ]
    });

    let resp = client
        .post(format!(
            "http://{}/api/coverage-plans/{}/slots/bulk",
            addr, plan_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&slots)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let body: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(body.len(), 3);

    // List slots and verify
    let resp = client
        .get(format!(
            "http://{}/api/coverage-plans/{}/slots",
            addr, plan_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let all_slots: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(all_slots.len(), 3);

    // Upsert again with different values — should replace
    let slots2 = serde_json::json!({
        "slots": [
            { "classification_id": class_id.to_string(), "day_of_week": 1, "slot_index": 12, "min_headcount": 2, "target_headcount": 4, "max_headcount": 6 },
        ]
    });

    let resp = client
        .post(format!(
            "http://{}/api/coverage-plans/{}/slots/bulk",
            addr, plan_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&slots2)
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Should still have 1 slot for (class, dow=1) after replacement
    // (the group was (class_id, 1) so all 3 old ones deleted, 1 new inserted)
    let resp = client
        .get(format!(
            "http://{}/api/coverage-plans/{}/slots",
            addr, plan_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    let all_slots: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(all_slots.len(), 1);
    assert_eq!(all_slots[0]["target_headcount"], 4);

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn slot_validation_rejects_invalid_range() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-slot-val").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("cp-slotval");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Validation Plan" }))
        .send()
        .await
        .unwrap();
    let plan: serde_json::Value = resp.json().await.unwrap();
    let plan_id = plan["id"].as_str().unwrap();

    // min > target should fail
    let resp = client
        .post(format!(
            "http://{}/api/coverage-plans/{}/slots/bulk",
            addr, plan_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "slots": [{
                "classification_id": class_id.to_string(),
                "day_of_week": 0, "slot_index": 0,
                "min_headcount": 5, "target_headcount": 2, "max_headcount": 6,
            }]
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 400, "min > target should be rejected");

    // slot_index out of range should fail
    let resp = client
        .post(format!(
            "http://{}/api/coverage-plans/{}/slots/bulk",
            addr, plan_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "slots": [{
                "classification_id": class_id.to_string(),
                "day_of_week": 0, "slot_index": 50,
                "min_headcount": 1, "target_headcount": 2, "max_headcount": 3,
            }]
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 400, "slot_index=50 should be rejected");

    common::cleanup_test_org(&pool, org_id).await;
}

// ── Plan Assignments (date ranges) ───────────────────────────────────────────

#[tokio::test]
async fn create_and_delete_assignment() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-assign").await;
    let email = unique_email("cp-assign");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    // Create plan
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Assignment Plan" }))
        .send()
        .await
        .unwrap();
    let plan: serde_json::Value = resp.json().await.unwrap();
    let plan_id = plan["id"].as_str().unwrap();

    // Create assignment
    let resp = client
        .post(format!("http://{}/api/coverage-plans/assignments", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "plan_id": plan_id,
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "notes": "March coverage",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let assignment: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(assignment["plan_id"], plan_id);
    assert_eq!(assignment["start_date"], "2026-03-01");
    assert_eq!(assignment["end_date"], "2026-03-31");
    let assignment_id = assignment["id"].as_str().unwrap();

    // List assignments
    let resp = client
        .get(format!("http://{}/api/coverage-plans/assignments", addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    let assignments: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(assignments.len(), 1);

    // Delete assignment
    let resp = client
        .delete(format!(
            "http://{}/api/coverage-plans/assignments/{}",
            addr, assignment_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Verify empty
    let resp = client
        .get(format!("http://{}/api/coverage-plans/assignments", addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    let assignments: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(assignments.len(), 0);

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn assignment_rejects_end_before_start() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-asn-val").await;
    let email = unique_email("cp-asnval");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Val Plan" }))
        .send()
        .await
        .unwrap();
    let plan: serde_json::Value = resp.json().await.unwrap();
    let plan_id = plan["id"].as_str().unwrap();

    let resp = client
        .post(format!("http://{}/api/coverage-plans/assignments", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "plan_id": plan_id,
            "start_date": "2026-03-31",
            "end_date": "2026-03-01",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(
        resp.status(),
        400,
        "end_date before start_date should be rejected"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

// ── Resolved Coverage ────────────────────────────────────────────────────────

#[tokio::test]
async fn resolved_coverage_uses_default_plan() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-resolve").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("cp-resolve");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    // Create default plan
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Default Plan", "is_default": true }))
        .send()
        .await
        .unwrap();
    let plan: serde_json::Value = resp.json().await.unwrap();
    let plan_id = plan["id"].as_str().unwrap();

    // Add slots for Tuesday (dow=2), slot 16 (08:00)
    client
        .post(format!(
            "http://{}/api/coverage-plans/{}/slots/bulk",
            addr, plan_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "slots": [{
                "classification_id": class_id.to_string(),
                "day_of_week": 2, "slot_index": 16,
                "min_headcount": 1, "target_headcount": 3, "max_headcount": 5,
            }]
        }))
        .send()
        .await
        .unwrap();

    // Resolve for 2026-02-24 (Tuesday)
    let resp = client
        .get(format!(
            "http://{}/api/coverage-plans/resolved/2026-02-24",
            addr
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let slots: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(slots.len(), 1);
    assert_eq!(slots[0]["slot_index"], 16);
    assert_eq!(slots[0]["target_headcount"], 3);
    assert_eq!(slots[0]["actual_headcount"], 0);
    assert_eq!(slots[0]["status"], "red");

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn resolved_coverage_prefers_date_assignment_over_default() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-priority").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let email = unique_email("cp-prio");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    // Create default plan with target=2
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Default", "is_default": true }))
        .send()
        .await
        .unwrap();
    let default_plan: serde_json::Value = resp.json().await.unwrap();
    let default_id = default_plan["id"].as_str().unwrap();

    client
        .post(format!(
            "http://{}/api/coverage-plans/{}/slots/bulk",
            addr, default_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "slots": [{
                "classification_id": class_id.to_string(),
                "day_of_week": 2, "slot_index": 16,
                "min_headcount": 1, "target_headcount": 2, "max_headcount": 4,
            }]
        }))
        .send()
        .await
        .unwrap();

    // Create override plan with target=5
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "Override" }))
        .send()
        .await
        .unwrap();
    let override_plan: serde_json::Value = resp.json().await.unwrap();
    let override_id = override_plan["id"].as_str().unwrap();

    client
        .post(format!(
            "http://{}/api/coverage-plans/{}/slots/bulk",
            addr, override_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "slots": [{
                "classification_id": class_id.to_string(),
                "day_of_week": 2, "slot_index": 16,
                "min_headcount": 2, "target_headcount": 5, "max_headcount": 8,
            }]
        }))
        .send()
        .await
        .unwrap();

    // Assign override plan for Feb 2026
    client
        .post(format!("http://{}/api/coverage-plans/assignments", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "plan_id": override_id,
            "start_date": "2026-02-01",
            "end_date": "2026-02-28",
        }))
        .send()
        .await
        .unwrap();

    // Resolve for 2026-02-24 — should use override (target=5), not default (target=2)
    let resp = client
        .get(format!(
            "http://{}/api/coverage-plans/resolved/2026-02-24",
            addr
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let slots: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(slots.len(), 1);
    assert_eq!(
        slots[0]["target_headcount"], 5,
        "Should use override plan, not default"
    );

    // Resolve for 2026-03-03 (Tuesday) — should fall back to default (target=2)
    let resp = client
        .get(format!(
            "http://{}/api/coverage-plans/resolved/2026-03-03",
            addr
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    let slots: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert_eq!(slots.len(), 1);
    assert_eq!(
        slots[0]["target_headcount"], 2,
        "Should fall back to default plan"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn resolved_coverage_returns_empty_when_no_plan() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-noplan").await;
    let email = unique_email("cp-noplan");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    let resp = client
        .get(format!(
            "http://{}/api/coverage-plans/resolved/2026-02-24",
            addr
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let slots: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert!(slots.is_empty(), "No plan configured should return empty");

    common::cleanup_test_org(&pool, org_id).await;
}

// ── Org Isolation ────────────────────────────────────────────────────────────

#[tokio::test]
async fn org_isolation_cannot_see_other_org_plans() {
    let (addr, pool) = common::setup_test_app().await;
    let org_a = common::create_test_org(&pool, "cp-iso-a").await;
    let org_b = common::create_test_org(&pool, "cp-iso-b").await;

    let email_a = unique_email("cp-isoa");
    let (_uid_a, pass_a) = common::create_test_user(&pool, org_a, "admin", &email_a).await;
    let token_a = common::get_auth_token(addr, &email_a, &pass_a).await;

    let email_b = unique_email("cp-isob");
    let (_uid_b, pass_b) = common::create_test_user(&pool, org_b, "admin", &email_b).await;
    let token_b = common::get_auth_token(addr, &email_b, &pass_b).await;

    let client = common::http_client();

    // Org A creates a plan
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token_a))
        .json(&serde_json::json!({ "name": "Org A Plan" }))
        .send()
        .await
        .unwrap();
    let plan: serde_json::Value = resp.json().await.unwrap();
    let plan_id = plan["id"].as_str().unwrap();

    // Org B should not see it in list
    let resp = client
        .get(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token_b))
        .send()
        .await
        .unwrap();
    let plans: Vec<serde_json::Value> = resp.json().await.unwrap();
    assert!(plans.is_empty(), "Org B should not see Org A's plans");

    // Org B should not access it by ID
    let resp = client
        .get(format!("http://{}/api/coverage-plans/{}", addr, plan_id))
        .header("Authorization", format!("Bearer {}", token_b))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 404, "Org B should get 404 for Org A's plan");

    // Org B should not be able to delete it
    let resp = client
        .delete(format!("http://{}/api/coverage-plans/{}", addr, plan_id))
        .header("Authorization", format!("Bearer {}", token_b))
        .send()
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        404,
        "Org B should get 404 deleting Org A's plan"
    );

    common::cleanup_test_org(&pool, org_a).await;
    common::cleanup_test_org(&pool, org_b).await;
}

// ── Schedule integration (day view uses coverage plans) ──────────────────────

#[tokio::test]
async fn day_view_reflects_coverage_plan() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "cp-dayview").await;
    let class_id = common::create_test_classification(&pool, org_id).await;
    let _template_id = common::create_test_shift_template(&pool, org_id).await;
    let email = unique_email("cp-dayview");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();

    // Create default plan with slots for Tuesday (dow=2) covering 07:00-19:00 (slots 14-37)
    let resp = client
        .post(format!("http://{}/api/coverage-plans", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": "DayView Plan", "is_default": true }))
        .send()
        .await
        .unwrap();
    let plan: serde_json::Value = resp.json().await.unwrap();
    let plan_id = plan["id"].as_str().unwrap();

    // Add a slot in the middle of the Day Shift (07:00-19:00), e.g. slot 20 (10:00)
    client
        .post(format!(
            "http://{}/api/coverage-plans/{}/slots/bulk",
            addr, plan_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "slots": [{
                "classification_id": class_id.to_string(),
                "day_of_week": 2, "slot_index": 20,
                "min_headcount": 1, "target_headcount": 3, "max_headcount": 5,
            }]
        }))
        .send()
        .await
        .unwrap();

    // Get day view for 2026-02-24 (Tuesday)
    let resp = client
        .get(format!("http://{}/api/schedule/day/2026-02-24", addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let entries: Vec<serde_json::Value> = resp.json().await.unwrap();

    // Find the "Day Shift" entry (07:00-19:00)
    let day_shift = entries
        .iter()
        .find(|e| e["shift_name"].as_str().unwrap() == "Day Shift")
        .expect("Should find Day Shift entry");

    assert_eq!(
        day_shift["coverage_required"], 3,
        "Day Shift should pick up target=3 from the overlapping plan slot"
    );
    assert_eq!(day_shift["coverage_actual"], 0);
    assert_eq!(day_shift["coverage_status"], "red");

    common::cleanup_test_org(&pool, org_id).await;
}
