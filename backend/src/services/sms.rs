use tracing;

#[derive(Clone, Debug)]
pub struct TwilioConfig {
    pub account_sid: String,
    pub auth_token: String,
    pub from_number: String,
}

pub async fn send_sms(config: &TwilioConfig, to: &str, body: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
        config.account_sid
    );

    let resp = client
        .post(&url)
        .basic_auth(&config.account_sid, Some(&config.auth_token))
        .form(&[("To", to), ("From", &config.from_number), ("Body", body)])
        .send()
        .await
        .map_err(|e| format!("HTTP error: {e}"))?;

    if resp.status().is_success() {
        tracing::info!(to = to, "SMS sent successfully");
        Ok(())
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        let msg = format!("Twilio returned {status}: {text}");
        tracing::warn!(to = to, error = %msg, "SMS send failed");
        Err(msg)
    }
}
