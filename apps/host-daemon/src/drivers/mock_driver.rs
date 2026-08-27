//! Mock Virtual Gamepad Driver for testing, CI, and platforms without native driver support.

use crate::drivers::{DriverError, VirtualGamepadDriver};
use lookaremote_protocol::messages::GamepadFullMessage;
use tracing::{debug, info};

/// In-memory mock driver capturing gamepad state updates and neutralizations.
#[derive(Debug, Clone, Default)]
pub struct MockGamepadDriver {
    /// Slot index (0..3)
    pub slot_index: u8,
    /// Last received gamepad message snapshot
    pub last_message: Option<GamepadFullMessage>,
    /// Total number of successful update_gamepad calls
    pub update_count: usize,
    /// Total number of neutralize calls
    pub neutralize_count: usize,
    /// Whether the driver is currently in a neutralized (released) state
    pub is_neutral: bool,
}

impl MockGamepadDriver {
    /// Creates a new MockGamepadDriver for Player 1 (slot 0).
    pub fn new() -> Self {
        Self::for_slot(0)
    }

    /// Creates a new MockGamepadDriver for a specific player slot.
    pub fn for_slot(slot_index: u8) -> Self {
        info!(
            slot = slot_index,
            "Initialized MockGamepadDriver for Player Slot {}",
            slot_index + 1
        );
        Self {
            slot_index,
            last_message: None,
            update_count: 0,
            neutralize_count: 0,
            is_neutral: true,
        }
    }

    /// Returns the last received message.
    pub fn last_message(&self) -> Option<GamepadFullMessage> {
        self.last_message
    }

    /// Returns whether the driver is currently neutralized.
    pub fn is_neutral(&self) -> bool {
        self.is_neutral
    }
}

impl VirtualGamepadDriver for MockGamepadDriver {
    fn update_gamepad(&mut self, msg: &GamepadFullMessage) -> Result<(), DriverError> {
        self.last_message = Some(*msg);
        self.update_count += 1;
        self.is_neutral = false;
        debug!(
            slot = self.slot_index,
            buttons = msg.buttons,
            lx = msg.stick_lx,
            ly = msg.stick_ly,
            rx = msg.stick_rx,
            ry = msg.stick_ry,
            lt = msg.trigger_l,
            rt = msg.trigger_r,
            player_index = msg.player_index,
            "MockGamepadDriver received state update"
        );
        Ok(())
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        let neutral_msg = GamepadFullMessage {
            buttons: 0,
            stick_lx: 0,
            stick_ly: 0,
            stick_rx: 0,
            stick_ry: 0,
            trigger_l: 0,
            trigger_r: 0,
            player_index: self.slot_index,
            reserved: 0,
        };
        self.last_message = Some(neutral_msg);
        self.neutralize_count += 1;
        self.is_neutral = true;
        debug!(
            slot = self.slot_index,
            "MockGamepadDriver neutralized (all inputs released)"
        );
        Ok(())
    }
}
