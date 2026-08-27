//! Integration tests for Axum HTTP and WebSocket signaling endpoints.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use futures_util::SinkExt;
use http_body_util::BodyExt;
use lookaremote_host_daemon::core::config::DaemonConfig;
use lookaremote_host_daemon::core::state::AppState;
use lookaremote_host_daemon::input::watchdog::DeadManWatchdog;
use lookaremote_host_daemon::pairing::crypto::{compute_pairing_proof, HostKeyPair};
use lookaremote_host_daemon::pairing::nonce::NonceManager;
use lookaremote_host_daemon::transport::signaling::{create_signaling_router, SignalingMessage};
use rand::rngs::OsRng;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio_tungstenite::tungstenite::protocol::Message as WsMessage;
use tower::ServiceExt;
use x25519_dalek::{PublicKey, StaticSecret};

fn setup_test_app() -> (AppState, axum::Router) {
    let config = DaemonConfig::default();
    let keypair = HostKeyPair::generate();
    let nonce_mgr = Arc::new(NonceManager::with_default_ttl());
    let watchdog = Arc::new(DeadManWatchdog::standard());

    let state = AppState::new(config, keypair, nonce_mgr, watchdog, None);
    let router = create_signaling_router(state.clone());
    (state, router)
}

#[tokio::test]
async fn test_health_endpoint() {
    let (_state, router) = setup_test_app();

    let request = Request::builder()
        .uri("/health")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    let body_json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(body_json["status"], "ok");
    assert_eq!(body_json["session_state"], "idle");
}

#[tokio::test]
async fn test_pair_handshake_flow() {
    let (state, router) = setup_test_app();

    // 1. Generate client keypair & host nonce
    let client_secret = StaticSecret::random_from_rng(OsRng);
    let client_public = PublicKey::from(&client_secret);
    let client_pubkey_hex = hex::encode(client_public.as_bytes());

    let nonce_bytes = state.nonce_mgr.generate_nonce();
    let nonce_hex = hex::encode(nonce_bytes);

    // 2. Client derives shared secret and computes HMAC proof
    let client_shared_secret = client_secret.diffie_hellman(state.keypair.public_key());
    let hmac_proof = compute_pairing_proof(client_shared_secret.as_bytes(), &nonce_bytes);
    let hmac_proof_hex = hex::encode(hmac_proof);

    // 3. Send valid pair request
    let pair_payload = serde_json::json!({
        "client_pubkey": client_pubkey_hex,
        "nonce": nonce_hex,
        "hmac_proof": hmac_proof_hex,
    });

    let request = Request::builder()
        .uri("/api/pair")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(pair_payload.to_string()))
        .unwrap();

    let response = router.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    let body_json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(body_json["status"], "paired");
    assert!(body_json["session_id"].is_string());
    assert_eq!(body_json["host_pubkey"], state.keypair.public_key_hex());

    // 4. Replay attack: resend exact same pair request -> must fail (nonce consumed!)
    let replay_request = Request::builder()
        .uri("/api/pair")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(pair_payload.to_string()))
        .unwrap();

    let replay_response = router.oneshot(replay_request).await.unwrap();
    assert_eq!(
        replay_response.status(),
        StatusCode::UNAUTHORIZED,
        "Replay with consumed nonce must return 401 Unauthorized"
    );
}

#[tokio::test]
async fn test_pair_invalid_hmac_proof_rejected() {
    let (state, router) = setup_test_app();

    let client_secret = StaticSecret::random_from_rng(OsRng);
    let client_public = PublicKey::from(&client_secret);
    let client_pubkey_hex = hex::encode(client_public.as_bytes());

    let nonce_bytes = state.nonce_mgr.generate_nonce();
    let nonce_hex = hex::encode(nonce_bytes);

    // Provide invalid HMAC proof
    let fake_proof_hex = hex::encode([0xFFu8; 32]);

    let pair_payload = serde_json::json!({
        "client_pubkey": client_pubkey_hex,
        "nonce": nonce_hex,
        "hmac_proof": fake_proof_hex,
    });

    let request = Request::builder()
        .uri("/api/pair")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(pair_payload.to_string()))
        .unwrap();

    let response = router.oneshot(request).await.unwrap();
    assert_eq!(
        response.status(),
        StatusCode::UNAUTHORIZED,
        "Tampered HMAC must return 401 Unauthorized"
    );
}

#[tokio::test]
async fn test_websocket_signaling_connection() {
    let (_state, router) = setup_test_app();

    // Bind to dynamic local port
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr: SocketAddr = listener.local_addr().unwrap();

    // Spawn server in background
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });

    let ws_url = format!("ws://127.0.0.1:{}/ws/signaling", addr.port());

    // Connect WebSocket client
    let (mut ws_stream, _) = tokio_tungstenite::connect_async(&ws_url)
        .await
        .expect("WebSocket connection to signaling server must succeed");

    // Send Ping
    let ping_json = serde_json::to_string(&SignalingMessage::Ping).unwrap();
    ws_stream
        .send(WsMessage::Text(ping_json.into()))
        .await
        .unwrap();

    // Send Candidate
    let cand_msg = SignalingMessage::Candidate {
        candidate: "candidate:1 1 UDP 2130706431 192.168.1.50 50000 typ host".to_string(),
        sdp_mid: Some("0".to_string()),
        sdp_mline_index: Some(0),
    };
    let cand_json = serde_json::to_string(&cand_msg).unwrap();
    ws_stream
        .send(WsMessage::Text(cand_json.into()))
        .await
        .unwrap();

    // Close WebSocket
    ws_stream.close(None).await.unwrap();
}
