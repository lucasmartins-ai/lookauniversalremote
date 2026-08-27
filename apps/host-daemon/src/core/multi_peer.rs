//! Multi-Peer Session Manager for Local Multiplayer (Party Mode up to 4 Players).

use crate::core::session::SessionState;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::Instant;
use thiserror::Error;

/// Maximum simultaneous connected smartphone players supported.
pub const MAX_PEERS: usize = 4;

/// Errors produced during multi-peer slot allocation and management.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum MultiPeerError {
    /// All 4 player slots (P1..P4) are currently occupied.
    #[error("Maximum capacity reached: all {0} player slots are occupied")]
    MaxCapacityReached(usize),
    /// Session ID was not found in any active slot.
    #[error("Session ID '{0}' not found in active slots")]
    SessionNotFound(String),
    /// Slot index is out of bounds (must be 0..3).
    #[error("Invalid player slot index {0} (must be 0..3)")]
    InvalidSlotIndex(u8),
}

/// Metadata and real-time telemetry for a connected smartphone peer slot.
#[derive(Debug, Clone, PartialEq)]
pub struct PeerSlot {
    /// Zero-based slot index (0 = P1, 1 = P2, 2 = P3, 3 = P4).
    pub slot_index: u8,
    /// Unique 64-bit random hex session ID.
    pub session_id: String,
    /// Client's ephemeral X25519 public key.
    pub client_pubkey: [u8; 32],
    /// Diffie-Hellman derived shared symmetric secret.
    pub shared_secret: [u8; 32],
    /// Current connection / pairing state.
    pub state: SessionState,
    /// Timestamp when pairing / connection was established.
    pub connected_at: Instant,
    /// Timestamp of most recent received packet or heartbeat.
    pub last_seen: Instant,
    /// Client remote socket address.
    pub client_ip: Option<SocketAddr>,
    /// Client battery percentage (0..100%, or None if not reported).
    pub battery_level: Option<u8>,
    /// Client battery charging state (true if plugged in).
    pub is_charging: Option<bool>,
    /// Measured round-trip latency in milliseconds.
    pub rtt_ms: u32,
    /// Total valid input frames received for this player.
    pub packets_received: u64,
}

impl PeerSlot {
    /// Creates a new peer slot after cryptographic verification.
    pub fn new(
        slot_index: u8,
        session_id: String,
        client_pubkey: [u8; 32],
        shared_secret: [u8; 32],
        client_ip: Option<SocketAddr>,
    ) -> Self {
        let now = Instant::now();
        Self {
            slot_index,
            session_id,
            client_pubkey,
            shared_secret,
            state: SessionState::Pairing,
            connected_at: now,
            last_seen: now,
            client_ip,
            battery_level: None,
            is_charging: None,
            rtt_ms: 0,
            packets_received: 0,
        }
    }

    /// Color hex code for UI display.
    pub fn color_hex(&self) -> &'static str {
        match self.slot_index {
            0 => "#00E5FF", // P1 Neon Cyan
            1 => "#FF007F", // P2 Neon Magenta
            2 => "#FFE600", // P3 Neon Yellow
            3 => "#00FF66", // P4 Neon Green
            _ => "#00E5FF",
        }
    }

    /// Color RGB565 code for protocol message.
    pub fn color_rgb565(&self) -> u16 {
        match self.slot_index {
            0 => 0x073F,
            1 => 0xF80F,
            2 => 0xFFE0,
            3 => 0x07EC,
            _ => 0x073F,
        }
    }

    /// Human readable slot label (e.g. "Player 1 (P1)").
    pub fn label(&self) -> String {
        format!("Player {}", self.slot_index + 1)
    }
}

/// JSON-serializable snapshot of active peer slot state for Tray & Status API.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PeerSlotSummary {
    /// Slot index (0..3).
    pub slot_index: u8,
    /// Player label ("Player 1", etc.).
    pub player_label: String,
    /// Session ID string.
    pub session_id: String,
    /// Color hex code.
    pub color_hex: String,
    /// Current connection state.
    pub state: SessionState,
    /// Remote client IP string.
    pub client_ip: Option<String>,
    /// Battery level percentage (0..100).
    pub battery_level: Option<u8>,
    /// Charging state.
    pub is_charging: Option<bool>,
    /// Round-trip latency in ms.
    pub rtt_ms: u32,
    /// Total received packets count.
    pub packets_received: u64,
    /// Uptime in seconds.
    pub uptime_secs: u64,
}

/// Multi-peer session manager maintaining fixed capacity of 4 player slots.
#[derive(Debug)]
pub struct MultiPeerSessionManager {
    slots: [Option<PeerSlot>; MAX_PEERS],
}

impl Default for MultiPeerSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl MultiPeerSessionManager {
    /// Creates an empty multi-peer session manager.
    pub fn new() -> Self {
        Self {
            slots: [None, None, None, None],
        }
    }

    /// Allocates the lowest available slot index for a newly pairing peer.
    /// Automatically reclaims abandoned or timed-out pairing slots.
    pub fn allocate_slot(
        &mut self,
        client_pubkey: [u8; 32],
        shared_secret: [u8; 32],
        client_ip: Option<SocketAddr>,
    ) -> Result<(u8, String), MultiPeerError> {
        // 1. If this exact client_pubkey is already registered in a slot, reuse it
        if let Some(existing_idx) = self.slots.iter().position(|s| {
            s.as_ref().map(|slot| slot.client_pubkey == client_pubkey).unwrap_or(false)
        }) {
            let session_id = format!("{:016x}", rand::random::<u64>());
            let slot = PeerSlot::new(
                existing_idx as u8,
                session_id.clone(),
                client_pubkey,
                shared_secret,
                client_ip,
            );
            self.slots[existing_idx] = Some(slot);
            return Ok((existing_idx as u8, session_id));
        }

        // 2. Clean up any stale slots (Pairing state older than 10s, or inactive for > 30s)
        for s in self.slots.iter_mut() {
            if let Some(slot) = s {
                if slot.state == SessionState::Pairing && slot.connected_at.elapsed().as_secs() > 10 {
                    *s = None;
                } else if slot.last_seen.elapsed().as_secs() > 30 {
                    *s = None;
                }
            }
        }

        // 3. Find first empty slot (0..3)
        let free_slot_idx = self
            .slots
            .iter()
            .position(|s| s.is_none())
            .ok_or(MultiPeerError::MaxCapacityReached(MAX_PEERS))? as u8;

        let session_id = format!("{:016x}", rand::random::<u64>());
        let slot = PeerSlot::new(
            free_slot_idx,
            session_id.clone(),
            client_pubkey,
            shared_secret,
            client_ip,
        );

        self.slots[free_slot_idx as usize] = Some(slot);
        Ok((free_slot_idx, session_id))
    }

    /// Resets all 4 player slots immediately.
    pub fn reset_all(&mut self) {
        self.slots = [None, None, None, None];
    }

    /// Finds a slot by session ID.
    pub fn find_slot_by_session_id(&self, session_id: &str) -> Option<&PeerSlot> {
        self.slots
            .iter()
            .filter_map(|s| s.as_ref())
            .find(|s| s.session_id == session_id)
    }

    /// Finds a mutable slot by session ID.
    pub fn find_slot_by_session_id_mut(&mut self, session_id: &str) -> Option<&mut PeerSlot> {
        self.slots
            .iter_mut()
            .filter_map(|s| s.as_mut())
            .find(|s| s.session_id == session_id)
    }

    /// Finds a slot by player index (0..3).
    pub fn find_slot(&self, slot_index: u8) -> Option<&PeerSlot> {
        if (slot_index as usize) < MAX_PEERS {
            self.slots[slot_index as usize].as_ref()
        } else {
            None
        }
    }

    /// Finds a mutable slot by player index (0..3).
    pub fn find_slot_mut(&mut self, slot_index: u8) -> Option<&mut PeerSlot> {
        if (slot_index as usize) < MAX_PEERS {
            self.slots[slot_index as usize].as_mut()
        } else {
            None
        }
    }

    /// Updates connection state for a specific slot.
    pub fn set_slot_state(&mut self, slot_index: u8, state: SessionState) {
        if let Some(slot) = self.find_slot_mut(slot_index) {
            slot.state = state;
        }
    }

    /// Updates battery telemetry and measured RTT for a slot.
    pub fn update_telemetry(
        &mut self,
        slot_index: u8,
        rtt_ms: u32,
        battery_level: Option<u8>,
        is_charging: Option<bool>,
    ) {
        if let Some(slot) = self.find_slot_mut(slot_index) {
            slot.rtt_ms = rtt_ms;
            slot.last_seen = Instant::now();
            if battery_level.is_some() {
                slot.battery_level = battery_level;
            }
            if is_charging.is_some() {
                slot.is_charging = is_charging;
            }
        }
    }

    /// Records packet arrival and feeds slot heartbeat.
    pub fn feed_slot_packet(&mut self, slot_index: u8) {
        if let Some(slot) = self.find_slot_mut(slot_index) {
            slot.packets_received = slot.packets_received.saturating_add(1);
            slot.last_seen = Instant::now();
        }
    }

    /// Frees a player slot by slot index (e.g. on disconnect or kick).
    pub fn free_slot(&mut self, slot_index: u8) -> Option<PeerSlot> {
        if (slot_index as usize) < MAX_PEERS {
            self.slots[slot_index as usize].take()
        } else {
            None
        }
    }

    /// Frees a slot by session ID.
    pub fn free_session(&mut self, session_id: &str) -> Option<PeerSlot> {
        let idx = self
            .slots
            .iter()
            .position(|s| s.as_ref().map(|slot| slot.session_id == session_id).unwrap_or(false))?;
        self.slots[idx].take()
    }

    /// Returns count of actively occupied slots.
    pub fn active_count(&self) -> usize {
        self.slots.iter().filter(|s| s.is_some()).count()
    }

    /// Returns whether all 4 player slots are occupied.
    pub fn is_full(&self) -> bool {
        self.active_count() >= MAX_PEERS
    }

    /// Returns summaries of all currently active peer slots.
    pub fn summaries(&self) -> Vec<PeerSlotSummary> {
        self.slots
            .iter()
            .filter_map(|s| s.as_ref())
            .map(|s| PeerSlotSummary {
                slot_index: s.slot_index,
                player_label: s.label(),
                session_id: s.session_id.clone(),
                color_hex: s.color_hex().to_string(),
                state: s.state,
                client_ip: s.client_ip.map(|ip| ip.to_string()),
                battery_level: s.battery_level,
                is_charging: s.is_charging,
                rtt_ms: s.rtt_ms,
                packets_received: s.packets_received,
                uptime_secs: s.connected_at.elapsed().as_secs(),
            })
            .collect()
    }
}
