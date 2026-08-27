//! Integration tests for Host Daemon API v1 Smart TV discovery and control endpoints.

use axum::http::StatusCode;
use lookaremote_host_daemon::core::config::DaemonConfig;
use lookaremote_host_daemon::core::state::AppState;
use lookaremote_host_daemon::input::watchdog::DeadManWatchdog;
use lookaremote_host_daemon::pairing::crypto::HostKeyPair;
use lookaremote_host_daemon::pairing::nonce::NonceManager;
use lookaremote_host_daemon::transport::signaling::create_signaling_router;
use lookaremote_host_daemon::tv::discovery::models::{DiscoverySource, TvDevice};
use lookaremote_protocol::messages::tv_commands;
use lookaremote_protocol::messages::tv_target_devices::*;
use std::sync::Arc;
use std::time::Duration;
use tower::ServiceExt;

fn create_test_app_state() -> AppState {
    let config = DaemonConfig::default();
    let keypair = HostKeyPair::generate();
    let nonce_mgr = Arc::new(NonceManager::new(Duration::from_secs(60)));
    let watchdog = Arc::new(DeadManWatchdog::new(
        Duration::from_millis(300),
        Duration::from_millis(20),
    ));

    AppState::new(config, keypair, nonce_mgr, watchdog, None)
}

#[tokio::test]
async fn test_api_v1_tv_devices_and_selection() {
    let state = create_test_app_state();

    // Pre-populate with test device
    let test_tv = TvDevice::new(
        "samsung-tv-1".to_string(),
        "192.168.1.120".to_string(),
        "Living Room Samsung QLED".to_string(),
        "Samsung".to_string(),
        SAMSUNG_TIZEN,
        8001,
        DiscoverySource::Ssdp,
    );
    state.tv_discovery.registry().upsert_device(test_tv);

    let app = create_signaling_router(state.clone());

    // 1. GET /api/v1/tv/devices
    let req = axum::http::Request::builder()
        .uri("/api/v1/tv/devices")
        .method("GET")
        .body(axum::body::Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(json["status"], "ok");
    assert_eq!(json["devices"].as_array().unwrap().len(), 1);

    // 2. POST /api/v1/tv/select
    let select_payload = serde_json::json!({
        "device_id": "samsung-tv-1"
    });
    let req = axum::http::Request::builder()
        .uri("/api/v1/tv/select")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(select_payload.to_string()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(json["status"], "ok");
    assert_eq!(json["selected_device"]["id"], "samsung-tv-1");

    // 3. POST /api/v1/tv/command (Authoritative)
    let cmd_payload = serde_json::json!({
        "command_code": tv_commands::VOLUME_UP,
        "target_device": SAMSUNG_TIZEN
    });
    let req = axum::http::Request::builder()
        .uri("/api/v1/tv/command")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(cmd_payload.to_string()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}
