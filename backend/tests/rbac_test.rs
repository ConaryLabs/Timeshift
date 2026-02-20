mod common;

use uuid::Uuid;

fn unique_email(prefix: &str) -> String {
    format!("{}+{}@test.local", prefix, &Uuid::new_v4().to_string()[..8])
}

#[tokio::test]
async fn employee_cannot_create_classification() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "rbac-emp-create").await;
    let email = unique_email("rbac-emp");
    let (_uid, password) = common::create_test_user(&pool, org_id, "employee", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/classifications", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "name": "Should Not Exist",
            "abbreviation": "SNE",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(
        resp.status(),
        403,
        "Employee should not be able to create classifications"
    );

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn admin_can_create_classification() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "rbac-admin-create").await;
    let email = unique_email("rbac-admin");
    let (_uid, password) = common::create_test_user(&pool, org_id, "admin", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/classifications", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "name": "Test Classification",
            "abbreviation": "TC1",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(
        resp.status(),
        200,
        "Admin should be able to create classifications"
    );

    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["name"].as_str().unwrap(), "Test Classification");
    assert_eq!(body["abbreviation"].as_str().unwrap(), "TC1");

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn employee_can_list_classifications() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "rbac-emp-list").await;
    let email = unique_email("rbac-list");
    let (_uid, password) = common::create_test_user(&pool, org_id, "employee", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let resp = client
        .get(format!("http://{}/api/classifications", addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(
        resp.status(),
        200,
        "Employee should be able to list classifications"
    );

    let body: serde_json::Value = resp.json().await.unwrap();
    assert!(body.is_array(), "Response should be an array");

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn supervisor_cannot_create_classification() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "rbac-sup-create").await;
    let email = unique_email("rbac-sup");
    let (_uid, password) = common::create_test_user(&pool, org_id, "supervisor", &email).await;
    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/classifications", addr))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "name": "Sup Attempt",
            "abbreviation": "SA1",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(
        resp.status(),
        403,
        "Supervisor should not be able to create classifications"
    );

    common::cleanup_test_org(&pool, org_id).await;
}
