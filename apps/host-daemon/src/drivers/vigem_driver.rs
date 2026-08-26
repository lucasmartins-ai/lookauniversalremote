//! Windows ViGEmBus Virtual Gamepad Driver (Xbox 360 controller emulation via ViGEm).

use crate::drivers::{DriverError, VirtualGamepadDriver};
#[allow(unused_imports)]
use lookaremote_protocol::messages::{buttons, GamepadFullMessage};

#[cfg(target_os = "windows")]
use tracing::{debug, info, warn};
#[cfg(target_os = "windows")]
use vigem_client::{Client, TargetId, XButtons, XGamepad, Xbox360};

/// Virtual Xbox 360 Controller for Windows via ViGEmBus driver.
pub struct ViGEmGamepadDriver {
    #[cfg(target_os = "windows")]
    target: Xbox360<Client>,
}

#[cfg(target_os = "windows")]
impl ViGEmGamepadDriver {
    /// Connects to ViGEmBus driver and spawns a virtual Xbox 360 controller.
    pub fn new() -> Result<Self, DriverError> {
        info!("Connecting to Windows ViGEmBus driver...");
        let client = Client::connect().map_err(|e| {
            DriverError::DeviceNotFound(format!(
                "Failed to connect to ViGEmBus client (ensure ViGEmBus driver is installed): {e:?}"
            ))
        })?;

        let mut target = Xbox360::new(client, TargetId::XBOX360_WIRED);
        target.plugin().map_err(|e| {
            DriverError::Internal(format!("Failed to plug in virtual Xbox 360 controller: {e:?}"))
        })?;

        target.wait_ready().map_err(|e| {
            DriverError::Internal(format!("ViGEm virtual target failed to become ready: {e:?}"))
        })?;

        info!("Successfully initialized Windows ViGEm Xbox 360 virtual controller");
        Ok(Self { target })
    }
}

#[cfg(target_os = "windows")]
impl VirtualGamepadDriver for ViGEmGamepadDriver {
    fn update_gamepad(&mut self, msg: &GamepadFullMessage) -> Result<(), DriverError> {
        let mut raw_buttons = 0u16;

        if (msg.buttons & buttons::DPAD_UP) != 0 {
            raw_buttons |= XButtons::UP;
        }
        if (msg.buttons & buttons::DPAD_DOWN) != 0 {
            raw_buttons |= XButtons::DOWN;
        }
        if (msg.buttons & buttons::DPAD_LEFT) != 0 {
            raw_buttons |= XButtons::LEFT;
        }
        if (msg.buttons & buttons::DPAD_RIGHT) != 0 {
            raw_buttons |= XButtons::RIGHT;
        }
        if (msg.buttons & buttons::BTN_START) != 0 {
            raw_buttons |= XButtons::START;
        }
        if (msg.buttons & buttons::BTN_SELECT) != 0 {
            raw_buttons |= XButtons::BACK;
        }
        if (msg.buttons & buttons::BTN_L3) != 0 {
            raw_buttons |= XButtons::LTHUMB;
        }
        if (msg.buttons & buttons::BTN_R3) != 0 {
            raw_buttons |= XButtons::RTHUMB;
        }
        if (msg.buttons & buttons::BTN_L1) != 0 {
            raw_buttons |= XButtons::LBUMPER;
        }
        if (msg.buttons & buttons::BTN_R1) != 0 {
            raw_buttons |= XButtons::RBUMPER;
        }
        if (msg.buttons & buttons::BTN_GUIDE) != 0 {
            raw_buttons |= XButtons::GUIDE;
        }
        if (msg.buttons & buttons::BTN_SOUTH) != 0 {
            raw_buttons |= XButtons::A;
        }
        if (msg.buttons & buttons::BTN_EAST) != 0 {
            raw_buttons |= XButtons::B;
        }
        if (msg.buttons & buttons::BTN_WEST) != 0 {
            raw_buttons |= XButtons::X;
        }
        if (msg.buttons & buttons::BTN_NORTH) != 0 {
            raw_buttons |= XButtons::Y;
        }

        let gamepad = XGamepad {
            buttons: XButtons(raw_buttons),
            left_trigger: msg.trigger_l,
            right_trigger: msg.trigger_r,
            thumb_lx: msg.stick_lx,
            thumb_ly: msg.stick_ly,
            thumb_rx: msg.stick_rx,
            thumb_ry: msg.stick_ry,
        };

        self.target
            .update(&gamepad)
            .map_err(|e| DriverError::Communication(format!("Failed to update ViGEm controller: {e:?}")))?;

        Ok(())
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        let gamepad = XGamepad::default();
        self.target
            .update(&gamepad)
            .map_err(|e| DriverError::Communication(format!("Failed to neutralize ViGEm controller: {e:?}")))?;
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
impl ViGEmGamepadDriver {
    pub fn new() -> Result<Self, DriverError> {
        Err(DriverError::DriverUnavailable(
            "ViGEmGamepadDriver is only supported on Windows".into(),
        ))
    }
}

#[cfg(not(target_os = "windows"))]
impl VirtualGamepadDriver for ViGEmGamepadDriver {
    fn update_gamepad(&mut self, _msg: &GamepadFullMessage) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "ViGEmGamepadDriver is only supported on Windows".into(),
        ))
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "ViGEmGamepadDriver is only supported on Windows".into(),
        ))
    }
}
