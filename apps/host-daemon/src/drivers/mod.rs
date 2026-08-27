//! Cross-platform Virtual Input OS Drivers (Gamepad, Mouse, Keyboard).
//!
//! Supports native OS drivers across Linux (`/dev/uinput`), Windows (`ViGEmBus` + Win32 `SendInput`),
//! and macOS (Apple `CoreGraphics` / `CGEvent` + TCC Accessibility verification),
//! with automatic fallback to high-fidelity in-memory mock drivers for testing and virtualization.

pub mod keyboard_driver;
pub mod macos_driver;
pub mod macos_permissions;
pub mod mock_driver;
pub mod mouse_driver;
pub mod uinput_driver;
pub mod vigem_driver;
pub mod windows_driver;

pub use keyboard_driver::{create_platform_keyboard_driver, MockKeyboardDriver, UInputKeyboardDriver, VirtualKeyboardDriver};
pub use macos_driver::{MacOSKeyboardDriver, MacOSMouseDriver};
pub use macos_permissions::check_macos_accessibility_permissions;
pub use mock_driver::MockGamepadDriver;
pub use mouse_driver::{create_platform_mouse_driver, MockMouseDriver, UInputMouseDriver, VirtualMouseDriver};
pub use uinput_driver::UInputGamepadDriver;
pub use vigem_driver::ViGEmGamepadDriver;
pub use windows_driver::{WindowsKeyboardDriver, WindowsMouseDriver};

use lookaremote_protocol::messages::GamepadFullMessage;
use thiserror::Error;
#[allow(unused_imports)]
use tracing::{info, warn};

/// Driver errors during creation, communication, or neutralization.
#[derive(Debug, Error)]
pub enum DriverError {
    #[error("Device not found or driver initialization failed: {0}")]
    DeviceNotFound(String),

    #[error("I/O error during driver communication: {0}")]
    Io(#[from] std::io::Error),

    #[error("Permission denied creating virtual input device: {0}")]
    PermissionDenied(String),

    #[error("Driver is unavailable on this platform: {0}")]
    DriverUnavailable(String),

    #[error("Driver communication failed: {0}")]
    Communication(String),

    #[error("Internal driver error: {0}")]
    Internal(String),
}

/// Abstract trait for OS virtual gamepad drivers.
pub trait VirtualGamepadDriver: Send + Sync {
    /// Dispatches a complete gamepad snapshot state to the OS virtual device.
    fn update_gamepad(&mut self, msg: &GamepadFullMessage) -> Result<(), DriverError>;

    /// Immediately neutralizes the virtual gamepad: releases all buttons and resets all axes/triggers to zero.
    fn neutralize(&mut self) -> Result<(), DriverError>;
}

/// Creates the recommended virtual gamepad driver for the current host operating system for Player 1.
pub fn create_platform_driver() -> Box<dyn VirtualGamepadDriver> {
    create_platform_driver_for_slot(0)
}

/// Creates the recommended virtual gamepad driver for the specified player slot (0..3).
///
/// On Linux: attempts to initialize `/dev/uinput` virtual Xbox 360 controller.
/// On Windows: attempts to connect to `ViGEmBus` driver.
/// On macOS / Fallback: instantiates `MockGamepadDriver::for_slot(slot)`.
pub fn create_platform_driver_for_slot(slot: u8) -> Box<dyn VirtualGamepadDriver> {
    #[cfg(target_os = "linux")]
    {
        match UInputGamepadDriver::new() {
            Ok(driver) => {
                info!(slot = slot, "Using native Linux /dev/uinput virtual Xbox 360 driver for Player {}", slot + 1);
                return Box::new(driver);
            }
            Err(err) => {
                warn!(
                    slot = slot,
                    error = %err,
                    "Failed to initialize Linux /dev/uinput driver; falling back to MockGamepadDriver"
                );
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        match ViGEmGamepadDriver::new() {
            Ok(driver) => {
                info!(slot = slot, "Using native Windows ViGEm virtual Xbox 360 driver for Player {}", slot + 1);
                return Box::new(driver);
            }
            Err(err) => {
                warn!(
                    slot = slot,
                    error = %err,
                    "Failed to initialize Windows ViGEm driver; falling back to MockGamepadDriver"
                );
            }
        }
    }

    info!(slot = slot, "Using MockGamepadDriver for Player Slot {} (development / test mode)", slot + 1);
    Box::new(MockGamepadDriver::for_slot(slot))
}
