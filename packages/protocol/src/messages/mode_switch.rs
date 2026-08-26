//! MSG_MODE_SWITCH (0x07) — Client/Host Mode Switching and Smart Context Sync (2 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_MODE_SWITCH in bytes.
pub const MODE_SWITCH_PAYLOAD_SIZE: usize = 2;
/// Total frame size for MSG_MODE_SWITCH in bytes (Header + Payload).
pub const MODE_SWITCH_TOTAL_SIZE: usize = HEADER_SIZE + MODE_SWITCH_PAYLOAD_SIZE;

/// Target control mode identifiers.
pub mod modes {
    /// Gamepad virtual controller layout (0).
    pub const GAMEPAD: u8 = 0;
    /// Multi-touch ballistic trackpad layout (1).
    pub const TRACKPAD: u8 = 1;
    /// Full virtual keyboard and macros layout (2).
    pub const KEYBOARD: u8 = 2;
    /// Dedicated consumer media remote deck layout (3).
    pub const MEDIA_REMOTE: u8 = 3;
}

/// Mode switch flags bitmask.
pub mod flags {
    /// No flags set.
    pub const NONE: u8 = 0x00;
    /// Flag indicating that the mode switch is a manual user override from the client (Bit 0).
    pub const IS_MANUAL_OVERRIDE: u8 = 0x01;
    /// Flag indicating that the mode switch is strictly enforced by the host daemon (Bit 1).
    pub const IS_ENFORCED_BY_HOST: u8 = 0x02;
}

/// MSG_MODE_SWITCH payload (0x07) — 2 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct ModeSwitchMessage {
    /// Target control mode (0: Gamepad, 1: Trackpad, 2: Keyboard, 3: MediaRemote).
    pub target_mode: u8,
    /// Mode switch flags (Bit 0: IsManualOverride, Bit 1: IsEnforcedByHost).
    pub flags: u8,
}

impl ModeSwitchMessage {
    /// Create a new ModeSwitchMessage.
    #[inline(always)]
    pub const fn new(target_mode: u8, flags: u8) -> Self {
        Self { target_mode, flags }
    }

    /// Checks whether the manual override flag is set.
    #[inline(always)]
    pub const fn is_manual_override(&self) -> bool {
        (self.flags & flags::IS_MANUAL_OVERRIDE) != 0
    }

    /// Checks whether the host enforcement flag is set.
    #[inline(always)]
    pub const fn is_enforced_by_host(&self) -> bool {
        (self.flags & flags::IS_ENFORCED_BY_HOST) != 0
    }

    /// Decode payload from slice of at least 2 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < MODE_SWITCH_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: MODE_SWITCH_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        Ok(Self {
            target_mode: payload[0],
            flags: payload[1],
        })
    }

    /// Encode payload into a fixed 2-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; MODE_SWITCH_PAYLOAD_SIZE] {
        [self.target_mode, self.flags]
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < MODE_SWITCH_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: MODE_SWITCH_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..MODE_SWITCH_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
