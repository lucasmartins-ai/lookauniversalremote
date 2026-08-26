//! MSG_TOUCHPAD (0x04) — Trackpad relative movement and buttons (7 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_TOUCHPAD in bytes.
pub const TOUCHPAD_PAYLOAD_SIZE: usize = 7;
/// Total frame size for MSG_TOUCHPAD in bytes (Header + Payload).
pub const TOUCHPAD_TOTAL_SIZE: usize = HEADER_SIZE + TOUCHPAD_PAYLOAD_SIZE;

/// Touchpad mouse button bitmask constants (`u8`).
pub mod buttons {
    /// Left mouse button (Bit 0).
    pub const BTN_LEFT: u8 = 1 << 0;   // 0x01
    /// Right mouse button (Bit 1).
    pub const BTN_RIGHT: u8 = 1 << 1;  // 0x02
    /// Middle mouse button (Bit 2).
    pub const BTN_MIDDLE: u8 = 1 << 2; // 0x04
    /// Tap-to-click gesture action (Bit 3).
    pub const TAP_CLICK: u8 = 1 << 3;  // 0x08
}

/// MSG_TOUCHPAD payload (0x04) — 7 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct TouchpadMessage {
    /// Relative horizontal cursor delta in pixels.
    pub dx: i16,
    /// Relative vertical cursor delta in pixels.
    pub dy: i16,
    /// Vertical scroll wheel delta (-128 to 127).
    pub scroll_v: i8,
    /// Horizontal scroll wheel delta (-128 to 127).
    pub scroll_h: i8,
    /// Buttons bitmask (Left, Right, Middle, Tap).
    pub buttons_mask: u8,
}

impl TouchpadMessage {
    /// Check if left mouse button is pressed.
    #[inline(always)]
    pub const fn is_left_pressed(&self) -> bool {
        (self.buttons_mask & buttons::BTN_LEFT) != 0
    }

    /// Check if right mouse button is pressed.
    #[inline(always)]
    pub const fn is_right_pressed(&self) -> bool {
        (self.buttons_mask & buttons::BTN_RIGHT) != 0
    }

    /// Check if middle mouse button is pressed.
    #[inline(always)]
    pub const fn is_middle_pressed(&self) -> bool {
        (self.buttons_mask & buttons::BTN_MIDDLE) != 0
    }

    /// Check if tap-to-click is active.
    #[inline(always)]
    pub const fn is_tap_click(&self) -> bool {
        (self.buttons_mask & buttons::TAP_CLICK) != 0
    }

    /// Decode payload from slice of at least 7 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < TOUCHPAD_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: TOUCHPAD_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        let dx = i16::from_le_bytes([payload[0], payload[1]]);
        let dy = i16::from_le_bytes([payload[2], payload[3]]);
        let scroll_v = payload[4] as i8;
        let scroll_h = payload[5] as i8;
        let buttons_mask = payload[6];

        Ok(Self {
            dx,
            dy,
            scroll_v,
            scroll_h,
            buttons_mask,
        })
    }

    /// Encode payload into a fixed 7-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; TOUCHPAD_PAYLOAD_SIZE] {
        let dx_b = self.dx.to_le_bytes();
        let dy_b = self.dy.to_le_bytes();

        [
            dx_b[0],
            dx_b[1],
            dy_b[0],
            dy_b[1],
            self.scroll_v as u8,
            self.scroll_h as u8,
            self.buttons_mask,
        ]
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < TOUCHPAD_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: TOUCHPAD_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..TOUCHPAD_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
