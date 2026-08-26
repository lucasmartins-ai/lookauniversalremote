//! Global shared application state for the host daemon.

use crate::context::ContextWatcher;
use crate::core::config::DaemonConfig;
use crate::core::session::Session;
use crate::input::events::InputEvent;
use crate::input::watchdog::DeadManWatchdog;
use crate::pairing::crypto::HostKeyPair;
use crate::pairing::nonce::NonceManager;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use webrtc::peer_connection::RTCPeerConnection;

/// Global shared state container accessible across Axum HTTP and WebSocket handlers.
#[derive(Clone)]
pub struct AppState {
    /// Runtime daemon configuration
    pub config: Arc<DaemonConfig>,
    /// Ephemeral host X25519 keypair
    pub keypair: Arc<HostKeyPair>,
    /// Pairing nonce store and manager
    pub nonce_mgr: Arc<NonceManager>,
    /// Active client session
    pub session: Arc<RwLock<Option<Session>>>,
    /// Safety watchdog
    pub watchdog: Arc<DeadManWatchdog>,
    /// Active WebRTC peer connection
    pub peer_connection: Arc<RwLock<Option<Arc<RTCPeerConnection>>>>,
    /// Channel sender for processed input events
    pub event_tx: Option<mpsc::Sender<InputEvent>>,
    /// Smart Context foreground application watcher
    pub context_watcher: Option<Arc<ContextWatcher>>,
}

impl AppState {
    /// Initializes a new application state with configuration and components.
    pub fn new(
        config: DaemonConfig,
        keypair: HostKeyPair,
        nonce_mgr: Arc<NonceManager>,
        watchdog: Arc<DeadManWatchdog>,
        event_tx: Option<mpsc::Sender<InputEvent>>,
    ) -> Self {
        Self::with_context(config, keypair, nonce_mgr, watchdog, event_tx, None)
    }

    /// Initializes application state with context watcher integration.
    pub fn with_context(
        config: DaemonConfig,
        keypair: HostKeyPair,
        nonce_mgr: Arc<NonceManager>,
        watchdog: Arc<DeadManWatchdog>,
        event_tx: Option<mpsc::Sender<InputEvent>>,
        context_watcher: Option<Arc<ContextWatcher>>,
    ) -> Self {
        Self {
            config: Arc::new(config),
            keypair: Arc::new(keypair),
            nonce_mgr,
            session: Arc::new(RwLock::new(None)),
            watchdog,
            peer_connection: Arc::new(RwLock::new(None)),
            event_tx,
            context_watcher,
        }
    }
}
