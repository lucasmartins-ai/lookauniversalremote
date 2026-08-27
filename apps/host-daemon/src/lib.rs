//! LookARemote Host Daemon Core Library.
//!
//! Provides local network discovery, RFC 1918 security isolation, ephemeral X25519 pairing,
//! Axum-based WebSocket signaling, WebRTC DataChannel streaming, and 100ms dead-man safety watchdog.

pub mod context;
pub mod core;
pub mod drivers;
pub mod input;
pub mod pairing;
pub mod transport;
pub mod tray;
pub mod tv;

pub use crate::context::{
    create_platform_window_detector, ActiveWindowInfo, ArbitrationResult, ArbitrationSource,
    ContextArbitrator, ContextConfig, ContextWatcher, ContextWatcherEvent, DaemonSection,
    MockWindowDetector, ProfileConfig, ProfileError, ProfileMatcher, TargetControlMode,
    WindowDetector, WindowDetectorError,
};
pub use crate::core::config::{CliArgs, DaemonConfig};
pub use crate::core::multi_peer::{
    MultiPeerError, MultiPeerSessionManager, PeerSlot, PeerSlotSummary, MAX_PEERS,
};
pub use crate::core::session::{Session, SessionState};
pub use crate::core::state::AppState;
pub use crate::drivers::{
    create_platform_driver, create_platform_driver_for_slot, create_platform_keyboard_driver,
    create_platform_mouse_driver, DriverError, MockGamepadDriver, MockKeyboardDriver,
    MockMouseDriver, VirtualGamepadDriver, VirtualKeyboardDriver, VirtualMouseDriver,
};
pub use crate::input::events::InputEvent;
pub use crate::input::motion_processor::{MotionAimMode, MotionProcessor, MotionProcessorConfig};
pub use crate::input::router::InputRouter;
pub use crate::input::watchdog::DeadManWatchdog;

pub use crate::pairing::crypto::{HostKeyPair, PAIRING_HMAC_CONTEXT};
pub use crate::pairing::nonce::{NonceError, NonceManager};
pub use crate::pairing::qr::{build_pairing_uri, render_terminal_qr};
pub use crate::transport::network::{discover_local_ip, is_private_ip, validate_bind_address};
pub use crate::transport::packet_handler::{handle_raw_packet, handle_raw_slot_packet};
pub use crate::transport::qr_page::render_qr_html;
pub use crate::transport::signaling::create_signaling_router;
pub use crate::transport::webrtc::{
    configure_data_channel, configure_data_channel_for_slot, create_input_data_channel,
    create_peer_connection,
};
pub use crate::tray::{TrayCompanion, TrayConfig};
pub use crate::tv::{TvDispatcher, TvDispatcherStats};
