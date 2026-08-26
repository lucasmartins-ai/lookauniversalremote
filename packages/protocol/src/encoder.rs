//! Stack-allocated binary protocol packet encoder.

use core::ops::Deref;
use crate::decoder::{Packet, Payload};
use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Maximum possible packet size for Protocol v1 frames (currently MSG_MOTION = 21 bytes).
pub const MAX_PACKET_SIZE: usize = 32;

/// Fixed-capacity stack-allocated buffer storing encoded frame bytes without heap allocation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PacketBuffer {
    data: [u8; MAX_PACKET_SIZE],
    len: usize,
}

impl PacketBuffer {
    /// Create an empty packet buffer.
    #[inline(always)]
    pub const fn empty() -> Self {
        Self {
            data: [0u8; MAX_PACKET_SIZE],
            len: 0,
        }
    }

    /// Return slice view of encoded bytes.
    #[inline(always)]
    pub fn as_slice(&self) -> &[u8] {
        &self.data[..self.len]
    }

    /// Return length in bytes of encoded packet.
    #[inline(always)]
    pub const fn len(&self) -> usize {
        self.len
    }

    /// Return whether buffer is empty.
    #[inline(always)]
    pub const fn is_empty(&self) -> bool {
        self.len == 0
    }
}

impl Deref for PacketBuffer {
    type Target = [u8];

    #[inline(always)]
    fn deref(&self) -> &Self::Target {
        self.as_slice()
    }
}

impl AsRef<[u8]> for PacketBuffer {
    #[inline(always)]
    fn as_ref(&self) -> &[u8] {
        self.as_slice()
    }
}

/// Encode a packet into a stack-allocated `PacketBuffer`.
#[inline(always)]
pub fn encode_packet(packet: &Packet) -> Result<PacketBuffer, ProtocolError> {
    let mut buffer = PacketBuffer::empty();
    let total_len = encode_packet_to_slice(packet, &mut buffer.data)?;
    buffer.len = total_len;
    Ok(buffer)
}

/// Encode a packet directly into a destination slice. Returns total bytes written.
#[inline(always)]
pub fn encode_packet_to_slice(packet: &Packet, dest: &mut [u8]) -> Result<usize, ProtocolError> {
    let total_size = packet.header.msg_type.total_frame_size()
        .ok_or(ProtocolError::UnsupportedMessageType(packet.header.msg_type))?;

    if dest.len() < total_size {
        return Err(ProtocolError::BufferTooShort {
            expected: total_size,
            actual: dest.len(),
        });
    }

    // Write header
    packet.header.write_to_slice(&mut dest[..HEADER_SIZE])?;

    // Write payload
    let payload_dest = &mut dest[HEADER_SIZE..total_size];
    match &packet.payload {
        Payload::Motion(m) => m.write_payload_to_slice(payload_dest)?,
        Payload::GamepadFull(m) => m.write_payload_to_slice(payload_dest)?,
        Payload::Touchpad(m) => m.write_payload_to_slice(payload_dest)?,
        Payload::Keyboard(m) => m.write_payload_to_slice(payload_dest)?,
        Payload::Media(m) => m.write_payload_to_slice(payload_dest)?,
        Payload::ModeSwitch(m) => m.write_payload_to_slice(payload_dest)?,
        Payload::Heartbeat(m) => m.write_payload_to_slice(payload_dest)?,
        Payload::HapticEvent(m) => m.write_payload_to_slice(payload_dest)?,
    }

    Ok(total_size)
}
