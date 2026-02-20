use anyhow::Context;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiry_hours: u64,
    pub listen_addr: String,
    pub cors_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let jwt_secret = std::env::var("JWT_SECRET").context("JWT_SECRET must be set")?;
        if jwt_secret.len() < 32 {
            anyhow::bail!("JWT_SECRET must be at least 32 characters for security");
        }
        if jwt_secret.contains("change_me") {
            anyhow::bail!("JWT_SECRET contains placeholder value — set a real secret before running");
        }

        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?,
            jwt_secret,
            jwt_expiry_hours: std::env::var("JWT_EXPIRY_HOURS")
                .unwrap_or_else(|_| "12".into())
                .parse()
                .context("JWT_EXPIRY_HOURS must be a number")?,
            listen_addr: std::env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into()),
            cors_origins: std::env::var("CORS_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:5173".into())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
        })
    }
}
