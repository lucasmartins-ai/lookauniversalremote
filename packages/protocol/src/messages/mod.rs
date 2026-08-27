//! Protocol message types, payload definitions, and constants.

pub mod gamepad;
pub mod haptic;
pub mod heartbeat;
pub mod keyboard;
pub mod media;
pub mod mode_switch;
pub mod motion;
pub mod slot_assignment;
pub mod touchpad;
pub mod tv_command;
pub mod tv_text;

pub use gamepad::{
    buttons, GamepadFullMessage, GAMEPAD_FULL_PAYLOAD_SIZE, GAMEPAD_FULL_TOTAL_SIZE,
};
pub use haptic::{HapticEventMessage, HAPTIC_PAYLOAD_SIZE, HAPTIC_TOTAL_SIZE};
pub use heartbeat::{HeartbeatMessage, HEARTBEAT_PAYLOAD_SIZE, HEARTBEAT_TOTAL_SIZE};
pub use keyboard::{KeyboardMessage, KEYBOARD_PAYLOAD_SIZE, KEYBOARD_TOTAL_SIZE};
pub use media::{MediaMessage, MEDIA_PAYLOAD_SIZE, MEDIA_TOTAL_SIZE};
pub use mode_switch::{
    flags as mode_switch_flags, modes as control_modes, ModeSwitchMessage,
    MODE_SWITCH_PAYLOAD_SIZE, MODE_SWITCH_TOTAL_SIZE,
};
pub use motion::{MotionMessage, MOTION_PAYLOAD_SIZE, MOTION_TOTAL_SIZE};
pub use slot_assignment::{
    player_colors, SlotAssignmentMessage, SLOT_ASSIGNMENT_PAYLOAD_SIZE, SLOT_ASSIGNMENT_TOTAL_SIZE,
};
pub use touchpad::{TouchpadMessage, TOUCHPAD_PAYLOAD_SIZE, TOUCHPAD_TOTAL_SIZE};
pub use tv_command::{
    commands as tv_commands, target_devices as tv_target_devices, TvCommandMessage,
    TV_COMMAND_PAYLOAD_SIZE, TV_COMMAND_TOTAL_SIZE,
};
pub use tv_text::{
    TvTextInputMessage, TV_TEXT_MAX_LEN, TV_TEXT_PAYLOAD_SIZE, TV_TEXT_TOTAL_SIZE,
};

/// Message type identifiers in the LookARemote Binary Protocol v1.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum MessageType {
    /// IMU Gyroscope & Accelerometer deltas (21 bytes total).
    Motion = 0x01,
    /// Complete gamepad state snapshot (19 bytes total).
    GamepadFull = 0x02,
    /// Incremental gamepad delta (reserved for future delta compression).
    GamepadDelta = 0x03,
    /// Relative cursor movement & multi-touch gestures (12 bytes total).
    Touchpad = 0x04,
    /// Key press / release events (9 bytes total).
    Keyboard = 0x05,
    /// Consumer media key action (7 bytes total).
    Media = 0x06,
    /// Client explicit mode request / host context sync (7 bytes total).
    ModeSwitch = 0x07,
    /// Keepalive & latency echo probe (13 bytes total).
    Heartbeat = 0x08,
    /// Acknowledgment for reliable control frames (reserved).
    Ack = 0x09,
    /// Host-to-Client haptic rumble trigger (9 bytes total).
    HapticEvent = 0x0A,
    /// Host-to-Client player slot assignment & telemetry (25 bytes total).
    SlotAssignment = 0x0B,
    /// Universal Smart TV Command Code (9 bytes total).
    TvCommand = 0x0C,
    /// Smart TV Text Input & Search string (37 bytes total).
    TvTextInput = 0x0D,
}

impl MessageType {
    /// Convert byte value to MessageType enum.
    #[inline(always)]
    pub const fn from_u8(value: u8) -> Option<Self> {
        match value {
            0x01 => Some(Self::Motion),
            0x02 => Some(Self::GamepadFull),
            0x03 => Some(Self::GamepadDelta),
            0x04 => Some(Self::Touchpad),
            0x05 => Some(Self::Keyboard),
            0x06 => Some(Self::Media),
            0x07 => Some(Self::ModeSwitch),
            0x08 => Some(Self::Heartbeat),
            0x09 => Some(Self::Ack),
            0x0A => Some(Self::HapticEvent),
            0x0B => Some(Self::SlotAssignment),
            0x0C => Some(Self::TvCommand),
            0x0D => Some(Self::TvTextInput),
            _ => None,
        }
    }

    /// Return underlying byte value.
    #[inline(always)]
    pub const fn as_u8(&self) -> u8 {
        *self as u8
    }

    /// Expected payload size in bytes for supported message types.
    #[inline(always)]
    pub const fn payload_size(&self) -> Option<usize> {
        match self {
            Self::Motion => Some(MOTION_PAYLOAD_SIZE),
            Self::GamepadFull => Some(GAMEPAD_FULL_PAYLOAD_SIZE),
            Self::Touchpad => Some(TOUCHPAD_PAYLOAD_SIZE),
            Self::Keyboard => Some(KEYBOARD_PAYLOAD_SIZE),
            Self::Media => Some(MEDIA_PAYLOAD_SIZE),
            Self::ModeSwitch => Some(MODE_SWITCH_PAYLOAD_SIZE),
            Self::Heartbeat => Some(HEARTBEAT_PAYLOAD_SIZE),
            Self::HapticEvent => Some(HAPTIC_PAYLOAD_SIZE),
            Self::SlotAssignment => Some(SLOT_ASSIGNMENT_PAYLOAD_SIZE),
            Self::TvCommand => Some(TV_COMMAND_PAYLOAD_SIZE),
            Self::TvTextInput => Some(TV_TEXT_PAYLOAD_SIZE),
            Self::GamepadDelta | Self::Ack => None,
        }
    }

    /// Expected total frame size (Header + Payload) in bytes for supported message types.
    #[inline(always)]
    pub const fn total_frame_size(&self) -> Option<usize> {
        match self {
            Self::Motion => Some(MOTION_TOTAL_SIZE),
            Self::GamepadFull => Some(GAMEPAD_FULL_TOTAL_SIZE),
            Self::Touchpad => Some(TOUCHPAD_TOTAL_SIZE),
            Self::Keyboard => Some(KEYBOARD_TOTAL_SIZE),
            Self::Media => Some(MEDIA_TOTAL_SIZE),
            Self::ModeSwitch => Some(MODE_SWITCH_TOTAL_SIZE),
            Self::Heartbeat => Some(HEARTBEAT_TOTAL_SIZE),
            Self::HapticEvent => Some(HAPTIC_TOTAL_SIZE),
            Self::SlotAssignment => Some(SLOT_ASSIGNMENT_TOTAL_SIZE),
            Self::TvCommand => Some(TV_COMMAND_TOTAL_SIZE),
            Self::TvTextInput => Some(TV_TEXT_TOTAL_SIZE),
            Self::GamepadDelta | Self::Ack => None,
        }
    }
}
