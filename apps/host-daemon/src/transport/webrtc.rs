//! WebRTC PeerConnection, ICE Candidate handling, and low-latency DataChannel setup.

use crate::input::events::InputEvent;
use crate::input::watchdog::DeadManWatchdog;
use crate::transport::packet_handler::handle_raw_packet;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, info, warn};
use webrtc::api::media_engine::MediaEngine;
use webrtc::api::setting_engine::SettingEngine;
use webrtc::api::APIBuilder;
use webrtc::data_channel::data_channel_init::RTCDataChannelInit;
use webrtc::data_channel::data_channel_message::DataChannelMessage;
use webrtc::data_channel::RTCDataChannel;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState;
use webrtc::peer_connection::RTCPeerConnection;

/// Configuration for creating a WebRTC PeerConnection.
pub struct WebRtcConfig {
    /// STUN/TURN ICE servers (empty for pure LAN)
    pub ice_servers: Vec<String>,
}

impl Default for WebRtcConfig {
    fn default() -> Self {
        Self {
            // Pure local network P2P does not require public STUN servers
            ice_servers: vec!["stun:stun.l.google.com:19302".to_string()],
        }
    }
}

/// Creates a new configured WebRTC RTCPeerConnection.
pub async fn create_peer_connection(
    _config: &WebRtcConfig,
) -> Result<Arc<RTCPeerConnection>, webrtc::Error> {
    let mut media_engine = MediaEngine::default();
    media_engine.register_default_codecs()?;

    let mut setting_engine = SettingEngine::default();
    // Enable loopback candidate gathering for local testing
    setting_engine.set_answering_dtls_role(webrtc::dtls_transport::dtls_role::DTLSRole::Server)?;

    let api = APIBuilder::new()
        .with_media_engine(media_engine)
        .with_setting_engine(setting_engine)
        .build();

    let rtc_config = RTCConfiguration {
        ice_servers: vec![],
        ..Default::default()
    };

    let peer_connection = Arc::new(api.new_peer_connection(rtc_config).await?);
    Ok(peer_connection)
}

/// Attaches listeners to a DataChannel with unordered and zero-retransmission delivery.
pub fn configure_data_channel(
    data_channel: Arc<RTCDataChannel>,
    watchdog: Arc<DeadManWatchdog>,
    event_tx: Option<mpsc::Sender<InputEvent>>,
) {
    configure_data_channel_with_context(data_channel, watchdog, event_tx, None);
}

/// Attaches listeners to a DataChannel with context watcher auto-synchronization.
pub fn configure_data_channel_with_context(
    data_channel: Arc<RTCDataChannel>,
    watchdog: Arc<DeadManWatchdog>,
    event_tx: Option<mpsc::Sender<InputEvent>>,
    context_watcher: Option<Arc<crate::context::ContextWatcher>>,
) {
    let label = data_channel.label().to_string();
    let wd_for_open = Arc::clone(&watchdog);
    let dc_for_open = Arc::clone(&data_channel);
    let watcher_for_open = context_watcher.clone();

    data_channel.on_open(Box::new(move || {
        info!("WebRTC DataChannel '{}' OPENED and ready for input", label);
        wd_for_open.arm();
        if let Some(ref watcher) = watcher_for_open {
            watcher.set_data_channel(Some(Arc::clone(&dc_for_open)));
        }
        Box::pin(async {})
    }));

    let wd_for_close = Arc::clone(&watchdog);
    let watcher_for_close = context_watcher.clone();
    data_channel.on_close(Box::new(move || {
        warn!("WebRTC DataChannel CLOSED");
        wd_for_close.disarm();
        if let Some(ref watcher) = watcher_for_close {
            watcher.set_data_channel(None);
        }
        Box::pin(async {})
    }));

    let wd_for_msg = Arc::clone(&watchdog);
    data_channel.on_message(Box::new(move |msg: DataChannelMessage| {
        if msg.is_string {
            debug!("Received unexpected text message on DataChannel");
        } else {
            let _ = handle_raw_packet(&msg.data, &wd_for_msg, event_tx.as_ref());
        }
        Box::pin(async {})
    }));
}

/// Creates the official LookARemote input DataChannel with `ordered: false` and `max_retransmits: 0`.
pub async fn create_input_data_channel(
    peer_connection: &RTCPeerConnection,
    watchdog: Arc<DeadManWatchdog>,
    event_tx: Option<mpsc::Sender<InputEvent>>,
) -> Result<Arc<RTCDataChannel>, webrtc::Error> {
    let dc_init = RTCDataChannelInit {
        ordered: Some(false),
        max_retransmits: Some(0),
        ..Default::default()
    };

    let data_channel = peer_connection
        .create_data_channel("lookaremote-input", Some(dc_init))
        .await?;

    configure_data_channel(Arc::clone(&data_channel), watchdog, event_tx);
    Ok(data_channel)
}

/// Binds DataChannel listener on an RTCPeerConnection to automatically attach handlers
/// when the remote peer initiates the DataChannel.
pub fn setup_incoming_data_channel_listener(
    peer_connection: &Arc<RTCPeerConnection>,
    watchdog: Arc<DeadManWatchdog>,
    event_tx: Option<mpsc::Sender<InputEvent>>,
) {
    setup_incoming_data_channel_listener_with_context(peer_connection, watchdog, event_tx, None);
}

/// Binds DataChannel listener on an RTCPeerConnection with context watcher integration.
pub fn setup_incoming_data_channel_listener_with_context(
    peer_connection: &Arc<RTCPeerConnection>,
    watchdog: Arc<DeadManWatchdog>,
    event_tx: Option<mpsc::Sender<InputEvent>>,
    context_watcher: Option<Arc<crate::context::ContextWatcher>>,
) {
    peer_connection.on_data_channel(Box::new(move |dc: Arc<RTCDataChannel>| {
        info!("Received incoming remote DataChannel: '{}'", dc.label());
        let wd = Arc::clone(&watchdog);
        let tx = event_tx.clone();
        let cw = context_watcher.clone();
        configure_data_channel_with_context(dc, wd, tx, cw);
        Box::pin(async {})
    }));
}

/// Sets up lifecycle event logging on an RTCPeerConnection.
pub fn setup_peer_connection_logging(
    peer_connection: &Arc<RTCPeerConnection>,
    watchdog: Arc<DeadManWatchdog>,
) {
    peer_connection.on_peer_connection_state_change(Box::new(move |state: RTCPeerConnectionState| {
        info!("WebRTC PeerConnection state changed to: {state}");
        if state == RTCPeerConnectionState::Failed || state == RTCPeerConnectionState::Closed {
            watchdog.disarm();
        }
        Box::pin(async {})
    }));
}
