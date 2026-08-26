//! MSG_KEYBOARD (0x05) — Key press / release / repeat events (4 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_KEYBOARD in bytes.
pub const KEYBOARD_PAYLOAD_SIZE: usize = 4;
/// Total frame size for MSG_KEYBOARD in bytes (Header + Payload).
pub const KEYBOARD_TOTAL_SIZE: usize = HEADER_SIZE + KEYBOARD_PAYLOAD_SIZE;

/// Key press state constants.
pub mod key_state {
    /// Key released / up state (0).
    pub const KEY_UP: u8 = 0;
    /// Key pressed / down state (1).
    pub const KEY_DOWN: u8 = 1;
    /// Key auto-repeat state (2).
    pub const KEY_REPEAT: u8 = 2;
}

/// Keyboard modifier bitmask constants (`u8`).
pub mod modifiers {
    /// Control key modifier (Bit 0).
    pub const CTRL: u8 = 1 << 0;  // 0x01
    /// Shift key modifier (Bit 1).
    pub const SHIFT: u8 = 1 << 1; // 0x02
    /// Alt / Option key modifier (Bit 2).
    pub const ALT: u8 = 1 << 2;   // 0x04
    /// Meta / Command / Super / Windows key modifier (Bit 3).
    pub const META: u8 = 1 << 3;  // 0x08 (Super/Command/Windows)
}

/// MSG_KEYBOARD payload (0x05) — 4 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct KeyboardMessage {
    /// Standard USB HID Usage ID or mapped scan code.
    pub key_code: u16,
    /// Key state: 0 = Key Up, 1 = Key Down, 2 = Key Repeat.
    pub state: u8,
    /// Active modifiers bitfield.
    pub modifiers: u8,
}

impl KeyboardMessage {
    /// Check if Ctrl modifier is active.
    #[inline(always)]
    pub const fn has_ctrl(&self) -> bool {
        (self.modifiers & modifiers::CTRL) != 0
    }

    /// Check if Shift modifier is active.
    #[inline(always)]
    pub const fn has_shift(&self) -> bool {
        (self.modifiers & modifiers::SHIFT) != 0
    }

    /// Check if Alt modifier is active.
    #[inline(always)]
    pub const fn has_alt(&self) -> bool {
        (self.modifiers & modifiers::ALT) != 0
    }

    /// Check if Meta/Super modifier is active.
    #[inline(always)]
    pub const fn has_meta(&self) -> bool {
        (self.modifiers & modifiers::META) != 0
    }

    /// Decode payload from slice of at least 4 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < KEYBOARD_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: KEYBOARD_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        let key_code = u16::from_le_bytes([payload[0], payload[1]]);
        let state = payload[2];
        let modifiers = payload[3];

        Ok(Self {
            key_code,
            state,
            modifiers,
        })
    }

    /// Encode payload into a fixed 4-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; KEYBOARD_PAYLOAD_SIZE] {
        let code = self.key_code.to_le_bytes();
        [code[0], code[1], self.state, self.modifiers]
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < KEYBOARD_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: KEYBOARD_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..KEYBOARD_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
