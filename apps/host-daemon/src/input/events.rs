//! Unified internal input events produced from decoded protocol packets.

use lookaremote_protocol::messages::{
    GamepadFullMessage, HapticEventMessage, HeartbeatMessage, KeyboardMessage, MediaMessage,
    ModeSwitchMessage, MotionMessage, TouchpadMessage,
};
use lookaremote_protocol::{Packet, Payload};

/// High-level unified input event enum for driver routing and state tracking.
#[derive(Debug, Clone, PartialEq)]
pub enum InputEvent {
    /// Full 16-bit analog gamepad state update
    GamepadFull(GamepadFullMessage),
    /// 6-DoF Motion (Gyroscope + Accelerometer) update
    Motion(MotionMessage),
    /// Multi-touch trackpad gesture
    Touchpad(TouchpadMessage),
    /// Keyboard key state change
    Keyboard(KeyboardMessage),
    /// Consumer media remote key action
    Media(MediaMessage),
    /// Client explicit mode switch request / Smart Context event
    ModeSwitch(ModeSwitchMessage),
    /// Heartbeat ping/pong frame
    Heartbeat(HeartbeatMessage),
    /// Haptic feedback trigger event
    HapticEvent(HapticEventMessage),
    /// Host-to-Client slot assignment event
    SlotAssignment(lookaremote_protocol::messages::SlotAssignmentMessage),
    /// Smart TV Command (0x0C)
    TvCommand(lookaremote_protocol::messages::TvCommandMessage),
    /// Smart TV Text Input (0x0D)
    TvTextInput(lookaremote_protocol::messages::TvTextInputMessage),
    /// Emergency neutral reset command
    EmergencyReset,
}

impl InputEvent {
    /// Converts a decoded protocol `Payload` into an internal `InputEvent`.
    pub fn from_payload(payload: &Payload) -> Self {
        match payload {
            Payload::GamepadFull(msg) => InputEvent::GamepadFull(*msg),
            Payload::Motion(msg) => InputEvent::Motion(*msg),
            Payload::Touchpad(msg) => InputEvent::Touchpad(*msg),
            Payload::Keyboard(msg) => InputEvent::Keyboard(*msg),
            Payload::Media(msg) => InputEvent::Media(*msg),
            Payload::ModeSwitch(msg) => InputEvent::ModeSwitch(*msg),
            Payload::Heartbeat(msg) => InputEvent::Heartbeat(*msg),
            Payload::HapticEvent(msg) => InputEvent::HapticEvent(*msg),
            Payload::SlotAssignment(msg) => InputEvent::SlotAssignment(*msg),
            Payload::TvCommand(msg) => InputEvent::TvCommand(*msg),
            Payload::TvTextInput(msg) => InputEvent::TvTextInput(*msg),
        }
    }

    /// Creates an emergency reset neutral state event for all buttons and axes.
    pub fn emergency_release() -> Self {
        InputEvent::EmergencyReset
    }
}

impl From<&Payload> for InputEvent {
    #[inline(always)]
    fn from(payload: &Payload) -> Self {
        Self::from_payload(payload)
    }
}

impl From<Payload> for InputEvent {
    #[inline(always)]
    fn from(payload: Payload) -> Self {
        Self::from_payload(&payload)
    }
}

impl From<Packet> for InputEvent {
    #[inline(always)]
    fn from(packet: Packet) -> Self {
        Self::from_payload(&packet.payload)
    }
}

impl From<&Packet> for InputEvent {
    #[inline(always)]
    fn from(packet: &Packet) -> Self {
        Self::from_payload(&packet.payload)
    }
}
