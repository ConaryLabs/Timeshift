use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
        HeaderValue, Method, Request,
    },
    middleware,
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
        access_token_expiry_minutes: cfg.access_token_expiry_minutes,
        refresh_token_expiry_days: cfg.refresh_token_expiry_days,
        cookie_secure: cfg.cookie_secure,
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
        .allow_credentials(true)
        .allow_origin(allowed_origins);

    // Rate limiting for login endpoint: 5 requests burst, replenish 1 per 2 seconds per IP
    let governor_conf = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(2)
            .burst_size(5)
            .finish()
            .unwrap(),
    );

    // Rate limiting for refresh endpoint: 5 requests burst, replenish 1 per 200ms per IP
    let refresh_governor_conf = Arc::new(
        GovernorConfigBuilder::default()
            .per_millisecond(200)
            .burst_size(10)
            .finish()
            .unwrap(),
    );

    // Rate limiting for callout actions (bump, volunteer): 3 requests burst, 1 per second per IP
    let callout_action_governor_conf = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(3)
            .finish()
            .unwrap(),
    );

    let governor_limiter = governor_conf.limiter().clone();
    let refresh_governor_limiter = refresh_governor_conf.limiter().clone();
    let callout_action_limiter = callout_action_governor_conf.limiter().clone();
    let cleanup_interval = Duration::from_secs(60);
    std::thread::spawn(move || loop {
        std::thread::sleep(cleanup_interval);
        governor_limiter.retain_recent();
        refresh_governor_limiter.retain_recent();
        callout_action_limiter.retain_recent();
    });

    // Login route with rate limiting
    let login_router = Router::new()
        .route("/api/auth/login", post(api::auth::login))
        .layer(GovernorLayer {
            config: governor_conf,
        })
        .with_state(state.clone());

    // Refresh route with rate limiting
    let refresh_router = Router::new()
        .route("/api/auth/refresh", post(api::auth::refresh))
        .layer(GovernorLayer {
            config: refresh_governor_conf,
        })
        .with_state(state.clone());

    // Callout action routes (bump, volunteer) with rate limiting
    let callout_action_router = Router::new()
        .route(
            "/api/callout/events/:id/bump",
            post(api::callout::create_bump_request),
        )
        .route(
            "/api/callout/events/:id/volunteer",
            post(api::ot::volunteer),
        )
        .layer(GovernorLayer {
            config: callout_action_governor_conf,
        })
        .with_state(state.clone());

    // TODO(M5): /api/users/me/password should be rate-limited (e.g., 5 req/min per IP)
    // similar to login. Currently registered in api/mod.rs; to add rate limiting it
    // needs to be moved here with its own GovernorLayer, like the login/refresh routes.

    let app = api::router(state)
        .merge(login_router)
        .merge(refresh_router)
        .merge(callout_action_router)
        .layer(middleware::from_fn(security_headers))
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

async fn security_headers(
    req: Request<axum::body::Body>,
    next: middleware::Next,
) -> axum::response::Response {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert(
        "strict-transport-security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    response
}
