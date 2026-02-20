mod common;

use uuid::Uuid;

/// Helper to generate a unique email for each test run.
fn unique_email(prefix: &str) -> String {
    format!("{}+{}@test.local", prefix, &Uuid::new_v4().to_string()[..8])
}

#[tokio::test]
async fn login_valid_credentials_returns_token_and_profile() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "auth-valid").await;
    let email = unique_email("auth-valid");
    let (_user_id, password) = common::create_test_user(&pool, org_id, "admin", &email).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/auth/login", addr))
        .json(&serde_json::json!({
            "email": email,
            "password": password,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = resp.json().await.unwrap();
    assert!(body["token"].is_string(), "Response should contain a token");
    assert_eq!(body["user"]["email"].as_str().unwrap(), email);
    assert_eq!(body["user"]["role"].as_str().unwrap(), "admin");
    assert!(body["user"]["is_active"].as_bool().unwrap());

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn login_wrong_password_returns_401() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "auth-wrong-pw").await;
    let email = unique_email("auth-wrong-pw");
    let (_user_id, _password) = common::create_test_user(&pool, org_id, "employee", &email).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/auth/login", addr))
        .json(&serde_json::json!({
            "email": email,
            "password": "wrong-password",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401);

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn login_nonexistent_email_returns_401() {
    let (addr, _pool) = common::setup_test_app().await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/auth/login", addr))
        .json(&serde_json::json!({
            "email": "nobody-here@nonexistent.test",
            "password": "doesntmatter",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn login_inactive_user_returns_401() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "auth-inactive").await;
    let email = unique_email("auth-inactive");
    let (_user_id, password) = common::create_inactive_user(&pool, org_id, &email).await;

    let client = common::http_client();
    let resp = client
        .post(format!("http://{}/api/auth/login", addr))
        .json(&serde_json::json!({
            "email": email,
            "password": password,
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401);

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn request_without_auth_header_returns_401() {
    let (addr, _pool) = common::setup_test_app().await;

    let client = common::http_client();
    let resp = client
        .get(format!("http://{}/api/auth/me", addr))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn request_with_malformed_token_returns_401() {
    let (addr, _pool) = common::setup_test_app().await;

    let client = common::http_client();
    let resp = client
        .get(format!("http://{}/api/auth/me", addr))
        .header("Authorization", "Bearer not-a-real-jwt-token")
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn request_with_expired_token_returns_401() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "auth-expired").await;
    let email = unique_email("auth-expired");
    let (user_id, _password) = common::create_test_user(&pool, org_id, "employee", &email).await;

    let expired_token = common::create_expired_token(user_id, org_id);

    let client = common::http_client();
    let resp = client
        .get(format!("http://{}/api/auth/me", addr))
        .header("Authorization", format!("Bearer {}", expired_token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401, "Expired token should be rejected");

    common::cleanup_test_org(&pool, org_id).await;
}

#[tokio::test]
async fn auth_me_with_valid_token_returns_profile() {
    let (addr, pool) = common::setup_test_app().await;
    let org_id = common::create_test_org(&pool, "auth-me").await;
    let email = unique_email("auth-me");
    let (_user_id, password) = common::create_test_user(&pool, org_id, "employee", &email).await;

    let token = common::get_auth_token(addr, &email, &password).await;

    let client = common::http_client();
    let resp = client
        .get(format!("http://{}/api/auth/me", addr))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["email"].as_str().unwrap(), email);

    common::cleanup_test_org(&pool, org_id).await;
}
