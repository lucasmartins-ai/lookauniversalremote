//! Session lifecycle and state machine management.

use serde::{Deserialize, Serialize};
use std::time::Instant;

/// Active session state machine variants.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionState {
    /// Daemon is listening, waiting for client pairing.
    Idle,
    /// Cryptographic handshake in progress (validating HMAC / SDP exchange).
    Pairing,
    /// WebRTC DataChannel active and streaming input frames.
    Connected,
    /// Watchdog triggered (dead-man switch fired; no packets for >100ms).
    Degraded,
    /// Connection closed or terminated.
    Closed,
}

impl std::fmt::Display for SessionState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Idle => write!(f, "Idle"),
            Self::Pairing => write!(f, "Pairing"),
            Self::Connected => write!(f, "Connected"),
            Self::Degraded => write!(f, "Degraded"),
            Self::Closed => write!(f, "Closed"),
        }
    }
}

/// Active client session metadata and metrics.
#[derive(Debug, Clone)]
pub struct Session {
    /// Unique session identifier
    pub session_id: String,
    /// Client's X25519 public key
    pub client_pubkey: [u8; 32],
    /// Diffie-Hellman derived shared secret
    pub shared_secret: [u8; 32],
    /// Current state
    pub state: SessionState,
    /// Instant session established
    pub connected_at: Instant,
    /// Total valid input packets received
    pub packets_received: u64,
}

impl Session {
    /// Creates a new active session after successful handshake.
    pub fn new(session_id: String, client_pubkey: [u8; 32], shared_secret: [u8; 32]) -> Self {
        Self {
            session_id,
            client_pubkey,
            shared_secret,
            state: SessionState::Pairing,
            connected_at: Instant::now(),
            packets_received: 0,
        }
    }

    /// Transitions session state.
    pub fn set_state(&mut self, new_state: SessionState) {
        self.state = new_state;
    }

    /// Increments received packet count.
    pub fn increment_packets(&mut self) {
        self.packets_received = self.packets_received.saturating_add(1);
    }
}
