//! Network discovery, local HTTP/WebSocket signaling, and WebRTC DataChannel transport.

pub mod network;
pub mod packet_handler;
pub mod signaling;
pub mod webrtc;

pub use network::{
    discover_local_ip, is_private_ip, is_rfc1918_or_loopback, validate_bind_address,
    NetworkError,
};
pub use packet_handler::handle_raw_packet;
pub use signaling::{
    create_signaling_router, HealthResponse, PairRequest, PairResponse, SignalingMessage,
};
pub use webrtc::{
    configure_data_channel, create_input_data_channel, create_peer_connection,
    setup_incoming_data_channel_listener, setup_peer_connection_logging, WebRtcConfig,
};
