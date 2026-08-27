//! Zero-allocation binary protocol frame decoder.

use crate::header::{Header, HEADER_SIZE};
use crate::messages::*;
use crate::ProtocolError;

/// Decoded message payload variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Payload {
    /// MSG_MOTION (0x01) — 16 bytes payload.
    Motion(MotionMessage),
    /// MSG_GAMEPAD_FULL (0x02) — 14 bytes payload.
    GamepadFull(GamepadFullMessage),
    /// MSG_TOUCHPAD (0x04) — 7 bytes payload.
    Touchpad(TouchpadMessage),
    /// MSG_KEYBOARD (0x05) — 4 bytes payload.
    Keyboard(KeyboardMessage),
    /// MSG_MEDIA (0x06) — 2 bytes payload.
    Media(MediaMessage),
    /// MSG_MODE_SWITCH (0x07) — 2 bytes payload.
    ModeSwitch(ModeSwitchMessage),
    /// MSG_HEARTBEAT (0x08) — 8 bytes payload.
    Heartbeat(HeartbeatMessage),
    /// MSG_HAPTIC_EVENT (0x0A) — 4 bytes payload.
    HapticEvent(HapticEventMessage),
    /// MSG_SLOT_ASSIGNMENT (0x0B) — 20 bytes payload.
    SlotAssignment(SlotAssignmentMessage),
    /// MSG_TV_COMMAND (0x0C) — 4 bytes payload.
    TvCommand(TvCommandMessage),
    /// MSG_TV_TEXT_INPUT (0x0D) — 32 bytes payload.
    TvTextInput(TvTextInputMessage),
}

/// A fully parsed LookARemote packet containing a header and message payload.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Packet {
    /// 5-byte base header.
    pub header: Header,
    /// Message payload.
    pub payload: Payload,
}

impl Packet {
    /// Create a new packet from header and payload.
    #[inline(always)]
    pub const fn new(header: Header, payload: Payload) -> Self {
        Self { header, payload }
    }

    /// Sequence number of the packet.
    #[inline(always)]
    pub const fn sequence(&self) -> u16 {
        self.header.sequence
    }

    /// Message type of the packet.
    #[inline(always)]
    pub const fn msg_type(&self) -> MessageType {
        self.header.msg_type
    }
}

/// Zero-allocation decode function parsing a raw byte slice into a strongly-typed `Packet`.
///
/// Ensures exact frame length matching according to message type specification.
#[inline(always)]
pub fn decode_packet(bytes: &[u8]) -> Result<Packet, ProtocolError> {
    if bytes.len() < HEADER_SIZE {
        return Err(ProtocolError::BufferTooShort {
            expected: HEADER_SIZE,
            actual: bytes.len(),
        });
    }

    let header = Header::decode(&bytes[..HEADER_SIZE])?;
    let expected_payload_size = header
        .msg_type
        .payload_size()
        .ok_or(ProtocolError::UnsupportedMessageType(header.msg_type))?;

    let payload_bytes = &bytes[HEADER_SIZE..];
    if payload_bytes.len() != expected_payload_size {
        return Err(ProtocolError::InvalidPayloadLength {
            expected: expected_payload_size,
            actual: payload_bytes.len(),
        });
    }

    let payload = match header.msg_type {
        MessageType::Motion => Payload::Motion(MotionMessage::decode_payload(payload_bytes)?),
        MessageType::GamepadFull => {
            Payload::GamepadFull(GamepadFullMessage::decode_payload(payload_bytes)?)
        }
        MessageType::Touchpad => Payload::Touchpad(TouchpadMessage::decode_payload(payload_bytes)?),
        MessageType::Keyboard => Payload::Keyboard(KeyboardMessage::decode_payload(payload_bytes)?),
        MessageType::Media => Payload::Media(MediaMessage::decode_payload(payload_bytes)?),
        MessageType::ModeSwitch => {
            Payload::ModeSwitch(ModeSwitchMessage::decode_payload(payload_bytes)?)
        }
        MessageType::Heartbeat => {
            Payload::Heartbeat(HeartbeatMessage::decode_payload(payload_bytes)?)
        }
        MessageType::HapticEvent => {
            Payload::HapticEvent(HapticEventMessage::decode_payload(payload_bytes)?)
        }
        MessageType::SlotAssignment => {
            Payload::SlotAssignment(SlotAssignmentMessage::decode_payload(payload_bytes)?)
        }
        MessageType::TvCommand => {
            Payload::TvCommand(TvCommandMessage::decode_payload(payload_bytes)?)
        }
        MessageType::TvTextInput => {
            Payload::TvTextInput(TvTextInputMessage::decode_payload(payload_bytes)?)
        }
        MessageType::GamepadDelta | MessageType::Ack => {
            return Err(ProtocolError::UnsupportedMessageType(header.msg_type));
        }
    };

    Ok(Packet { header, payload })
}
