//! Axum HTTP and WebSocket signaling endpoints for pairing and WebRTC negotiation.

use crate::core::session::{Session, SessionState};
use crate::core::state::AppState;
use crate::pairing::crypto::verify_pairing_proof;
use crate::transport::webrtc::{
    create_peer_connection, setup_peer_connection_logging, WebRtcConfig,
};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::{Method, StatusCode};
use axum::response::{IntoResponse, Json, Response};
use axum::routing::{get, post};
use axum::Router;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;
use tower_http::cors::{Any, CorsLayer};
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
    /// Current session state
    pub session_state: SessionState,
    /// Active registered nonces count
    pub active_nonces: usize,
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

/// Creates the configured Axum router with all signaling routes and CORS middleware.
pub fn create_signaling_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health_handler))
        .route("/api/pair", post(pair_handler))
        .route("/ws/signaling", get(ws_signaling_upgrade))
        .layer(cors)
        .with_state(state)
}

/// Health check endpoint (`GET /health`).
pub async fn health_handler(State(state): State<AppState>) -> Json<HealthResponse> {
    let session_state = {
        let lock = state.session.read().await;
        lock.as_ref()
            .map(|s| s.state)
            .unwrap_or(SessionState::Idle)
    };

    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        session_state,
        active_nonces: state.nonce_mgr.active_count(),
    })
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
                    message: "client_pubkey must be a 64-character hex encoded string (32 bytes)".to_string(),
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
                    message: "nonce must be a 64-character hex encoded string (32 bytes)".to_string(),
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
                    message: "hmac_proof must be a 64-character hex encoded string (32 bytes)".to_string(),
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

    // 5. Generate session ID and register active session
    let session_id = format!("{:016x}", rand::random::<u64>());
    let mut session = Session::new(
        session_id.clone(),
        client_pubkey_bytes,
        shared_secret,
    );
    session.set_state(SessionState::Pairing);

    {
        let mut lock = state.session.write().await;
        *lock = Some(session);
    }

    info!(session_id = %session_id, "Client paired successfully via X25519 + HMAC-SHA256");

    (
        StatusCode::OK,
        Json(PairResponse {
            status: "paired".to_string(),
            session_id,
            host_pubkey: state.keypair.public_key_hex(),
            signaling_ws_url: "/ws/signaling".to_string(),
        }),
    )
        .into_response()
}

/// WebSocket signaling upgrade handler (`GET /ws/signaling`).
pub async fn ws_signaling_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_signaling_socket(socket, state))
}

/// Handles bidirectional WebSocket signaling session.
async fn handle_signaling_socket(socket: WebSocket, state: AppState) {
    let (mut ws_sender, mut ws_receiver) = StreamExt::split(socket);

    info!("New WebSocket signaling connection established");

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
        let mut pc_lock = state.peer_connection.write().await;
        *pc_lock = Some(Arc::clone(&peer_connection));
    }

    // Setup logging and incoming DataChannel listener
    crate::transport::webrtc::setup_incoming_data_channel_listener_with_context(
        &peer_connection,
        Arc::clone(&state.watchdog),
        state.event_tx.clone(),
        state.context_watcher.clone(),
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

    // Process incoming WebSocket signaling messages from client
    while let Some(Ok(ws_msg)) = ws_receiver.next().await {
        match ws_msg {
            Message::Text(text) => {
                let text_str: &str = &text;
                match serde_json::from_str::<SignalingMessage>(text_str) {
                    Ok(SignalingMessage::Offer { sdp }) => {
                        debug!("Received SDP Offer from client");
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
                                if let Err(e) = peer_connection
                                    .set_local_description(answer.clone())
                                    .await
                                {
                                    error!("Failed to set local description (Answer): {e}");
                                    continue;
                                }

                                let reply = SignalingMessage::Answer {
                                    sdp: answer.sdp,
                                };
                                let _ = ice_tx.send(reply).await;
                                debug!("Generated and dispatched SDP Answer");
                            }
                            Err(e) => {
                                error!("Failed to create SDP Answer: {e}");
                            }
                        }
                    }
                    Ok(SignalingMessage::Answer { sdp }) => {
                        debug!("Received SDP Answer from client");
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
                        debug!("Received ICE Candidate from client: {}", candidate);
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
                        warn!("Received error from client signaling: {message}");
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
                info!("WebSocket signaling connection closed by client");
                break;
            }
            _ => {}
        }
    }

    send_task.abort();
    debug!("Signaling loop terminated");
}
