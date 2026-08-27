//! LookARemote Binary Protocol v1 Codec.
//!
//! A zero-allocation, high-throughput binary serialization and deserialization library
//! designed for ultra-low latency mobile-to-host controller input streaming.

#![deny(missing_docs)]
#![deny(rust_2018_idioms)]

pub mod decoder;
pub mod encoder;
pub mod header;
pub mod messages;
pub mod sequence;

pub use decoder::{decode_packet, Packet, Payload};
pub use encoder::{encode_packet, encode_packet_to_slice, PacketBuffer, MAX_PACKET_SIZE};
pub use header::{Header, HeaderFlags, HEADER_SIZE, PROTOCOL_VERSION};
pub use messages::*;
pub use sequence::{is_valid_sequence_advance, SequenceFilter, SequenceGenerator, SequenceTracker};

use core::fmt;

/// Protocol parsing and validation errors.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProtocolError {
    /// Provided slice is shorter than the required minimum length.
    BufferTooShort {
        /// Expected minimum byte length.
        expected: usize,
        /// Actual slice byte length.
        actual: usize,
    },
    /// Protocol version byte does not match expected version (0x01).
    InvalidVersion(u8),
    /// Message type identifier byte is not recognized.
    UnknownMessageType(u8),
    /// Frame payload length does not match expected size for message type.
    InvalidPayloadLength {
        /// Expected exact payload byte length.
        expected: usize,
        /// Actual payload slice length.
        actual: usize,
    },
    /// Message type is recognized but not supported by the codec.
    UnsupportedMessageType(messages::MessageType),
}

impl fmt::Display for ProtocolError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::BufferTooShort { expected, actual } => {
                write!(
                    f,
                    "buffer too short: expected {expected} bytes, got {actual}"
                )
            }
            Self::InvalidVersion(v) => {
                write!(
                    f,
                    "invalid protocol version: 0x{v:02X} (expected 0x{PROTOCOL_VERSION:02X})"
                )
            }
            Self::UnknownMessageType(t) => {
                write!(f, "unknown message type: 0x{t:02X}")
            }
            Self::InvalidPayloadLength { expected, actual } => {
                write!(
                    f,
                    "invalid payload length: expected {expected} bytes, got {actual}"
                )
            }
            Self::UnsupportedMessageType(m) => {
                write!(f, "unsupported message type: 0x{:02X}", m.as_u8())
            }
        }
    }
}

impl std::error::Error for ProtocolError {}
