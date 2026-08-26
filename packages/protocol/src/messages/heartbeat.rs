//! MSG_HEARTBEAT (0x08) — Keepalive & latency echo probe (8 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_HEARTBEAT in bytes.
pub const HEARTBEAT_PAYLOAD_SIZE: usize = 8;
/// Total frame size for MSG_HEARTBEAT in bytes (Header + Payload).
pub const HEARTBEAT_TOTAL_SIZE: usize = HEADER_SIZE + HEARTBEAT_PAYLOAD_SIZE;

/// MSG_HEARTBEAT payload (0x08) — 8 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct HeartbeatMessage {
    /// Client millisecond epoch clock timestamp.
    pub client_epoch_ms: u32,
    /// Arbitrary token echoed back in response for RTT measurement.
    pub echo_token: u32,
}

impl HeartbeatMessage {
    /// Decode payload from slice of at least 8 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < HEARTBEAT_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: HEARTBEAT_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        let client_epoch_ms = u32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]]);
        let echo_token = u32::from_le_bytes([payload[4], payload[5], payload[6], payload[7]]);

        Ok(Self {
            client_epoch_ms,
            echo_token,
        })
    }

    /// Encode payload into a fixed 8-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; HEARTBEAT_PAYLOAD_SIZE] {
        let epoch = self.client_epoch_ms.to_le_bytes();
        let token = self.echo_token.to_le_bytes();

        [
            epoch[0], epoch[1], epoch[2], epoch[3],
            token[0], token[1], token[2], token[3],
        ]
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < HEARTBEAT_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: HEARTBEAT_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..HEARTBEAT_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
