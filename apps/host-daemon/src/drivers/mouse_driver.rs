//! Cross-platform Virtual Relative Mouse OS Drivers.
//!
//! Provides Linux `/dev/uinput` relative mouse emulation, Windows/macOS hooks,
//! and an in-memory `MockMouseDriver` for cross-platform fallback and automated testing.

use crate::drivers::DriverError;
use tracing::{debug, info};

#[cfg(target_os = "linux")]
use evdev::uinput::{VirtualDevice, VirtualDeviceBuilder};
#[cfg(target_os = "linux")]
use evdev::{
    AttributeSet, BusType, EventType, InputEvent as EvdevInputEvent, InputId, Key,
    RelativeAxisType, SynchronizationCode,
};

/// Abstract trait for OS virtual mouse drivers.
pub trait VirtualMouseDriver: Send + Sync {
    /// Injects a relative cursor displacement (dx, dy) in pixels.
    fn move_relative(&mut self, dx: i32, dy: i32) -> Result<(), DriverError>;

    /// Injects a mouse button press (Bit 0: Left, Bit 1: Right, Bit 2: Middle).
    fn button_down(&mut self, button: u8) -> Result<(), DriverError>;

    /// Injects a mouse button release.
    fn button_up(&mut self, button: u8) -> Result<(), DriverError>;

    /// Injects vertical and horizontal scroll wheel events.
    fn scroll(&mut self, scroll_v: i8, scroll_h: i8) -> Result<(), DriverError>;

    /// Immediately resets all buttons and mouse movement accumulators to neutral.
    fn neutralize(&mut self) -> Result<(), DriverError>;
}

/// In-memory mock mouse driver for testing and non-Linux platforms.
#[derive(Debug, Clone, Default)]
pub struct MockMouseDriver {
    /// Last received relative movement (dx, dy)
    pub last_move: Option<(i32, i32)>,
    /// Total count of move_relative calls
    pub move_count: usize,
    /// Cumulative sum of horizontal movements
    pub accumulated_dx: i64,
    /// Cumulative sum of vertical movements
    pub accumulated_dy: i64,
    /// Last received scroll (scroll_v, scroll_h)
    pub last_scroll: Option<(i8, i8)>,
    /// Total count of scroll calls
    pub scroll_count: usize,
    /// Active pressed buttons bitmask (Bit 0: Left, Bit 1: Right, Bit 2: Middle)
    pub buttons_mask: u8,
    /// Total count of button state changes
    pub button_events_count: usize,
    /// Whether driver is in a clean neutral state
    pub is_neutral: bool,
}

impl MockMouseDriver {
    /// Creates a new MockMouseDriver.
    pub fn new() -> Self {
        debug!("Initialized MockMouseDriver (in-memory test mouse driver)");
        Self {
            last_move: None,
            move_count: 0,
            accumulated_dx: 0,
            accumulated_dy: 0,
            last_scroll: None,
            scroll_count: 0,
            buttons_mask: 0,
            button_events_count: 0,
            is_neutral: true,
        }
    }
}

impl VirtualMouseDriver for MockMouseDriver {
    fn move_relative(&mut self, dx: i32, dy: i32) -> Result<(), DriverError> {
        self.last_move = Some((dx, dy));
        self.move_count += 1;
        self.accumulated_dx += dx as i64;
        self.accumulated_dy += dy as i64;
        self.is_neutral = false;
        debug!(dx, dy, "MockMouseDriver move_relative");
        Ok(())
    }

    fn button_down(&mut self, button: u8) -> Result<(), DriverError> {
        self.buttons_mask |= button;
        self.button_events_count += 1;
        self.is_neutral = false;
        debug!(button, "MockMouseDriver button_down");
        Ok(())
    }

    fn button_up(&mut self, button: u8) -> Result<(), DriverError> {
        self.buttons_mask &= !button;
        self.button_events_count += 1;
        debug!(button, "MockMouseDriver button_up");
        Ok(())
    }

    fn scroll(&mut self, scroll_v: i8, scroll_h: i8) -> Result<(), DriverError> {
        self.last_scroll = Some((scroll_v, scroll_h));
        self.scroll_count += 1;
        self.is_neutral = false;
        debug!(scroll_v, scroll_h, "MockMouseDriver scroll");
        Ok(())
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        self.buttons_mask = 0;
        self.last_move = Some((0, 0));
        self.last_scroll = None;
        self.is_neutral = true;
        debug!("MockMouseDriver neutralized");
        Ok(())
    }
}

/// Linux `/dev/uinput` Relative Mouse Driver.
pub struct UInputMouseDriver {
    #[cfg(target_os = "linux")]
    device: VirtualDevice,
}

#[cfg(target_os = "linux")]
impl UInputMouseDriver {
    /// Creates and registers a new virtual relative mouse on `/dev/uinput`.
    pub fn new() -> Result<Self, DriverError> {
        info!("Initializing Linux /dev/uinput virtual relative mouse driver...");

        let mut keys = AttributeSet::<Key>::new();
        keys.insert(Key::BTN_LEFT);
        keys.insert(Key::BTN_RIGHT);
        keys.insert(Key::BTN_MIDDLE);
        keys.insert(Key::BTN_SIDE);
        keys.insert(Key::BTN_EXTRA);

        let mut rel_axes = AttributeSet::<RelativeAxisType>::new();
        rel_axes.insert(RelativeAxisType::REL_X);
        rel_axes.insert(RelativeAxisType::REL_Y);
        rel_axes.insert(RelativeAxisType::REL_WHEEL);
        rel_axes.insert(RelativeAxisType::REL_HWHEEL);

        let input_id = InputId::new(BusType::BUS_USB, 0x045e, 0x0040, 0x0111);

        let device = VirtualDeviceBuilder::new()
            .map_err(|e| DriverError::DeviceNotFound(format!("Failed to open /dev/uinput: {e}")))?
            .name("LookARemote Virtual Mouse")
            .input_id(input_id)
            .with_keys(&keys)
            .map_err(|e| DriverError::Internal(format!("Failed to register mouse keys: {e}")))?
            .with_relative_axes(&rel_axes)
            .map_err(|e| {
                DriverError::Internal(format!("Failed to register mouse relative axes: {e}"))
            })?
            .build()
            .map_err(|e| {
                DriverError::PermissionDenied(format!("Failed to build uinput virtual mouse: {e}"))
            })?;

        info!("Successfully created Linux /dev/uinput virtual relative mouse");
        Ok(Self { device })
    }

    fn emit_events(&mut self, events: &[EvdevInputEvent]) -> Result<(), DriverError> {
        self.device.emit(events).map_err(DriverError::Io)?;
        Ok(())
    }
}

#[cfg(target_os = "linux")]
impl VirtualMouseDriver for UInputMouseDriver {
    fn move_relative(&mut self, dx: i32, dy: i32) -> Result<(), DriverError> {
        if dx == 0 && dy == 0 {
            return Ok(());
        }

        let events = [
            EvdevInputEvent::new(EventType::RELATIVE, RelativeAxisType::REL_X.0, dx),
            EvdevInputEvent::new(EventType::RELATIVE, RelativeAxisType::REL_Y.0, dy),
            EvdevInputEvent::new(
                EventType::SYNCHRONIZATION,
                SynchronizationCode::SYN_REPORT.0,
                0,
            ),
        ];

        self.emit_events(&events)
    }

    fn button_down(&mut self, button: u8) -> Result<(), DriverError> {
        let key = match button {
            0x01 => Key::BTN_LEFT,
            0x02 => Key::BTN_RIGHT,
            0x04 => Key::BTN_MIDDLE,
            _ => Key::BTN_LEFT,
        };

        let events = [
            EvdevInputEvent::new(EventType::KEY, key.code(), 1),
            EvdevInputEvent::new(
                EventType::SYNCHRONIZATION,
                SynchronizationCode::SYN_REPORT.0,
                0,
            ),
        ];

        self.emit_events(&events)
    }

    fn button_up(&mut self, button: u8) -> Result<(), DriverError> {
        let key = match button {
            0x01 => Key::BTN_LEFT,
            0x02 => Key::BTN_RIGHT,
            0x04 => Key::BTN_MIDDLE,
            _ => Key::BTN_LEFT,
        };

        let events = [
            EvdevInputEvent::new(EventType::KEY, key.code(), 0),
            EvdevInputEvent::new(
                EventType::SYNCHRONIZATION,
                SynchronizationCode::SYN_REPORT.0,
                0,
            ),
        ];

        self.emit_events(&events)
    }

    fn scroll(&mut self, scroll_v: i8, scroll_h: i8) -> Result<(), DriverError> {
        let events = [
            EvdevInputEvent::new(
                EventType::RELATIVE,
                RelativeAxisType::REL_WHEEL.0,
                scroll_v as i32,
            ),
            EvdevInputEvent::new(
                EventType::RELATIVE,
                RelativeAxisType::REL_HWHEEL.0,
                scroll_h as i32,
            ),
            EvdevInputEvent::new(
                EventType::SYNCHRONIZATION,
                SynchronizationCode::SYN_REPORT.0,
                0,
            ),
        ];

        self.emit_events(&events)
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        let events = [
            EvdevInputEvent::new(EventType::KEY, Key::BTN_LEFT.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_RIGHT.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_MIDDLE.code(), 0),
            EvdevInputEvent::new(
                EventType::SYNCHRONIZATION,
                SynchronizationCode::SYN_REPORT.0,
                0,
            ),
        ];

        self.emit_events(&events)
    }
}

#[cfg(not(target_os = "linux"))]
impl UInputMouseDriver {
    pub fn new() -> Result<Self, DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputMouseDriver is only supported on Linux".into(),
        ))
    }
}

#[cfg(not(target_os = "linux"))]
impl VirtualMouseDriver for UInputMouseDriver {
    fn move_relative(&mut self, _dx: i32, _dy: i32) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputMouseDriver is only supported on Linux".into(),
        ))
    }

    fn button_down(&mut self, _button: u8) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputMouseDriver is only supported on Linux".into(),
        ))
    }

    fn button_up(&mut self, _button: u8) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputMouseDriver is only supported on Linux".into(),
        ))
    }

    fn scroll(&mut self, _scroll_v: i8, _scroll_h: i8) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputMouseDriver is only supported on Linux".into(),
        ))
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputMouseDriver is only supported on Linux".into(),
        ))
    }
}

/// Creates the recommended virtual mouse driver for the current host operating system.
pub fn create_platform_mouse_driver() -> Box<dyn VirtualMouseDriver> {
    #[cfg(target_os = "linux")]
    {
        match UInputMouseDriver::new() {
            Ok(driver) => {
                info!("Using native Linux /dev/uinput virtual mouse driver");
                return Box::new(driver);
            }
            Err(err) => {
                tracing::warn!(
                    error = %err,
                    "Failed to initialize Linux /dev/uinput mouse driver; falling back to MockMouseDriver"
                );
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        match crate::drivers::macos_driver::MacOSMouseDriver::new() {
            Ok(driver) => {
                info!("Using native macOS CoreGraphics virtual mouse driver");
                return Box::new(driver);
            }
            Err(err) => {
                tracing::warn!(
                    error = %err,
                    "Failed to initialize macOS CoreGraphics mouse driver; falling back to MockMouseDriver"
                );
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        match crate::drivers::windows_driver::WindowsMouseDriver::new() {
            Ok(driver) => {
                info!("Using native Windows SendInput virtual mouse driver");
                return Box::new(driver);
            }
            Err(err) => {
                tracing::warn!(
                    error = %err,
                    "Failed to initialize Windows SendInput mouse driver; falling back to MockMouseDriver"
                );
            }
        }
    }

    info!("Using MockMouseDriver (development / test mode)");
    Box::new(MockMouseDriver::new())
}
