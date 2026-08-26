//! MSG_HAPTIC_EVENT (0x0A) — Host-to-Client haptic rumble trigger (4 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_HAPTIC_EVENT in bytes.
pub const HAPTIC_PAYLOAD_SIZE: usize = 4;
/// Total frame size for MSG_HAPTIC_EVENT in bytes (Header + Payload).
pub const HAPTIC_TOTAL_SIZE: usize = HEADER_SIZE + HAPTIC_PAYLOAD_SIZE;

/// Haptic motor selection constants.
pub mod motors {
    /// Low frequency / heavy motor (0).
    pub const MOTOR_LEFT: u8 = 0;
    /// High frequency / light motor (1).
    pub const MOTOR_RIGHT: u8 = 1;
    /// Both motors simultaneously (2).
    pub const MOTOR_BOTH: u8 = 2;
}

/// MSG_HAPTIC_EVENT payload (0x0A) — 4 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct HapticEventMessage {
    /// Motor index (0: Left, 1: Right, 2: Both).
    pub motor_index: u8,
    /// Vibration intensity (0 to 255).
    pub intensity: u8,
    /// Duration of the vibration in milliseconds.
    pub duration_ms: u16,
}

impl HapticEventMessage {
    /// Decode payload from slice of at least 4 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < HAPTIC_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: HAPTIC_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        let motor_index = payload[0];
        let intensity = payload[1];
        let duration_ms = u16::from_le_bytes([payload[2], payload[3]]);

        Ok(Self {
            motor_index,
            intensity,
            duration_ms,
        })
    }

    /// Encode payload into a fixed 4-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; HAPTIC_PAYLOAD_SIZE] {
        let dur = self.duration_ms.to_le_bytes();
        [self.motor_index, self.intensity, dur[0], dur[1]]
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < HAPTIC_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: HAPTIC_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..HAPTIC_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
