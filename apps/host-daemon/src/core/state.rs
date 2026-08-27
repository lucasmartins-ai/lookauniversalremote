//! Global shared application state for the host daemon.

use crate::context::ContextWatcher;
use crate::core::config::DaemonConfig;
use crate::core::multi_peer::MultiPeerSessionManager;
use crate::core::session::Session;
use crate::input::events::InputEvent;
use crate::input::router::InputRouter;
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
    /// Multi-peer session manager (up to 4 player slots)
    pub multi_peer: Arc<RwLock<MultiPeerSessionManager>>,
    /// Active client session (Slot 0 for backwards compatibility)
    pub session: Arc<RwLock<Option<Session>>>,
    /// Safety watchdog
    pub watchdog: Arc<DeadManWatchdog>,
    /// Active WebRTC peer connection (Slot 0)
    pub peer_connection: Arc<RwLock<Option<Arc<RTCPeerConnection>>>>,
    /// Active WebRTC peer connections by slot (0..3)
    pub peer_connections: Arc<RwLock<[Option<Arc<RTCPeerConnection>>; 4]>>,
    /// Channel sender for processed input events
    pub event_tx: Option<mpsc::Sender<InputEvent>>,
    /// Smart Context foreground application watcher
    pub context_watcher: Option<Arc<ContextWatcher>>,
    /// Reference to global input router
    pub input_router: Option<Arc<InputRouter>>,
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
        Self::with_context(config, keypair, nonce_mgr, watchdog, event_tx, None, None)
    }

    /// Initializes application state with context watcher integration.
    pub fn with_context(
        config: DaemonConfig,
        keypair: HostKeyPair,
        nonce_mgr: Arc<NonceManager>,
        watchdog: Arc<DeadManWatchdog>,
        event_tx: Option<mpsc::Sender<InputEvent>>,
        context_watcher: Option<Arc<ContextWatcher>>,
        input_router: Option<Arc<InputRouter>>,
    ) -> Self {
        Self {
            config: Arc::new(config),
            keypair: Arc::new(keypair),
            nonce_mgr,
            multi_peer: Arc::new(RwLock::new(MultiPeerSessionManager::new())),
            session: Arc::new(RwLock::new(None)),
            watchdog,
            peer_connection: Arc::new(RwLock::new(None)),
            peer_connections: Arc::new(RwLock::new([None, None, None, None])),
            event_tx,
            context_watcher,
            input_router,
        }
    }
}
