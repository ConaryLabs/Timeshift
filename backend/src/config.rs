// backend/src/config.rs
use anyhow::Context;

use crate::services::sms::TwilioConfig;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub access_token_expiry_minutes: u64,
    pub refresh_token_expiry_days: u64,
    pub listen_addr: String,
    pub cors_origins: Vec<String>,
    pub cookie_secure: bool,
    /// Twilio SMS config, present only when all three env vars are set.
    pub twilio: Option<TwilioConfig>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let jwt_secret = std::env::var("JWT_SECRET").context("JWT_SECRET must be set")?;
        if jwt_secret.len() < 32 {
            anyhow::bail!("JWT_SECRET must be at least 32 characters for security");
        }
        if jwt_secret.contains("change_me") {
            anyhow::bail!(
                "JWT_SECRET contains placeholder value — set a real secret before running"
            );
        }

        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?,
            jwt_secret,
            access_token_expiry_minutes: std::env::var("ACCESS_TOKEN_EXPIRY_MINUTES")
                .unwrap_or_else(|_| "15".into())
                .parse()
                .context("ACCESS_TOKEN_EXPIRY_MINUTES must be a number")?,
            refresh_token_expiry_days: std::env::var("REFRESH_TOKEN_EXPIRY_DAYS")
                .unwrap_or_else(|_| "30".into())
                .parse()
                .context("REFRESH_TOKEN_EXPIRY_DAYS must be a number")?,
            listen_addr: std::env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into()),
            cors_origins: std::env::var("CORS_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:5173".into())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            cookie_secure: std::env::var("COOKIE_SECURE")
                .unwrap_or_else(|_| "true".into())
                .parse()
                .context("COOKIE_SECURE must be 'true' or 'false'")?,
            twilio: Self::twilio_from_env(),
        })
    }

    /// Build a `TwilioConfig` if all three Twilio env vars are present.
    fn twilio_from_env() -> Option<TwilioConfig> {
        Some(TwilioConfig {
            account_sid: std::env::var("TWILIO_ACCOUNT_SID").ok()?,
            auth_token: std::env::var("TWILIO_AUTH_TOKEN").ok()?,
            from_number: std::env::var("TWILIO_FROM_NUMBER").ok()?,
        })
    }
}
