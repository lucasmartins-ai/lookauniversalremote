//! Protocol base header implementation (5 bytes).

use crate::messages::MessageType;
use crate::ProtocolError;

/// Current supported protocol version.
pub const PROTOCOL_VERSION: u8 = 0x01;

/// Fixed size of the base header in bytes.
pub const HEADER_SIZE: usize = 5;

/// Header flags bitmask.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct HeaderFlags(pub u8);

impl HeaderFlags {
    /// Flag bit indicating receiver must acknowledge frame.
    pub const NEEDS_ACK: u8 = 0x01;
    /// Flag bit indicating an emergency or state reset.
    pub const EMERGENCY_RESET: u8 = 0x02;

    /// Create an empty flags bitmask (all zero).
    #[inline(always)]
    pub const fn empty() -> Self {
        Self(0)
    }

    /// Create flags directly from a raw bitfield byte.
    #[inline(always)]
    pub const fn from_bits_truncate(bits: u8) -> Self {
        Self(bits)
    }

    /// Get underlying bitmask byte.
    #[inline(always)]
    pub const fn bits(&self) -> u8 {
        self.0
    }

    /// Check if a specific flag is set.
    #[inline(always)]
    pub const fn contains(&self, flag: u8) -> bool {
        (self.0 & flag) == flag
    }

    /// Set or unset a specific flag bit.
    #[inline(always)]
    pub fn set(&mut self, flag: u8, value: bool) {
        if value {
            self.0 |= flag;
        } else {
            self.0 &= !flag;
        }
    }
}

/// Base Header present at the beginning of every protocol frame (5 bytes).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Header {
    /// Protocol version (must be `PROTOCOL_VERSION` = 0x01).
    pub version: u8,
    /// Message type identifier.
    pub msg_type: MessageType,
    /// Header flags.
    pub flags: HeaderFlags,
    /// Monotonically increasing sequence number (16-bit LE, wraps at 65535).
    pub sequence: u16,
}

impl Header {
    /// Create a new header with default protocol version.
    #[inline(always)]
    pub const fn new(msg_type: MessageType, flags: HeaderFlags, sequence: u16) -> Self {
        Self {
            version: PROTOCOL_VERSION,
            msg_type,
            flags,
            sequence,
        }
    }

    /// Decode header directly from a 5-byte slice.
    #[inline(always)]
    pub fn decode(bytes: &[u8]) -> Result<Self, ProtocolError> {
        if bytes.len() < HEADER_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: HEADER_SIZE,
                actual: bytes.len(),
            });
        }

        let version = bytes[0];
        if version != PROTOCOL_VERSION {
            return Err(ProtocolError::InvalidVersion(version));
        }

        let msg_type = MessageType::from_u8(bytes[1])
            .ok_or(ProtocolError::UnknownMessageType(bytes[1]))?;

        let flags = HeaderFlags(bytes[2]);
        let sequence = u16::from_le_bytes([bytes[3], bytes[4]]);

        Ok(Self {
            version,
            msg_type,
            flags,
            sequence,
        })
    }

    /// Encode header into a fixed 5-byte array.
    #[inline(always)]
    pub fn encode(&self) -> [u8; HEADER_SIZE] {
        let seq_bytes = self.sequence.to_le_bytes();
        [
            self.version,
            self.msg_type.as_u8(),
            self.flags.bits(),
            seq_bytes[0],
            seq_bytes[1],
        ]
    }

    /// Write encoded header directly into a mutable byte slice at offset 0.
    #[inline(always)]
    pub fn write_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < HEADER_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: HEADER_SIZE,
                actual: dest.len(),
            });
        }
        dest[..HEADER_SIZE].copy_from_slice(&self.encode());
        Ok(())
    }
}
