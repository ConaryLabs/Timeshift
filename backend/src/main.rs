// backend/src/main.rs
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
use tower_governor::{governor::GovernorConfigBuilder, key_extractor::SmartIpKeyExtractor, GovernorLayer};
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

    // Build optional Twilio config for SMS alerts
    let twilio = cfg.twilio_config();
    if let Some(ref t) = twilio {
        tracing::info!("Twilio SMS configured (from: {})", t.from_number);
    } else {
        tracing::info!("Twilio SMS not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to enable)");
    }

    let state = AppState {
        pool,
        jwt_secret: cfg.jwt_secret.clone(),
        access_token_expiry_minutes: cfg.access_token_expiry_minutes,
        refresh_token_expiry_days: cfg.refresh_token_expiry_days,
        cookie_secure: cfg.cookie_secure,
        twilio,
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

    // Rate limiters per IP (SmartIpKeyExtractor reads X-Forwarded-For/X-Real-IP from Caddy)
    let login_rl = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(2)
            .burst_size(5)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .unwrap(),
    );
    let refresh_rl = Arc::new(
        GovernorConfigBuilder::default()
            .per_millisecond(200)
            .burst_size(10)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .unwrap(),
    );
    let callout_rl = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(3)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .unwrap(),
    );
    let password_rl = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(12)
            .burst_size(5)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .unwrap(),
    );
    let sms_rl = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(60)
            .burst_size(1)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .unwrap(),
    );

    // Periodically prune expired rate-limit entries
    let limiters = vec![
        login_rl.limiter().clone(),
        refresh_rl.limiter().clone(),
        callout_rl.limiter().clone(),
        password_rl.limiter().clone(),
        sms_rl.limiter().clone(),
    ];
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            for limiter in &limiters {
                limiter.retain_recent();
            }
        }
    });

    // Background leave accrual runner (checks hourly, idempotent per org per day).
    // Monitored spawn: if the task panics, log the error and restart after 60s.
    let accrual_pool = state.pool.clone();
    tokio::spawn(async move {
        loop {
            match tokio::spawn(timeshift_backend::services::accrual::background_accrual_task(
                accrual_pool.clone(),
            ))
            .await
            {
                Ok(()) => {
                    tracing::warn!(
                        "accrual background task exited unexpectedly, restarting in 60s"
                    );
                }
                Err(e) => {
                    tracing::error!(
                        "accrual background task panicked: {e}, restarting in 60s"
                    );
                }
            }
            tokio::time::sleep(Duration::from_secs(60)).await;
        }
    });

    // Build rate-limited routers. Route registrations use api:: handlers so the
    // handler<->URL mapping is discoverable from api/mod.rs::all_routes.
    let rate_limited = vec![
        Router::new()
            .route("/api/auth/login", post(api::auth::login))
            .route_layer(GovernorLayer { config: login_rl })
            .with_state(state.clone()),
        Router::new()
            .route("/api/auth/refresh", post(api::auth::refresh))
            .route_layer(GovernorLayer { config: refresh_rl })
            .with_state(state.clone()),
        Router::new()
            .route(
                "/api/callout/events/:id/bump",
                post(api::callout::create_bump_request),
            )
            .route(
                "/api/callout/events/:id/volunteer",
                post(api::ot::volunteer),
            )
            .route_layer(GovernorLayer { config: callout_rl })
            .with_state(state.clone()),
        Router::new()
            .route(
                "/api/users/me/password",
                axum::routing::patch(api::users::change_password),
            )
            .route_layer(GovernorLayer { config: password_rl })
            .with_state(state.clone()),
        Router::new()
            .route(
                "/api/coverage-plans/gaps/:date/sms-alert",
                post(api::coverage_plans::send_sms_alert),
            )
            .route_layer(GovernorLayer { config: sms_rl })
            .with_state(state.clone()),
    ];

    let app = api::all_routes(state, rate_limited)
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
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received, starting graceful shutdown");
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
    headers.insert(
        "content-security-policy",
        HeaderValue::from_static(
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'",
        ),
    );
    headers.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    response
}
