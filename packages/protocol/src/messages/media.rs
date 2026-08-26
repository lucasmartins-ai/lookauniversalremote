//! MSG_MEDIA (0x06) — Consumer media actions (2 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_MEDIA in bytes.
pub const MEDIA_PAYLOAD_SIZE: usize = 2;
/// Total frame size for MSG_MEDIA in bytes (Header + Payload).
pub const MEDIA_TOTAL_SIZE: usize = HEADER_SIZE + MEDIA_PAYLOAD_SIZE;

/// Consumer media action codes.
pub mod actions {
    /// Play/Pause toggle (1).
    pub const PLAY_PAUSE: u8 = 1;
    /// Stop playback (2).
    pub const STOP: u8 = 2;
    /// Next track (3).
    pub const NEXT: u8 = 3;
    /// Previous track (4).
    pub const PREV: u8 = 4;
    /// Volume up step (5).
    pub const VOL_UP: u8 = 5;
    /// Volume down step (6).
    pub const VOL_DOWN: u8 = 6;
    /// Mute toggle (7).
    pub const MUTE: u8 = 7;
}

/// MSG_MEDIA payload (0x06) — 2 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct MediaMessage {
    /// Consumer media action code.
    pub media_action: u8,
    /// Alignment padding byte (0x00).
    pub reserved: u8,
}

impl MediaMessage {
    /// Decode payload from slice of at least 2 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < MEDIA_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: MEDIA_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        Ok(Self {
            media_action: payload[0],
            reserved: payload[1],
        })
    }

    /// Encode payload into a fixed 2-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; MEDIA_PAYLOAD_SIZE] {
        [self.media_action, self.reserved]
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < MEDIA_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: MEDIA_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..MEDIA_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
