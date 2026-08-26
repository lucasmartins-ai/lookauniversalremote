//! Mock Virtual Gamepad Driver for testing, CI, and platforms without native driver support.

use crate::drivers::{DriverError, VirtualGamepadDriver};
use lookaremote_protocol::messages::GamepadFullMessage;
use tracing::{debug, info};

/// In-memory mock driver capturing gamepad state updates and neutralizations.
#[derive(Debug, Clone, Default)]
pub struct MockGamepadDriver {
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
    /// Creates a new MockGamepadDriver.
    pub fn new() -> Self {
        info!("Initialized MockGamepadDriver (in-memory test driver)");
        Self {
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
            buttons = msg.buttons,
            lx = msg.stick_lx,
            ly = msg.stick_ly,
            rx = msg.stick_rx,
            ry = msg.stick_ry,
            lt = msg.trigger_l,
            rt = msg.trigger_r,
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
            reserved: 0,
        };
        self.last_message = Some(neutral_msg);
        self.neutralize_count += 1;
        self.is_neutral = true;
        debug!("MockGamepadDriver neutralized (all inputs released)");
        Ok(())
    }
}
