use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
        HeaderValue, Method,
    },
    routing::post,
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tower_http::{compression::CompressionLayer, cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use timeshift_backend::{api, config, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env if present (dev convenience)
    let _ = dotenvy::dotenv();

    // Tracing
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = config::Config::from_env()?;

    // Database pool
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&cfg.database_url)
        .await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    tracing::info!("Database connected and migrations applied");

    let state = AppState {
        pool,
        jwt_secret: cfg.jwt_secret.clone(),
        jwt_expiry_hours: cfg.jwt_expiry_hours,
    };

    // CORS
    let allowed_origins: Vec<HeaderValue> = cfg
        .cors_origins
        .iter()
        .filter_map(|o| match o.parse::<HeaderValue>() {
            Ok(v) => Some(v),
            Err(e) => {
                tracing::warn!("Ignoring invalid CORS origin {:?}: {}", o, e);
                None
            }
        })
        .collect();

    let cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
        ])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])
        .allow_origin(allowed_origins);

    // Rate limiting for login endpoint: 5 requests burst, replenish 1 per 2 seconds per IP
    let governor_conf = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(2)
            .burst_size(5)
            .finish()
            .unwrap(),
    );

    let governor_limiter = governor_conf.limiter().clone();
    let cleanup_interval = Duration::from_secs(60);
    std::thread::spawn(move || loop {
        std::thread::sleep(cleanup_interval);
        governor_limiter.retain_recent();
    });

    // Login route with rate limiting
    let login_router = Router::new()
        .route("/api/auth/login", post(api::auth::login))
        .layer(GovernorLayer {
            config: governor_conf,
        })
        .with_state(state.clone());

    let app = api::router(state)
        .merge(login_router)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new());

    let listener = tokio::net::TcpListener::bind(&cfg.listen_addr).await?;
    tracing::info!("Listening on {}", cfg.listen_addr);

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}
