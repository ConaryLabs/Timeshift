mod common;

use uuid::Uuid;

fn unique_email(prefix: &str) -> String {
    format!("{}+{}@test.local", prefix, &Uuid::new_v4().to_string()[..8])
}

#[tokio::test]
async fn user_cannot_see_other_orgs_classifications() {
    let (addr, pool) = common::setup_test_app().await;

    // Create two separate organizations
    let org_a_id = common::create_test_org(&pool, "iso-org-a").await;
    let org_b_id = common::create_test_org(&pool, "iso-org-b").await;

    // Create admin users in each org
    let email_a = unique_email("iso-admin-a");
    let email_b = unique_email("iso-admin-b");
    let (_uid_a, pw_a) = common::create_test_user(&pool, org_a_id, "admin", &email_a).await;
    let (_uid_b, pw_b) = common::create_test_user(&pool, org_b_id, "admin", &email_b).await;

    let token_a = common::get_auth_token(addr, &email_a, &pw_a).await;
    let token_b = common::get_auth_token(addr, &email_b, &pw_b).await;

    let client = common::http_client();

    // Admin A creates a classification in org A
    let resp = client
        .post(format!("http://{}/api/classifications", addr))
        .header("Authorization", format!("Bearer {}", token_a))
        .json(&serde_json::json!({
            "name": "Org A Only Classification",
            "abbreviation": "OAC",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Admin B creates a classification in org B
    let resp = client
        .post(format!("http://{}/api/classifications", addr))
        .header("Authorization", format!("Bearer {}", token_b))
        .json(&serde_json::json!({
            "name": "Org B Only Classification",
            "abbreviation": "OBC",
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Admin A lists classifications — should see only org A's
    let resp = client
        .get(format!("http://{}/api/classifications", addr))
        .header("Authorization", format!("Bearer {}", token_a))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body_a: Vec<serde_json::Value> = resp.json().await.unwrap();

    let names_a: Vec<&str> = body_a.iter().filter_map(|c| c["name"].as_str()).collect();
    assert!(
        names_a.contains(&"Org A Only Classification"),
        "Org A user should see org A classifications"
    );
    assert!(
        !names_a.contains(&"Org B Only Classification"),
        "Org A user must NOT see org B classifications"
    );

    // Admin B lists classifications — should see only org B's
    let resp = client
        .get(format!("http://{}/api/classifications", addr))
        .header("Authorization", format!("Bearer {}", token_b))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body_b: Vec<serde_json::Value> = resp.json().await.unwrap();

    let names_b: Vec<&str> = body_b.iter().filter_map(|c| c["name"].as_str()).collect();
    assert!(
        names_b.contains(&"Org B Only Classification"),
        "Org B user should see org B classifications"
    );
    assert!(
        !names_b.contains(&"Org A Only Classification"),
        "Org B user must NOT see org A classifications"
    );

    // Cleanup
    common::cleanup_test_org(&pool, org_a_id).await;
    common::cleanup_test_org(&pool, org_b_id).await;
}

#[tokio::test]
async fn user_cannot_see_other_orgs_users() {
    let (addr, pool) = common::setup_test_app().await;

    let org_a_id = common::create_test_org(&pool, "iso-users-a").await;
    let org_b_id = common::create_test_org(&pool, "iso-users-b").await;

    let email_a = unique_email("iso-usr-a");
    let email_b = unique_email("iso-usr-b");
    let (_uid_a, pw_a) = common::create_test_user(&pool, org_a_id, "admin", &email_a).await;
    let (_uid_b, _pw_b) = common::create_test_user(&pool, org_b_id, "admin", &email_b).await;

    let token_a = common::get_auth_token(addr, &email_a, &pw_a).await;

    let client = common::http_client();

    // User A lists users — should NOT see user B
    let resp = client
        .get(format!("http://{}/api/users", addr))
        .header("Authorization", format!("Bearer {}", token_a))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: Vec<serde_json::Value> = resp.json().await.unwrap();

    let emails: Vec<&str> = body.iter().filter_map(|u| u["email"].as_str()).collect();
    assert!(
        emails.contains(&email_a.as_str()),
        "Should see own org user"
    );
    assert!(
        !emails.contains(&email_b.as_str()),
        "Must NOT see other org user"
    );

    common::cleanup_test_org(&pool, org_a_id).await;
    common::cleanup_test_org(&pool, org_b_id).await;
}
