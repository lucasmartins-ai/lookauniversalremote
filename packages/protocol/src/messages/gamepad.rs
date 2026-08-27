//! MSG_GAMEPAD_FULL (0x02) — Complete gamepad state snapshot (14 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_GAMEPAD_FULL in bytes.
pub const GAMEPAD_FULL_PAYLOAD_SIZE: usize = 14;
/// Total frame size for MSG_GAMEPAD_FULL in bytes (Header + Payload).
pub const GAMEPAD_FULL_TOTAL_SIZE: usize = HEADER_SIZE + GAMEPAD_FULL_PAYLOAD_SIZE;

/// Standard Gamepad button bitmask constants (`u16`).
pub mod buttons {
    /// D-pad Up button (Bit 0).
    pub const DPAD_UP: u16 = 1 << 0; // 0x0001
    /// D-pad Down button (Bit 1).
    pub const DPAD_DOWN: u16 = 1 << 1; // 0x0002
    /// D-pad Left button (Bit 2).
    pub const DPAD_LEFT: u16 = 1 << 2; // 0x0004
    /// D-pad Right button (Bit 3).
    pub const DPAD_RIGHT: u16 = 1 << 3; // 0x0008
    /// Primary Action / South button (A on Xbox, Cross on PlayStation) (Bit 4).
    pub const BTN_SOUTH: u16 = 1 << 4; // 0x0010 (A)
    /// Secondary Action / East button (B on Xbox, Circle on PlayStation) (Bit 5).
    pub const BTN_EAST: u16 = 1 << 5; // 0x0020 (B)
    /// Tertiary Action / West button (X on Xbox, Square on PlayStation) (Bit 6).
    pub const BTN_WEST: u16 = 1 << 6; // 0x0040 (X)
    /// Quaternary Action / North button (Y on Xbox, Triangle on PlayStation) (Bit 7).
    pub const BTN_NORTH: u16 = 1 << 7; // 0x0080 (Y)
    /// Left Bumper / Shoulder button (Bit 8).
    pub const BTN_L1: u16 = 1 << 8; // 0x0100 (Left Bumper)
    /// Right Bumper / Shoulder button (Bit 9).
    pub const BTN_R1: u16 = 1 << 9; // 0x0200 (Right Bumper)
    /// Left Stick Click button (Bit 10).
    pub const BTN_L3: u16 = 1 << 10; // 0x0400 (Left Stick Click)
    /// Right Stick Click button (Bit 11).
    pub const BTN_R3: u16 = 1 << 11; // 0x0800 (Right Stick Click)
    /// Start / Options button (Bit 12).
    pub const BTN_START: u16 = 1 << 12; // 0x1000
    /// Select / Back / Share button (Bit 13).
    pub const BTN_SELECT: u16 = 1 << 13; // 0x2000
    /// Guide / Home / PS button (Bit 14).
    pub const BTN_GUIDE: u16 = 1 << 14; // 0x4000 (Home)
    /// Reserved button bit (Bit 15).
    pub const RESERVED: u16 = 1 << 15; // 0x8000
}

/// MSG_GAMEPAD_FULL payload (0x02) — 14 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct GamepadFullMessage {
    /// Button bitfield (16 buttons).
    pub buttons: u16,
    /// Left Stick X (-32768 to 32767).
    pub stick_lx: i16,
    /// Left Stick Y (-32768 to 32767).
    pub stick_ly: i16,
    /// Right Stick X (-32768 to 32767).
    pub stick_rx: i16,
    /// Right Stick Y (-32768 to 32767).
    pub stick_ry: i16,
    /// Left Trigger (0 to 255).
    pub trigger_l: u8,
    /// Right Trigger (0 to 255).
    pub trigger_r: u8,
    /// Player slot index (0 = P1, 1 = P2, 2 = P3, 3 = P4).
    pub player_index: u8,
    /// Reserved alignment byte (0x00).
    pub reserved: u8,
}

impl GamepadFullMessage {
    /// Check if a specific button is pressed.
    #[inline(always)]
    pub const fn is_button_pressed(&self, mask: u16) -> bool {
        (self.buttons & mask) == mask
    }

    /// Decode payload from slice of at least 14 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < GAMEPAD_FULL_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: GAMEPAD_FULL_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        let buttons = u16::from_le_bytes([payload[0], payload[1]]);
        let stick_lx = i16::from_le_bytes([payload[2], payload[3]]);
        let stick_ly = i16::from_le_bytes([payload[4], payload[5]]);
        let stick_rx = i16::from_le_bytes([payload[6], payload[7]]);
        let stick_ry = i16::from_le_bytes([payload[8], payload[9]]);
        let trigger_l = payload[10];
        let trigger_r = payload[11];
        let player_index = payload[12];
        let reserved = payload[13];

        Ok(Self {
            buttons,
            stick_lx,
            stick_ly,
            stick_rx,
            stick_ry,
            trigger_l,
            trigger_r,
            player_index,
            reserved,
        })
    }

    /// Encode payload into a fixed 14-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; GAMEPAD_FULL_PAYLOAD_SIZE] {
        let btn = self.buttons.to_le_bytes();
        let lx = self.stick_lx.to_le_bytes();
        let ly = self.stick_ly.to_le_bytes();
        let rx = self.stick_rx.to_le_bytes();
        let ry = self.stick_ry.to_le_bytes();

        [
            btn[0],
            btn[1],
            lx[0],
            lx[1],
            ly[0],
            ly[1],
            rx[0],
            rx[1],
            ry[0],
            ry[1],
            self.trigger_l,
            self.trigger_r,
            self.player_index,
            self.reserved,
        ]
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < GAMEPAD_FULL_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: GAMEPAD_FULL_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..GAMEPAD_FULL_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
