//! MSG_TV_TEXT_INPUT (0x0D) — Smart TV Text Input & Search String (32 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_TV_TEXT_INPUT in bytes (1 byte len + 31 bytes UTF-8 text buffer).
pub const TV_TEXT_PAYLOAD_SIZE: usize = 32;
/// Maximum text characters in a single TV text frame (31 bytes).
pub const TV_TEXT_MAX_LEN: usize = 31;
/// Total frame size for MSG_TV_TEXT_INPUT in bytes (Header + Payload).
pub const TV_TEXT_TOTAL_SIZE: usize = HEADER_SIZE + TV_TEXT_PAYLOAD_SIZE;

/// MSG_TV_TEXT_INPUT payload (0x0D) — 32 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TvTextInputMessage {
    /// Text length in bytes (0..31).
    pub length: u8,
    /// UTF-8 encoded text buffer (31 bytes, zero-padded).
    pub text_buffer: [u8; TV_TEXT_MAX_LEN],
}

impl Default for TvTextInputMessage {
    fn default() -> Self {
        Self {
            length: 0,
            text_buffer: [0u8; TV_TEXT_MAX_LEN],
        }
    }
}

impl TvTextInputMessage {
    /// Create a new TV text input message from a string slice.
    pub fn from_str_truncate(text: &str) -> Self {
        let bytes = text.as_bytes();
        let len = bytes.len().min(TV_TEXT_MAX_LEN);
        let mut text_buffer = [0u8; TV_TEXT_MAX_LEN];
        text_buffer[..len].copy_from_slice(&bytes[..len]);
        Self {
            length: len as u8,
            text_buffer,
        }
    }

    /// Return text slice as a UTF-8 `&str`.
    #[inline(always)]
    pub fn as_str(&self) -> &str {
        let len = (self.length as usize).min(TV_TEXT_MAX_LEN);
        core::str::from_utf8(&self.text_buffer[..len]).unwrap_or("")
    }

    /// Decode payload from slice of at least 32 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < TV_TEXT_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: TV_TEXT_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        let length = payload[0].min(TV_TEXT_MAX_LEN as u8);
        let mut text_buffer = [0u8; TV_TEXT_MAX_LEN];
        text_buffer.copy_from_slice(&payload[1..TV_TEXT_PAYLOAD_SIZE]);

        Ok(Self {
            length,
            text_buffer,
        })
    }

    /// Encode payload into a fixed 32-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; TV_TEXT_PAYLOAD_SIZE] {
        let mut dest = [0u8; TV_TEXT_PAYLOAD_SIZE];
        dest[0] = self.length;
        dest[1..TV_TEXT_PAYLOAD_SIZE].copy_from_slice(&self.text_buffer);
        dest
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < TV_TEXT_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: TV_TEXT_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..TV_TEXT_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
