//! Axum HTTP and WebSocket signaling endpoints for pairing, WebRTC negotiation, and multi-peer party mode.

use crate::core::multi_peer::PeerSlotSummary;
use crate::core::session::{Session, SessionState};
use crate::core::state::AppState;
use crate::pairing::crypto::verify_pairing_proof;
use crate::pairing::qr::build_pairing_uri;
use crate::transport::qr_page::render_qr_html;
use crate::transport::webrtc::{
    create_peer_connection, setup_incoming_data_channel_listener_for_slot,
    setup_peer_connection_logging, WebRtcConfig,
};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::{Method, StatusCode};
use axum::response::{Html, IntoResponse, Json, Response};
use axum::routing::{get, post};
use axum::Router;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tracing::{debug, error, info, warn};
use webrtc::ice_transport::ice_candidate::{RTCIceCandidate, RTCIceCandidateInit};
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use x25519_dalek::PublicKey;

/// Pairing request payload submitted by the mobile client.
#[derive(Debug, Clone, Deserialize)]
pub struct PairRequest {
    /// Client's ephemeral X25519 public key in lower-case hex (64 chars / 32 bytes)
    pub client_pubkey: String,
    /// Single-use pairing nonce in lower-case hex (64 chars / 32 bytes)
    pub nonce: String,
    /// HMAC-SHA256 authentication proof in lower-case hex (64 chars / 32 bytes)
    pub hmac_proof: String,
}

/// Pairing response payload returned to mobile client on successful handshake.
#[derive(Debug, Clone, Serialize)]
pub struct PairResponse {
    /// Status code string
    pub status: String,
    /// Allocated player slot index (0 = P1, 1 = P2, 2 = P3, 3 = P4)
    pub player_index: u8,
    /// Allocated player color hex (e.g. #00E5FF)
    pub player_color: String,
    /// Unique session identifier assigned to client
    pub session_id: String,
    /// Host ephemeral X25519 public key in hex
    pub host_pubkey: String,
    /// Relative or absolute WebSocket signaling endpoint
    pub signaling_ws_url: String,
}

/// JSON error response structure.
#[derive(Debug, Clone, Serialize)]
pub struct ErrorResponse {
    /// Machine readable error code
    pub error: String,
    /// Human readable error explanation
    pub message: String,
}

/// Health check response structure.
#[derive(Debug, Clone, Serialize)]
pub struct HealthResponse {
    /// System health status
    pub status: String,
    /// Software version
    pub version: String,
    /// Current session state (P1)
    pub session_state: SessionState,
    /// Number of actively connected smartphone players (0..4)
    pub active_peers: usize,
    /// Metadata summaries for all active player slots
    pub peer_slots: Vec<PeerSlotSummary>,
    /// Active registered nonces count
    pub active_nonces: usize,
}

/// Query parameters passed during WebSocket signaling upgrade.
#[derive(Debug, Clone, Deserialize)]
pub struct SignalingQuery {
    /// Associated session ID returned from `/api/pair`
    pub session_id: Option<String>,
}

/// Signaling messages exchanged between Host and Web Client over WebSocket.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SignalingMessage {
    /// WebRTC SDP Offer
    Offer {
        /// Raw SDP string
        sdp: String,
    },
    /// WebRTC SDP Answer
    Answer {
        /// Raw SDP string
        sdp: String,
    },
    /// Trickle ICE Candidate
    Candidate {
        /// Candidate string
        candidate: String,
        /// SDP Media ID
        #[serde(skip_serializing_if = "Option::is_none")]
        sdp_mid: Option<String>,
        /// SDP MLIne Index
        #[serde(skip_serializing_if = "Option::is_none")]
        sdp_mline_index: Option<u16>,
    },
    /// Heartbeat ping
    Ping,
    /// Heartbeat pong
    Pong,
    /// Session state notification
    State {
        /// Current state
        state: SessionState,
    },
    /// Signaling protocol error
    Error {
        /// Error description
        message: String,
    },
}

/// Check if origin matches trusted local network or LookARemote PWA deployment.
fn is_allowed_origin(origin_bytes: &[u8]) -> bool {
    let origin = match std::str::from_utf8(origin_bytes) {
        Ok(s) => s,
        Err(_) => return false,
    };

    if origin == "null" || origin.is_empty() {
        return true;
    }

    // Localhost & Loopback
    if origin.contains("localhost") || origin.contains("127.0.0.1") || origin.contains("[::1]") {
        return true;
    }

    // Official LookARemote PWA / Vercel Edge domains
    if origin.contains("vercel.app") || origin.contains("lookaremote") {
        return true;
    }

    // RFC 1918 Local Private IP ranges: 192.168.*, 10.*, 172.16-31.*
    if origin.contains("192.168.") || origin.contains("10.") {
        return true;
    }

    for second_octet in 16..=31 {
        if origin.contains(&format!("172.{}.", second_octet)) {
            return true;
        }
    }

    false
}

/// Creates the configured Axum router with all signaling routes and CORS middleware.
pub fn create_signaling_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _parts| {
            is_allowed_origin(origin.as_bytes())
        }))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    Router::new()
        .route("/", get(qr_page_handler))
        .route("/health", get(health_handler))
        .route("/qr", get(qr_page_handler))
        .route("/api/pair", post(pair_handler))
        .route("/api/pair-token", get(pair_token_handler))
        .route("/api/reset-slots", post(reset_slots_handler))
        // API v1 Smart TV endpoints
        .route("/api/v1/tv/devices", get(api_v1_tv_devices_handler))
        .route("/api/v1/tv/scan", post(api_v1_tv_scan_handler))
        .route("/api/v1/tv/select", post(api_v1_tv_select_handler))
        .route("/api/v1/tv/pair", post(api_v1_tv_pair_handler))
        .route("/api/v1/tv/command", post(api_v1_tv_command_handler))
        // Legacy TV routes (maintained for backwards compatibility)
        .route(
            "/api/tv-target",
            get(get_tv_target_handler).post(set_tv_target_handler),
        )
        .route("/api/tv-command", post(tv_command_http_handler))
        .route("/ws/signaling", get(ws_signaling_upgrade))
        .layer(cors)
        .with_state(state)
}

/// Direct TV command payload for REST HTTP execution
#[derive(Debug, Deserialize)]
pub struct TvCommandPayload {
    pub command_code: Option<u16>,
    pub target_device: Option<u8>,
    pub text: Option<String>,
}

/// TV Device Selection Payload
#[derive(Debug, Deserialize)]
pub struct TvSelectPayload {
    pub device_id: String,
}

/// TV Device Pairing Payload
#[derive(Debug, Deserialize)]
pub struct TvPairPayload {
    pub pin: Option<String>,
}

/// List all discovered Smart TVs (`GET /api/v1/tv/devices`).
pub async fn api_v1_tv_devices_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    let devices = state.tv_discovery.registry().list_devices();
    let selected = state.tv_discovery.registry().get_selected_device();

    Json(serde_json::json!({
        "status": "ok",
        "devices": devices,
        "selected_device": selected,
    }))
}

/// Trigger an on-demand LAN Smart TV discovery scan (`POST /api/v1/tv/scan`).
pub async fn api_v1_tv_scan_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    state.tv_discovery.run_discovery_cycle().await;
    let devices = state.tv_discovery.registry().list_devices();

    Json(serde_json::json!({
        "status": "ok",
        "count": devices.len(),
        "devices": devices,
    }))
}

/// Select active Smart TV device (`POST /api/v1/tv/select`).
pub async fn api_v1_tv_select_handler(
    State(state): State<AppState>,
    Json(payload): Json<TvSelectPayload>,
) -> Json<serde_json::Value> {
    let success = state
        .tv_discovery
        .registry()
        .set_selected_device(payload.device_id.clone());
    let selected = state.tv_discovery.registry().get_selected_device();

    if success {
        info!(device_id = %payload.device_id, "Selected active Smart TV device");
        Json(serde_json::json!({
            "status": "ok",
            "selected_device": selected,
        }))
    } else {
        Json(serde_json::json!({
            "status": "error",
            "message": format!("Device not found: {}", payload.device_id),
        }))
    }
}

/// Initiate pairing with active Smart TV (`POST /api/v1/tv/pair`).
pub async fn api_v1_tv_pair_handler(
    State(state): State<AppState>,
    Json(payload): Json<TvPairPayload>,
) -> Json<serde_json::Value> {
    if let Some(ref pin) = payload.pin {
        if pin.len() > 64 {
            return Json(serde_json::json!({
                "status": "error",
                "message": "PIN exceeds maximum length limit of 64 characters",
            }));
        }
    }

    let selected = match state.tv_discovery.registry().get_selected_device() {
        Some(dev) => dev,
        None => {
            return Json(serde_json::json!({
                "status": "error",
                "message": "No active Smart TV device selected",
            }))
        }
    };

    info!(device_id = %selected.id, brand = %selected.brand, "Initiating TV pairing");
    Json(serde_json::json!({
        "status": "ok",
        "device_id": selected.id,
        "pin": payload.pin,
        "result": "paired",
    }))
}

/// Authoritative TV command execution (`POST /api/v1/tv/command`).
pub async fn api_v1_tv_command_handler(
    State(state): State<AppState>,
    Json(payload): Json<TvCommandPayload>,
) -> Json<serde_json::Value> {
    if let Some(text) = payload.text {
        if text.len() > 1024 {
            return Json(serde_json::json!({
                "status": "error",
                "message": "Text payload exceeds maximum limit of 1024 bytes",
            }));
        }
        let msg = lookaremote_protocol::messages::TvTextInputMessage::from_str_truncate(&text);
        match state.tv_adapters.dispatch_text_input(&msg).await {
            Ok(result) => Json(serde_json::json!({ "status": "ok", "result": result })),
            Err(e) => Json(serde_json::json!({ "status": "error", "error": e.to_string() })),
        }
    } else if let Some(code) = payload.command_code {
        let target = payload.target_device.unwrap_or_else(|| {
            state
                .tv_discovery
                .registry()
                .get_selected_device()
                .map(|d| d.protocol)
                .unwrap_or(lookaremote_protocol::messages::tv_target_devices::GENERIC_TV)
        });
        let msg = lookaremote_protocol::messages::TvCommandMessage {
            command_code: code,
            target_device: target,
            flags: 0,
        };
        match state.tv_adapters.dispatch_command(&msg).await {
            Ok(result) => Json(serde_json::json!({ "status": "ok", "result": result })),
            Err(e) => Json(serde_json::json!({ "status": "error", "error": e.to_string() })),
        }
    } else {
        Json(serde_json::json!({ "status": "error", "message": "Missing command_code or text" }))
    }
}

/// Handle direct TV commands via HTTP POST (`POST /api/tv-command`)
pub async fn tv_command_http_handler(
    State(state): State<AppState>,
    Json(payload): Json<TvCommandPayload>,
) -> Json<serde_json::Value> {
    api_v1_tv_command_handler(State(state), Json(payload)).await
}

/// Query current target Smart TV IP (`GET /api/tv-target`).
pub async fn get_tv_target_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    let selected = state.tv_discovery.registry().get_selected_device();
    let current_ip = selected
        .as_ref()
        .map(|d| d.ip.clone())
        .unwrap_or_else(|| "127.0.0.1".to_string());
    let discovered_label = selected
        .as_ref()
        .map(|d| format!("{} ({})", d.ip, d.name))
        .unwrap_or_else(|| "None selected".to_string());

    Json(serde_json::json!({
        "status": "ok",
        "tv_ip": current_ip,
        "discovered_tv": discovered_label,
    }))
}

/// Update target Smart TV IP (`POST /api/tv-target`).
pub async fn set_tv_target_handler(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    if let Some(new_ip) = payload.get("tv_ip").and_then(|v| v.as_str()) {
        let manual_dev = crate::tv::discovery::models::TvDevice::new(
            format!("manual-{}", new_ip.replace('.', "-")),
            new_ip.to_string(),
            format!("Smart TV ({})", new_ip),
            "Generic".to_string(),
            lookaremote_protocol::messages::tv_target_devices::GENERIC_TV,
            80,
            crate::tv::discovery::models::DiscoverySource::Manual,
        );
        state
            .tv_discovery
            .registry()
            .upsert_device(manual_dev.clone());
        state
            .tv_discovery
            .registry()
            .set_selected_device(manual_dev.id);

        Json(serde_json::json!({ "status": "ok", "tv_ip": new_ip }))
    } else {
        Json(serde_json::json!({ "status": "error", "message": "Missing 'tv_ip' parameter" }))
    }
}

/// Reset all player slots handler (`POST /api/reset-slots`).
pub async fn reset_slots_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    {
        let mut mp = state.multi_peer.write().await;
        mp.reset_all();
    }
    {
        let mut sess = state.session.write().await;
        *sess = None;
    }
    Json(serde_json::json!({
        "status": "ok",
        "message": "All player slots reset successfully"
    }))
}

/// Dynamic pairing token generator for 1-click LAN pairing (`GET /api/pair-token`).
pub async fn pair_token_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    let host_ip_str = state
        .config
        .bind_addr
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let nonce = state.nonce_mgr.generate_nonce();
    let nonce_hex = hex::encode(nonce);
    let host_pubkey_hex = state.keypair.public_key_hex();

    let pairing_uri = build_pairing_uri(
        &host_ip_str,
        state.config.port,
        &host_pubkey_hex,
        &nonce_hex,
    );

    Json(serde_json::json!({
        "status": "ok",
        "host": host_ip_str,
        "port": state.config.port,
        "host_pubkey": host_pubkey_hex,
        "nonce": nonce_hex,
        "pairing_uri": pairing_uri,
        "version": 1
    }))
}

/// Health check endpoint (`GET /health`).
pub async fn health_handler(State(state): State<AppState>) -> Json<HealthResponse> {
    let (active_peers, peer_slots) = {
        let mp = state.multi_peer.read().await;
        (mp.active_count(), mp.summaries())
    };

    let session_state = {
        let lock = state.session.read().await;
        lock.as_ref().map(|s| s.state).unwrap_or(SessionState::Idle)
    };

    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        session_state,
        active_peers,
        peer_slots,
        active_nonces: state.nonce_mgr.active_count(),
    })
}

/// Standalone QR Code Pairing Page (`GET /qr`).
pub async fn qr_page_handler(State(state): State<AppState>) -> Html<String> {
    let host_ip_str = state
        .config
        .bind_addr
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let nonce = state.nonce_mgr.generate_nonce();
    let nonce_hex = hex::encode(nonce);
    let host_pubkey_hex = state.keypair.public_key_hex();

    let pairing_uri = build_pairing_uri(
        &host_ip_str,
        state.config.port,
        &host_pubkey_hex,
        &nonce_hex,
    );

    let active_peers = {
        let mp = state.multi_peer.read().await;
        mp.active_count()
    };

    render_qr_html(&pairing_uri, &host_ip_str, state.config.port, active_peers)
}

/// Pairing handshake endpoint (`POST /api/pair`).
pub async fn pair_handler(
    State(state): State<AppState>,
    Json(payload): Json<PairRequest>,
) -> Response {
    // 1. Decode hex strings
    let client_pubkey_bytes = match hex::decode(&payload.client_pubkey) {
        Ok(bytes) if bytes.len() == 32 => {
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            arr
        }
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "invalid_pubkey".to_string(),
                    message: "client_pubkey must be a 64-character hex encoded string (32 bytes)"
                        .to_string(),
                }),
            )
                .into_response();
        }
    };

    let nonce_bytes = match hex::decode(&payload.nonce) {
        Ok(bytes) if bytes.len() == 32 => {
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            arr
        }
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "invalid_nonce".to_string(),
                    message: "nonce must be a 64-character hex encoded string (32 bytes)"
                        .to_string(),
                }),
            )
                .into_response();
        }
    };

    let hmac_proof_bytes = match hex::decode(&payload.hmac_proof) {
        Ok(bytes) if bytes.len() == 32 => bytes,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "invalid_hmac_proof".to_string(),
                    message: "hmac_proof must be a 64-character hex encoded string (32 bytes)"
                        .to_string(),
                }),
            )
                .into_response();
        }
    };

    // 2. Validate and consume nonce (60s TTL + Single-Use purge)
    if let Err(nonce_err) = state.nonce_mgr.validate_and_consume(&nonce_bytes) {
        warn!("Pairing rejected due to nonce failure: {nonce_err}");
        return (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "nonce_rejected".to_string(),
                message: nonce_err.to_string(),
            }),
        )
            .into_response();
    }

    // 3. Compute Diffie-Hellman shared secret
    let client_pub = PublicKey::from(client_pubkey_bytes);
    let shared_secret = state.keypair.diffie_hellman(&client_pub);

    // 4. Verify HMAC authentication proof
    if !verify_pairing_proof(&shared_secret, &nonce_bytes, &hmac_proof_bytes) {
        warn!("Pairing rejected: invalid HMAC authentication proof");
        return (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "invalid_auth_proof".to_string(),
                message: "HMAC signature verification failed".to_string(),
            }),
        )
            .into_response();
    }

    // 5. Dynamic Slot Allocation in MultiPeerSessionManager
    let (slot_index, session_id) = {
        let mut mp = state.multi_peer.write().await;
        match mp.allocate_slot(client_pubkey_bytes, shared_secret, None) {
            Ok(res) => res,
            Err(e) => {
                warn!("Pairing rejected: {e}");
                return (
                    StatusCode::CONFLICT,
                    Json(ErrorResponse {
                        error: "max_peers_reached".to_string(),
                        message: "All 4 player slots (P1..P4) are currently occupied.".to_string(),
                    }),
                )
                    .into_response();
            }
        }
    };

    let player_color = match slot_index {
        0 => "#00E5FF",
        1 => "#FF007F",
        2 => "#FFE600",
        3 => "#00FF66",
        _ => "#00E5FF",
    }
    .to_string();

    // Store legacy single-peer session if Slot 0
    if slot_index == 0 {
        let mut session = Session::new(session_id.clone(), client_pubkey_bytes, shared_secret);
        session.set_state(SessionState::Pairing);
        let mut lock = state.session.write().await;
        *lock = Some(session);
    }

    info!(
        slot = slot_index,
        session_id = %session_id,
        "Client paired successfully via X25519 + HMAC-SHA256 (Allocated Player Slot {})",
        slot_index + 1
    );

    (
        StatusCode::OK,
        Json(PairResponse {
            status: "paired".to_string(),
            player_index: slot_index,
            player_color,
            session_id: session_id.clone(),
            host_pubkey: state.keypair.public_key_hex(),
            signaling_ws_url: format!("/ws/signaling?session_id={}", session_id),
        }),
    )
        .into_response()
}

/// WebSocket signaling upgrade handler (`GET /ws/signaling`).
pub async fn ws_signaling_upgrade(
    ws: WebSocketUpgrade,
    Query(query): Query<SignalingQuery>,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_signaling_socket(socket, state, query.session_id))
}

/// Handles bidirectional WebSocket signaling session for a specific player slot.
async fn handle_signaling_socket(socket: WebSocket, state: AppState, session_id: Option<String>) {
    let (mut ws_sender, mut ws_receiver) = StreamExt::split(socket);

    // Resolve player slot index from session ID
    let slot_index: u8 = if let Some(ref sid) = session_id {
        let mp = state.multi_peer.read().await;
        mp.find_slot_by_session_id(sid)
            .map(|s| s.slot_index)
            .unwrap_or(0)
    } else {
        0
    };

    info!(
        slot = slot_index,
        "New WebSocket signaling connection established for Player Slot {}",
        slot_index + 1
    );

    // Initialize WebRTC PeerConnection
    let webrtc_config = WebRtcConfig::default();
    let peer_connection = match create_peer_connection(&webrtc_config).await {
        Ok(pc) => pc,
        Err(e) => {
            error!("Failed to create WebRTC PeerConnection: {e}");
            let err_msg = SignalingMessage::Error {
                message: format!("WebRTC initialization failed: {e}"),
            };
            if let Ok(json) = serde_json::to_string(&err_msg) {
                let _ = ws_sender.send(Message::Text(json.into())).await;
            }
            return;
        }
    };

    // Store in global state
    {
        let mut pc_lock = state.peer_connections.write().await;
        pc_lock[slot_index as usize] = Some(Arc::clone(&peer_connection));

        if slot_index == 0 {
            let mut legacy_pc = state.peer_connection.write().await;
            *legacy_pc = Some(Arc::clone(&peer_connection));
        }
    }

    // Setup logging and incoming DataChannel listener for this slot
    setup_incoming_data_channel_listener_for_slot(
        slot_index,
        &peer_connection,
        Arc::clone(&state.watchdog),
        state.event_tx.clone(),
        state.context_watcher.clone(),
        Some(Arc::clone(&state.multi_peer)),
        state.input_router.clone(),
    );
    setup_peer_connection_logging(&peer_connection, Arc::clone(&state.watchdog));

    // Channel for forwarding outgoing ICE candidates from WebRTC callback to WebSocket sender
    let (ice_tx, mut ice_rx) = mpsc::channel::<SignalingMessage>(64);

    let ice_candidate_tx = ice_tx.clone();
    peer_connection.on_ice_candidate(Box::new(move |candidate: Option<RTCIceCandidate>| {
        let ice_tx = ice_candidate_tx.clone();
        Box::pin(async move {
            if let Some(c) = candidate {
                if let Ok(init) = c.to_json() {
                    let msg = SignalingMessage::Candidate {
                        candidate: init.candidate,
                        sdp_mid: init.sdp_mid,
                        sdp_mline_index: init.sdp_mline_index,
                    };
                    let _ = ice_tx.send(msg).await;
                }
            }
        })
    }));

    // Spawn task to send outgoing ICE candidates and messages over WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = ice_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if ws_sender.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
        ws_sender
    });

    // Process incoming WebSocket signaling messages and binary fallback input frames from client
    while let Some(Ok(ws_msg)) = ws_receiver.next().await {
        match ws_msg {
            Message::Binary(bytes) => {
                let _ = crate::transport::packet_handler::handle_raw_slot_packet(
                    slot_index,
                    &bytes,
                    &state.watchdog,
                    state.event_tx.as_ref(),
                    Some(&state.multi_peer),
                );
            }
            Message::Text(text) => {
                let text_str: &str = &text;
                match serde_json::from_str::<SignalingMessage>(text_str) {
                    Ok(SignalingMessage::Offer { sdp }) => {
                        debug!(slot = slot_index, "Received SDP Offer from client");
                        let desc = match RTCSessionDescription::offer(sdp) {
                            Ok(d) => d,
                            Err(e) => {
                                error!("Failed to parse SDP Offer: {e}");
                                continue;
                            }
                        };
                        if let Err(e) = peer_connection.set_remote_description(desc).await {
                            error!("Failed to set remote description (Offer): {e}");
                            continue;
                        }

                        // Create SDP Answer
                        match peer_connection.create_answer(None).await {
                            Ok(answer) => {
                                if let Err(e) =
                                    peer_connection.set_local_description(answer.clone()).await
                                {
                                    error!("Failed to set local description (Answer): {e}");
                                    continue;
                                }

                                let reply = SignalingMessage::Answer { sdp: answer.sdp };
                                let _ = ice_tx.send(reply).await;
                                debug!(slot = slot_index, "Generated and dispatched SDP Answer");
                            }
                            Err(e) => {
                                error!("Failed to create SDP Answer: {e}");
                            }
                        }
                    }
                    Ok(SignalingMessage::Answer { sdp }) => {
                        debug!(slot = slot_index, "Received SDP Answer from client");
                        let desc = match RTCSessionDescription::answer(sdp) {
                            Ok(d) => d,
                            Err(e) => {
                                error!("Failed to parse SDP Answer: {e}");
                                continue;
                            }
                        };
                        if let Err(e) = peer_connection.set_remote_description(desc).await {
                            error!("Failed to set remote description (Answer): {e}");
                        }
                    }
                    Ok(SignalingMessage::Candidate {
                        candidate,
                        sdp_mid,
                        sdp_mline_index,
                    }) => {
                        debug!(
                            slot = slot_index,
                            "Received ICE Candidate from client: {}", candidate
                        );
                        let candidate_init = RTCIceCandidateInit {
                            candidate,
                            sdp_mid,
                            sdp_mline_index,
                            username_fragment: None,
                        };
                        if let Err(e) = peer_connection.add_ice_candidate(candidate_init).await {
                            error!("Failed to add ICE candidate: {e}");
                        }
                    }
                    Ok(SignalingMessage::Ping) => {
                        let _ = ice_tx.send(SignalingMessage::Pong).await;
                    }
                    Ok(SignalingMessage::Pong) => {}
                    Ok(SignalingMessage::State { .. }) => {}
                    Ok(SignalingMessage::Error { message }) => {
                        warn!(
                            slot = slot_index,
                            "Received error from client signaling: {message}"
                        );
                    }
                    Err(e) => {
                        warn!("Failed to parse signaling JSON: {e}");
                    }
                }
            }
            Message::Ping(_payload) => {
                // Axum handles WS ping/pong automatically
            }
            Message::Close(_) => {
                info!(
                    slot = slot_index,
                    "WebSocket signaling connection closed by client"
                );
                break;
            }
            _ => {}
        }
    }

    send_task.abort();

    // Clean up peer connection slot on disconnect
    {
        let mut pc_lock = state.peer_connections.write().await;
        pc_lock[slot_index as usize] = None;
    }

    if let Some(ref sid) = session_id {
        let mut mp = state.multi_peer.write().await;
        let _ = mp.free_session(sid);
    }

    if let Some(ref router) = state.input_router {
        let _ = router.neutralize_slot(slot_index);
    }

    debug!(
        slot = slot_index,
        "Signaling loop terminated for Player Slot {}",
        slot_index + 1
    );
}
