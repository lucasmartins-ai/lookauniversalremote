//! MSG_SLOT_ASSIGNMENT (0x0B) — Host-to-Client slot assignment & player info (20 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_SLOT_ASSIGNMENT in bytes.
pub const SLOT_ASSIGNMENT_PAYLOAD_SIZE: usize = 20;
/// Total frame size for MSG_SLOT_ASSIGNMENT in bytes (Header + Payload).
pub const SLOT_ASSIGNMENT_TOTAL_SIZE: usize = HEADER_SIZE + SLOT_ASSIGNMENT_PAYLOAD_SIZE;

/// Default player colors in RGB565 format (LE).
pub mod player_colors {
    /// Player 1: Neon Cyan (#00E5FF) -> RGB565: 0x073F / 0x07FF
    pub const P1_CYAN: u16 = 0x073F;
    /// Player 2: Neon Magenta / Pink (#FF007F) -> RGB565: 0xF80F
    pub const P2_MAGENTA: u16 = 0xF80F;
    /// Player 3: Neon Yellow (#FFE600) -> RGB565: 0xFFE0
    pub const P3_YELLOW: u16 = 0xFFE0;
    /// Player 4: Neon Green (#00FF66) -> RGB565: 0x07EC
    pub const P4_GREEN: u16 = 0x07EC;

    /// Return standard RGB565 color for given player index (0..3).
    #[inline(always)]
    pub const fn for_player_index(index: u8) -> u16 {
        match index {
            0 => P1_CYAN,
            1 => P2_MAGENTA,
            2 => P3_YELLOW,
            3 => P4_GREEN,
            _ => P1_CYAN,
        }
    }
}

/// MSG_SLOT_ASSIGNMENT payload (0x0B) — 20 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SlotAssignmentMessage {
    /// Allocated player index (0 = P1, 1 = P2, 2 = P3, 3 = P4).
    pub player_index: u8,
    /// Player accent color in RGB565 format (16-bit LE).
    pub player_color_rgb565: u16,
    /// Current battery telemetry level (0..100%, or 255 if unknown).
    pub battery_level: u8,
    /// Host name in UTF-8 bytes (16 bytes, null-padded).
    pub host_name: [u8; 16],
}

impl Default for SlotAssignmentMessage {
    fn default() -> Self {
        let mut host_name = [0u8; 16];
        let name_bytes = b"LookARemote Host";
        let len = name_bytes.len().min(16);
        host_name[..len].copy_from_slice(&name_bytes[..len]);

        Self {
            player_index: 0,
            player_color_rgb565: player_colors::P1_CYAN,
            battery_level: 255,
            host_name,
        }
    }
}

impl SlotAssignmentMessage {
    /// Create a new SlotAssignmentMessage for a player slot with host name.
    pub fn new(player_index: u8, host_name_str: &str) -> Self {
        let mut host_name = [0u8; 16];
        let name_bytes = host_name_str.as_bytes();
        let len = name_bytes.len().min(16);
        host_name[..len].copy_from_slice(&name_bytes[..len]);

        Self {
            player_index: player_index.min(3),
            player_color_rgb565: player_colors::for_player_index(player_index),
            battery_level: 255,
            host_name,
        }
    }

    /// Set battery level (0..100, or 255 for unknown).
    pub fn with_battery(mut self, battery_level: u8) -> Self {
        self.battery_level = battery_level;
        self
    }

    /// Return host name as a valid UTF-8 string slice without trailing null bytes.
    pub fn host_name_str(&self) -> &str {
        let len = self.host_name.iter().position(|&b| b == 0).unwrap_or(16);
        core::str::from_utf8(&self.host_name[..len]).unwrap_or("LookARemote Host")
    }

    /// Decode payload from slice of at least 20 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < SLOT_ASSIGNMENT_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: SLOT_ASSIGNMENT_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        let player_index = payload[0];
        let player_color_rgb565 = u16::from_le_bytes([payload[1], payload[2]]);
        let battery_level = payload[3];

        let mut host_name = [0u8; 16];
        host_name.copy_from_slice(&payload[4..20]);

        Ok(Self {
            player_index,
            player_color_rgb565,
            battery_level,
            host_name,
        })
    }

    /// Encode payload into a fixed 20-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; SLOT_ASSIGNMENT_PAYLOAD_SIZE] {
        let color = self.player_color_rgb565.to_le_bytes();
        let mut dest = [0u8; SLOT_ASSIGNMENT_PAYLOAD_SIZE];

        dest[0] = self.player_index;
        dest[1] = color[0];
        dest[2] = color[1];
        dest[3] = self.battery_level;
        dest[4..20].copy_from_slice(&self.host_name);

        dest
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < SLOT_ASSIGNMENT_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: SLOT_ASSIGNMENT_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..SLOT_ASSIGNMENT_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
