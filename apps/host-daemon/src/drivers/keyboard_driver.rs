//! Cross-platform Virtual Keyboard & Media OS Drivers.
//!
//! Provides Linux `/dev/uinput` virtual keyboard emulation with USB HID code translation,
//! Windows/macOS fallback hooks, and an in-memory `MockKeyboardDriver` for automated testing.

use crate::drivers::DriverError;
use std::collections::HashSet;
use tracing::{debug, info};

#[cfg(target_os = "linux")]
use evdev::uinput::{VirtualDevice, VirtualDeviceBuilder};
#[cfg(target_os = "linux")]
use evdev::{
    AttributeSet, BusType, EventType, InputEvent as EvdevInputEvent, InputId, Key,
    SynchronizationCode,
};

/// Abstract trait for OS virtual keyboard and consumer media drivers.
pub trait VirtualKeyboardDriver: Send + Sync {
    /// Injects a keyboard key press/release event.
    /// - `key_code`: USB HID Usage ID (0x04..0xE7).
    /// - `state`: 0 = Key Up (Released), 1 = Key Down (Pressed), 2 = Repeat.
    /// - `modifiers`: Bitfield (Bit 0: Ctrl, Bit 1: Shift, Bit 2: Alt, Bit 3: Meta).
    fn key_event(&mut self, key_code: u16, state: u8, modifiers: u8) -> Result<(), DriverError>;

    /// Injects an OS consumer media key action.
    /// (1: Play/Pause, 2: Stop, 3: Next, 4: Prev, 5: VolUp, 6: VolDown, 7: Mute).
    fn media_action(&mut self, action: u8) -> Result<(), DriverError>;

    /// Immediately releases all active held keys and modifiers.
    fn neutralize(&mut self) -> Result<(), DriverError>;
}

/// In-memory mock keyboard driver for unit/integration testing and non-Linux platforms.
#[derive(Debug, Clone, Default)]
pub struct MockKeyboardDriver {
    /// Last received key event: (key_code, state, modifiers)
    pub last_key: Option<(u16, u8, u8)>,
    /// Total count of key events processed
    pub key_events_count: usize,
    /// Last received consumer media action
    pub last_media: Option<u8>,
    /// Total count of media actions processed
    pub media_events_count: usize,
    /// Set of currently pressed USB HID key codes
    pub pressed_keys: HashSet<u16>,
    /// Active modifiers bitmask (Bit 0: Ctrl, Bit 1: Shift, Bit 2: Alt, Bit 3: Meta)
    pub active_modifiers: u8,
    /// Whether driver is in a clean neutral state
    pub is_neutral: bool,
}

impl MockKeyboardDriver {
    /// Creates a new MockKeyboardDriver.
    pub fn new() -> Self {
        debug!("Initialized MockKeyboardDriver (in-memory test keyboard driver)");
        Self {
            last_key: None,
            key_events_count: 0,
            last_media: None,
            media_events_count: 0,
            pressed_keys: HashSet::new(),
            active_modifiers: 0,
            is_neutral: true,
        }
    }
}

impl VirtualKeyboardDriver for MockKeyboardDriver {
    fn key_event(&mut self, key_code: u16, state: u8, modifiers: u8) -> Result<(), DriverError> {
        self.last_key = Some((key_code, state, modifiers));
        self.key_events_count += 1;
        self.active_modifiers = modifiers;

        if state == 1 || state == 2 {
            self.pressed_keys.insert(key_code);
            self.is_neutral = false;
        } else if state == 0 {
            self.pressed_keys.remove(&key_code);
            if self.pressed_keys.is_empty() && self.active_modifiers == 0 {
                self.is_neutral = true;
            }
        }

        debug!(key_code, state, modifiers, "MockKeyboardDriver key_event");
        Ok(())
    }

    fn media_action(&mut self, action: u8) -> Result<(), DriverError> {
        self.last_media = Some(action);
        self.media_events_count += 1;
        debug!(action, "MockKeyboardDriver media_action");
        Ok(())
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        self.pressed_keys.clear();
        self.active_modifiers = 0;
        self.last_key = None;
        self.is_neutral = true;
        debug!("MockKeyboardDriver neutralized");
        Ok(())
    }
}

/// Linux `/dev/uinput` Keyboard Driver.
pub struct UInputKeyboardDriver {
    #[cfg(target_os = "linux")]
    device: VirtualDevice,
    #[cfg(target_os = "linux")]
    pressed_keys: HashSet<Key>,
}

#[cfg(target_os = "linux")]
impl UInputKeyboardDriver {
    /// Creates and registers a new virtual keyboard on Linux `/dev/uinput`.
    pub fn new() -> Result<Self, DriverError> {
        info!("Initializing Linux /dev/uinput virtual keyboard driver...");

        let mut keys = AttributeSet::<Key>::new();

        // Register Alphanumeric keys
        for key in [
            Key::KEY_A,
            Key::KEY_B,
            Key::KEY_C,
            Key::KEY_D,
            Key::KEY_E,
            Key::KEY_F,
            Key::KEY_G,
            Key::KEY_H,
            Key::KEY_I,
            Key::KEY_J,
            Key::KEY_K,
            Key::KEY_L,
            Key::KEY_M,
            Key::KEY_N,
            Key::KEY_O,
            Key::KEY_P,
            Key::KEY_Q,
            Key::KEY_R,
            Key::KEY_S,
            Key::KEY_T,
            Key::KEY_U,
            Key::KEY_V,
            Key::KEY_W,
            Key::KEY_X,
            Key::KEY_Y,
            Key::KEY_Z,
            Key::KEY_1,
            Key::KEY_2,
            Key::KEY_3,
            Key::KEY_4,
            Key::KEY_5,
            Key::KEY_6,
            Key::KEY_7,
            Key::KEY_8,
            Key::KEY_9,
            Key::KEY_0,
            Key::KEY_ENTER,
            Key::KEY_ESC,
            Key::KEY_BACKSPACE,
            Key::KEY_TAB,
            Key::KEY_SPACE,
            Key::KEY_MINUS,
            Key::KEY_EQUAL,
            Key::KEY_LEFTBRACE,
            Key::KEY_RIGHTBRACE,
            Key::KEY_BACKSLASH,
            Key::KEY_SEMICOLON,
            Key::KEY_APOSTROPHE,
            Key::KEY_GRAVE,
            Key::KEY_COMMA,
            Key::KEY_DOT,
            Key::KEY_SLASH,
            Key::KEY_CAPSLOCK,
            Key::KEY_F1,
            Key::KEY_F2,
            Key::KEY_F3,
            Key::KEY_F4,
            Key::KEY_F5,
            Key::KEY_F6,
            Key::KEY_F7,
            Key::KEY_F8,
            Key::KEY_F9,
            Key::KEY_F10,
            Key::KEY_F11,
            Key::KEY_F12,
            Key::KEY_PRINT,
            Key::KEY_SCROLLLOCK,
            Key::KEY_PAUSE,
            Key::KEY_INSERT,
            Key::KEY_HOME,
            Key::KEY_PAGEUP,
            Key::KEY_DELETE,
            Key::KEY_END,
            Key::KEY_PAGEDOWN,
            Key::KEY_RIGHT,
            Key::KEY_LEFT,
            Key::KEY_DOWN,
            Key::KEY_UP,
            Key::KEY_LEFTCTRL,
            Key::KEY_LEFTSHIFT,
            Key::KEY_LEFTALT,
            Key::KEY_LEFTMETA,
            Key::KEY_RIGHTCTRL,
            Key::KEY_RIGHTSHIFT,
            Key::KEY_RIGHTALT,
            Key::KEY_RIGHTMETA,
            // Consumer Media Keys
            Key::KEY_PLAYPAUSE,
            Key::KEY_STOPCD,
            Key::KEY_NEXTSONG,
            Key::KEY_PREVIOUSSONG,
            Key::KEY_VOLUMEUP,
            Key::KEY_VOLUMEDOWN,
            Key::KEY_MUTE,
        ] {
            keys.insert(key);
        }

        let input_id = InputId::new(BusType::BUS_USB, 0x045e, 0x0041, 0x0111);

        let device = VirtualDeviceBuilder::new()
            .map_err(|e| {
                DriverError::DeviceNotFound(format!("Failed to open /dev/uinput for keyboard: {e}"))
            })?
            .name("LookARemote Virtual Keyboard")
            .input_id(input_id)
            .with_keys(&keys)
            .map_err(|e| DriverError::Internal(format!("Failed to register keyboard keys: {e}")))?
            .build()
            .map_err(|e| {
                DriverError::PermissionDenied(format!(
                    "Failed to build uinput virtual keyboard: {e}"
                ))
            })?;

        info!("Successfully created Linux /dev/uinput virtual keyboard");
        Ok(Self {
            device,
            pressed_keys: HashSet::new(),
        })
    }

    fn hid_to_evdev_key(hid: u16) -> Option<Key> {
        match hid {
            // Letters A-Z
            0x04 => Some(Key::KEY_A),
            0x05 => Some(Key::KEY_B),
            0x06 => Some(Key::KEY_C),
            0x07 => Some(Key::KEY_D),
            0x08 => Some(Key::KEY_E),
            0x09 => Some(Key::KEY_F),
            0x0A => Some(Key::KEY_G),
            0x0B => Some(Key::KEY_H),
            0x0C => Some(Key::KEY_I),
            0x0D => Some(Key::KEY_J),
            0x0E => Some(Key::KEY_K),
            0x0F => Some(Key::KEY_L),
            0x10 => Some(Key::KEY_M),
            0x11 => Some(Key::KEY_N),
            0x12 => Some(Key::KEY_O),
            0x13 => Some(Key::KEY_P),
            0x14 => Some(Key::KEY_Q),
            0x15 => Some(Key::KEY_R),
            0x16 => Some(Key::KEY_S),
            0x17 => Some(Key::KEY_T),
            0x18 => Some(Key::KEY_U),
            0x19 => Some(Key::KEY_V),
            0x1A => Some(Key::KEY_W),
            0x1B => Some(Key::KEY_X),
            0x1C => Some(Key::KEY_Y),
            0x1D => Some(Key::KEY_Z),

            // Digits 1-0
            0x1E => Some(Key::KEY_1),
            0x1F => Some(Key::KEY_2),
            0x20 => Some(Key::KEY_3),
            0x21 => Some(Key::KEY_4),
            0x22 => Some(Key::KEY_5),
            0x23 => Some(Key::KEY_6),
            0x24 => Some(Key::KEY_7),
            0x25 => Some(Key::KEY_8),
            0x26 => Some(Key::KEY_9),
            0x27 => Some(Key::KEY_0),

            // Control / Punctuation
            0x28 => Some(Key::KEY_ENTER),
            0x29 => Some(Key::KEY_ESC),
            0x2A => Some(Key::KEY_BACKSPACE),
            0x2B => Some(Key::KEY_TAB),
            0x2C => Some(Key::KEY_SPACE),
            0x2D => Some(Key::KEY_MINUS),
            0x2E => Some(Key::KEY_EQUAL),
            0x2F => Some(Key::KEY_LEFTBRACE),
            0x30 => Some(Key::KEY_RIGHTBRACE),
            0x31 => Some(Key::KEY_BACKSLASH),
            0x33 => Some(Key::KEY_SEMICOLON),
            0x34 => Some(Key::KEY_APOSTROPHE),
            0x35 => Some(Key::KEY_GRAVE),
            0x36 => Some(Key::KEY_COMMA),
            0x37 => Some(Key::KEY_DOT),
            0x38 => Some(Key::KEY_SLASH),
            0x39 => Some(Key::KEY_CAPSLOCK),

            // Function Keys F1-F12
            0x3A => Some(Key::KEY_F1),
            0x3B => Some(Key::KEY_F2),
            0x3C => Some(Key::KEY_F3),
            0x3D => Some(Key::KEY_F4),
            0x3E => Some(Key::KEY_F5),
            0x3F => Some(Key::KEY_F6),
            0x40 => Some(Key::KEY_F7),
            0x41 => Some(Key::KEY_F8),
            0x42 => Some(Key::KEY_F9),
            0x43 => Some(Key::KEY_F10),
            0x44 => Some(Key::KEY_F11),
            0x45 => Some(Key::KEY_F12),

            // Navigation & Editing
            0x46 => Some(Key::KEY_PRINT),
            0x47 => Some(Key::KEY_SCROLLLOCK),
            0x48 => Some(Key::KEY_PAUSE),
            0x49 => Some(Key::KEY_INSERT),
            0x4A => Some(Key::KEY_HOME),
            0x4B => Some(Key::KEY_PAGEUP),
            0x4C => Some(Key::KEY_DELETE),
            0x4D => Some(Key::KEY_END),
            0x4E => Some(Key::KEY_PAGEDOWN),
            0x4F => Some(Key::KEY_RIGHT),
            0x50 => Some(Key::KEY_LEFT),
            0x51 => Some(Key::KEY_DOWN),
            0x52 => Some(Key::KEY_UP),

            // Modifiers
            0xE0 => Some(Key::KEY_LEFTCTRL),
            0xE1 => Some(Key::KEY_LEFTSHIFT),
            0xE2 => Some(Key::KEY_LEFTALT),
            0xE3 => Some(Key::KEY_LEFTMETA),
            0xE4 => Some(Key::KEY_RIGHTCTRL),
            0xE5 => Some(Key::KEY_RIGHTSHIFT),
            0xE6 => Some(Key::KEY_RIGHTALT),
            0xE7 => Some(Key::KEY_RIGHTMETA),

            _ => None,
        }
    }

    fn media_action_to_key(action: u8) -> Option<Key> {
        match action {
            1 => Some(Key::KEY_PLAYPAUSE),
            2 => Some(Key::KEY_STOPCD),
            3 => Some(Key::KEY_NEXTSONG),
            4 => Some(Key::KEY_PREVIOUSSONG),
            5 => Some(Key::KEY_VOLUMEUP),
            6 => Some(Key::KEY_VOLUMEDOWN),
            7 => Some(Key::KEY_MUTE),
            _ => None,
        }
    }
}

#[cfg(target_os = "linux")]
impl VirtualKeyboardDriver for UInputKeyboardDriver {
    fn key_event(&mut self, key_code: u16, state: u8, modifiers: u8) -> Result<(), DriverError> {
        let mut events = Vec::with_capacity(4);

        // Sync modifiers
        let ctrl_val = if modifiers & 0x01 != 0 { 1 } else { 0 };
        let shift_val = if modifiers & 0x02 != 0 { 1 } else { 0 };
        let alt_val = if modifiers & 0x04 != 0 { 1 } else { 0 };
        let meta_val = if modifiers & 0x08 != 0 { 1 } else { 0 };

        // Check if key_code maps to a valid Linux key
        if let Some(key) = Self::hid_to_evdev_key(key_code) {
            let ev_val = match state {
                0 => {
                    self.pressed_keys.remove(&key);
                    0
                }
                1 => {
                    self.pressed_keys.insert(key);
                    1
                }
                2 => 2, // Repeat
                _ => 0,
            };

            events.push(EvdevInputEvent::new(EventType::KEY, key.code(), ev_val));
        }

        events.push(EvdevInputEvent::new(
            EventType::SYNCHRONIZATION,
            SynchronizationCode::SYN_REPORT.0,
            0,
        ));

        self.device.emit(&events).map_err(DriverError::Io)?;
        Ok(())
    }

    fn media_action(&mut self, action: u8) -> Result<(), DriverError> {
        if let Some(key) = Self::media_action_to_key(action) {
            // Pulse: Key Down followed by Key Up
            let events = [
                EvdevInputEvent::new(EventType::KEY, key.code(), 1),
                EvdevInputEvent::new(
                    EventType::SYNCHRONIZATION,
                    SynchronizationCode::SYN_REPORT.0,
                    0,
                ),
                EvdevInputEvent::new(EventType::KEY, key.code(), 0),
                EvdevInputEvent::new(
                    EventType::SYNCHRONIZATION,
                    SynchronizationCode::SYN_REPORT.0,
                    0,
                ),
            ];

            self.device.emit(&events).map_err(DriverError::Io)?;
        }
        Ok(())
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        if self.pressed_keys.is_empty() {
            return Ok(());
        }

        let mut events = Vec::with_capacity(self.pressed_keys.len() + 1);
        for key in self.pressed_keys.drain() {
            events.push(EvdevInputEvent::new(EventType::KEY, key.code(), 0));
        }
        events.push(EvdevInputEvent::new(
            EventType::SYNCHRONIZATION,
            SynchronizationCode::SYN_REPORT.0,
            0,
        ));

        self.device.emit(&events).map_err(DriverError::Io)?;
        Ok(())
    }
}

#[cfg(not(target_os = "linux"))]
impl UInputKeyboardDriver {
    pub fn new() -> Result<Self, DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputKeyboardDriver is only supported on Linux".into(),
        ))
    }
}

#[cfg(not(target_os = "linux"))]
impl VirtualKeyboardDriver for UInputKeyboardDriver {
    fn key_event(&mut self, _key_code: u16, _state: u8, _modifiers: u8) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputKeyboardDriver is only supported on Linux".into(),
        ))
    }

    fn media_action(&mut self, _action: u8) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputKeyboardDriver is only supported on Linux".into(),
        ))
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputKeyboardDriver is only supported on Linux".into(),
        ))
    }
}

/// Creates the recommended virtual keyboard driver for the current host operating system.
pub fn create_platform_keyboard_driver() -> Box<dyn VirtualKeyboardDriver> {
    #[cfg(target_os = "linux")]
    {
        match UInputKeyboardDriver::new() {
            Ok(driver) => {
                info!("Using native Linux /dev/uinput virtual keyboard driver");
                return Box::new(driver);
            }
            Err(err) => {
                tracing::warn!(
                    error = %err,
                    "Failed to initialize Linux /dev/uinput keyboard driver; falling back to MockKeyboardDriver"
                );
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        match crate::drivers::macos_driver::MacOSKeyboardDriver::new() {
            Ok(driver) => {
                info!("Using native macOS CoreGraphics virtual keyboard driver");
                return Box::new(driver);
            }
            Err(err) => {
                tracing::warn!(
                    error = %err,
                    "Failed to initialize macOS CoreGraphics keyboard driver; falling back to MockKeyboardDriver"
                );
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        match crate::drivers::windows_driver::WindowsKeyboardDriver::new() {
            Ok(driver) => {
                info!("Using native Windows SendInput virtual keyboard driver");
                return Box::new(driver);
            }
            Err(err) => {
                tracing::warn!(
                    error = %err,
                    "Failed to initialize Windows SendInput keyboard driver; falling back to MockKeyboardDriver"
                );
            }
        }
    }

    info!("Using MockKeyboardDriver (development / test mode)");
    Box::new(MockKeyboardDriver::new())
}
