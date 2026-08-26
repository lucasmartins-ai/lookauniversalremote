//! Native macOS Virtual Mouse and Keyboard Drivers via CoreGraphics `CGEvent`.
//!
//! Provides hardware-level mouse cursor motion, multi-button clicks, smooth scrolling,
//! full HID keyboard mapping, and consumer media key actions on macOS.

use crate::drivers::keyboard_driver::VirtualKeyboardDriver;
use crate::drivers::mouse_driver::VirtualMouseDriver;
use crate::drivers::DriverError;
use std::collections::HashSet;
use tracing::{debug, info};

#[cfg(target_os = "macos")]
#[allow(non_upper_case_globals, dead_code, non_snake_case)]
mod ffi {
    use std::ffi::c_void;

    pub type CGEventRef = *mut c_void;
    pub type CGEventSourceRef = *mut c_void;
    pub type CGEventType = u32;
    pub type CGMouseButton = u32;
    pub type CGEventTapLocation = u32;
    pub type CGEventField = u32;
    pub type CGEventFlags = u64;
    pub type CGKeyCode = u16;
    pub type CGScrollEventUnit = u32;

    #[repr(C)]
    #[derive(Debug, Clone, Copy, PartialEq)]
    pub struct CGPoint {
        pub x: f64,
        pub y: f64,
    }

    pub const kCGHIDEventTap: CGEventTapLocation = 0;

    pub const kCGEventLeftMouseDown: CGEventType = 1;
    pub const kCGEventLeftMouseUp: CGEventType = 2;
    pub const kCGEventRightMouseDown: CGEventType = 3;
    pub const kCGEventRightMouseUp: CGEventType = 4;
    pub const kCGEventMouseMoved: CGEventType = 5;
    pub const kCGEventLeftMouseDragged: CGEventType = 6;
    pub const kCGEventRightMouseDragged: CGEventType = 7;
    pub const kCGEventOtherMouseDown: CGEventType = 25;
    pub const kCGEventOtherMouseUp: CGEventType = 26;
    pub const kCGEventOtherMouseDragged: CGEventType = 27;

    pub const kCGMouseButtonLeft: CGMouseButton = 0;
    pub const kCGMouseButtonRight: CGMouseButton = 1;
    pub const kCGMouseButtonCenter: CGMouseButton = 2;

    pub const kCGScrollEventUnitLine: CGScrollEventUnit = 1;

    pub const kCGMouseEventDeltaX: CGEventField = 4;
    pub const kCGMouseEventDeltaY: CGEventField = 5;

    pub const kCGEventFlagMaskShift: CGEventFlags = 0x00020000;
    pub const kCGEventFlagMaskControl: CGEventFlags = 0x00040000;
    pub const kCGEventFlagMaskAlternate: CGEventFlags = 0x00080000;
    pub const kCGEventFlagMaskCommand: CGEventFlags = 0x00100000;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        pub fn CGEventCreate(source: CGEventSourceRef) -> CGEventRef;
        pub fn CGEventGetLocation(event: CGEventRef) -> CGPoint;
        pub fn CGEventCreateMouseEvent(
            source: CGEventSourceRef,
            mouseType: CGEventType,
            mouseCursorPosition: CGPoint,
            mouseButton: CGMouseButton,
        ) -> CGEventRef;
        pub fn CGEventCreateScrollWheelEvent2(
            source: CGEventSourceRef,
            units: CGScrollEventUnit,
            wheelCount: u32,
            wheel1: i32,
            wheel2: i32,
            wheel3: i32,
        ) -> CGEventRef;
        pub fn CGEventCreateKeyboardEvent(
            source: CGEventSourceRef,
            virtualKey: CGKeyCode,
            keyDown: bool,
        ) -> CGEventRef;
        pub fn CGEventSetFlags(event: CGEventRef, flags: CGEventFlags);
        pub fn CGEventSetIntegerValueField(event: CGEventRef, field: CGEventField, value: i64);
        pub fn CGEventPost(tap: CGEventTapLocation, event: CGEventRef);
        pub fn CFRelease(cf: *const c_void);
    }
}

/// Native macOS Mouse Driver using Apple CoreGraphics framework.
#[derive(Debug, Default)]
pub struct MacOSMouseDriver {
    pub buttons_mask: u8,
}

impl MacOSMouseDriver {
    /// Creates and initializes a new MacOSMouseDriver.
    pub fn new() -> Result<Self, DriverError> {
        info!("Initializing native macOS CoreGraphics virtual mouse driver...");
        Ok(Self { buttons_mask: 0 })
    }

    #[cfg(target_os = "macos")]
    fn current_cursor_position() -> ffi::CGPoint {
        unsafe {
            let dummy = ffi::CGEventCreate(std::ptr::null_mut());
            if !dummy.is_null() {
                let loc = ffi::CGEventGetLocation(dummy);
                ffi::CFRelease(dummy as _);
                loc
            } else {
                ffi::CGPoint { x: 0.0, y: 0.0 }
            }
        }
    }
}

impl VirtualMouseDriver for MacOSMouseDriver {
    fn move_relative(&mut self, dx: i32, dy: i32) -> Result<(), DriverError> {
        #[cfg(target_os = "macos")]
        {
            let current = Self::current_cursor_position();
            let new_pos = ffi::CGPoint {
                x: current.x + dx as f64,
                y: current.y + dy as f64,
            };

            let event_type = if (self.buttons_mask & 0x01) != 0 {
                ffi::kCGEventLeftMouseDragged
            } else if (self.buttons_mask & 0x02) != 0 {
                ffi::kCGEventRightMouseDragged
            } else if (self.buttons_mask & 0x04) != 0 {
                ffi::kCGEventOtherMouseDragged
            } else {
                ffi::kCGEventMouseMoved
            };

            let btn = if (self.buttons_mask & 0x02) != 0 {
                ffi::kCGMouseButtonRight
            } else if (self.buttons_mask & 0x04) != 0 {
                ffi::kCGMouseButtonCenter
            } else {
                ffi::kCGMouseButtonLeft
            };

            let ev = unsafe {
                ffi::CGEventCreateMouseEvent(std::ptr::null_mut(), event_type, new_pos, btn)
            };

            if !ev.is_null() {
                unsafe {
                    ffi::CGEventSetIntegerValueField(ev, ffi::kCGMouseEventDeltaX, dx as i64);
                    ffi::CGEventSetIntegerValueField(ev, ffi::kCGMouseEventDeltaY, dy as i64);
                    ffi::CGEventPost(ffi::kCGHIDEventTap, ev);
                    ffi::CFRelease(ev as _);
                }
            }
            debug!(dx, dy, "MacOSMouseDriver move_relative");
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = (dx, dy);
            Err(DriverError::DriverUnavailable(
                "MacOSMouseDriver is only available on macOS".into(),
            ))
        }
    }

    fn button_down(&mut self, button: u8) -> Result<(), DriverError> {
        #[cfg(target_os = "macos")]
        {
            self.buttons_mask |= button;
            let current = Self::current_cursor_position();

            let (event_type, btn) = match button {
                0x01 => (ffi::kCGEventLeftMouseDown, ffi::kCGMouseButtonLeft),
                0x02 => (ffi::kCGEventRightMouseDown, ffi::kCGMouseButtonRight),
                0x04 => (ffi::kCGEventOtherMouseDown, ffi::kCGMouseButtonCenter),
                _ => (ffi::kCGEventLeftMouseDown, ffi::kCGMouseButtonLeft),
            };

            let ev = unsafe {
                ffi::CGEventCreateMouseEvent(std::ptr::null_mut(), event_type, current, btn)
            };

            if !ev.is_null() {
                unsafe {
                    ffi::CGEventPost(ffi::kCGHIDEventTap, ev);
                    ffi::CFRelease(ev as _);
                }
            }
            debug!(button, "MacOSMouseDriver button_down");
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = button;
            Err(DriverError::DriverUnavailable(
                "MacOSMouseDriver is only available on macOS".into(),
            ))
        }
    }

    fn button_up(&mut self, button: u8) -> Result<(), DriverError> {
        #[cfg(target_os = "macos")]
        {
            self.buttons_mask &= !button;
            let current = Self::current_cursor_position();

            let (event_type, btn) = match button {
                0x01 => (ffi::kCGEventLeftMouseUp, ffi::kCGMouseButtonLeft),
                0x02 => (ffi::kCGEventRightMouseUp, ffi::kCGMouseButtonRight),
                0x04 => (ffi::kCGEventOtherMouseUp, ffi::kCGMouseButtonCenter),
                _ => (ffi::kCGEventLeftMouseUp, ffi::kCGMouseButtonLeft),
            };

            let ev = unsafe {
                ffi::CGEventCreateMouseEvent(std::ptr::null_mut(), event_type, current, btn)
            };

            if !ev.is_null() {
                unsafe {
                    ffi::CGEventPost(ffi::kCGHIDEventTap, ev);
                    ffi::CFRelease(ev as _);
                }
            }
            debug!(button, "MacOSMouseDriver button_up");
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = button;
            Err(DriverError::DriverUnavailable(
                "MacOSMouseDriver is only available on macOS".into(),
            ))
        }
    }

    fn scroll(&mut self, scroll_v: i8, scroll_h: i8) -> Result<(), DriverError> {
        #[cfg(target_os = "macos")]
        {
            let ev = unsafe {
                ffi::CGEventCreateScrollWheelEvent2(
                    std::ptr::null_mut(),
                    ffi::kCGScrollEventUnitLine,
                    2,
                    scroll_v as i32,
                    scroll_h as i32,
                    0,
                )
            };

            if !ev.is_null() {
                unsafe {
                    ffi::CGEventPost(ffi::kCGHIDEventTap, ev);
                    ffi::CFRelease(ev as _);
                }
            }
            debug!(scroll_v, scroll_h, "MacOSMouseDriver scroll");
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = (scroll_v, scroll_h);
            Err(DriverError::DriverUnavailable(
                "MacOSMouseDriver is only available on macOS".into(),
            ))
        }
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        if self.buttons_mask != 0 {
            let mask = self.buttons_mask;
            if (mask & 0x01) != 0 {
                let _ = self.button_up(0x01);
            }
            if (mask & 0x02) != 0 {
                let _ = self.button_up(0x02);
            }
            if (mask & 0x04) != 0 {
                let _ = self.button_up(0x04);
            }
        }
        self.buttons_mask = 0;
        debug!("MacOSMouseDriver neutralized");
        Ok(())
    }
}

/// Native macOS Keyboard & Media Driver using Apple CoreGraphics framework.
#[derive(Debug, Default)]
pub struct MacOSKeyboardDriver {
    pub pressed_keys: HashSet<u16>,
    pub active_modifiers: u8,
}

impl MacOSKeyboardDriver {
    /// Creates and initializes a new MacOSKeyboardDriver.
    pub fn new() -> Result<Self, DriverError> {
        info!("Initializing native macOS CoreGraphics virtual keyboard driver...");
        Ok(Self {
            pressed_keys: HashSet::new(),
            active_modifiers: 0,
        })
    }

    /// Maps USB HID Usage ID (0x04..0xE7) to macOS Virtual Key Code.
    pub fn hid_to_macos_vk(hid_code: u16) -> Option<u16> {
        match hid_code {
            0x04 => Some(0x00), // A
            0x05 => Some(0x0B), // B
            0x06 => Some(0x08), // C
            0x07 => Some(0x02), // D
            0x08 => Some(0x0E), // E
            0x09 => Some(0x03), // F
            0x0A => Some(0x05), // G
            0x0B => Some(0x04), // H
            0x0C => Some(0x22), // I
            0x0D => Some(0x26), // J
            0x0E => Some(0x28), // K
            0x0F => Some(0x25), // L
            0x10 => Some(0x2E), // M
            0x11 => Some(0x2D), // N
            0x12 => Some(0x1F), // O
            0x13 => Some(0x23), // P
            0x14 => Some(0x0C), // Q
            0x15 => Some(0x0F), // R
            0x16 => Some(0x01), // S
            0x17 => Some(0x11), // T
            0x18 => Some(0x20), // U
            0x19 => Some(0x09), // V
            0x1A => Some(0x0D), // W
            0x1B => Some(0x07), // X
            0x1C => Some(0x10), // Y
            0x1D => Some(0x06), // Z
            0x1E => Some(0x12), // 1
            0x1F => Some(0x13), // 2
            0x20 => Some(0x14), // 3
            0x21 => Some(0x15), // 4
            0x22 => Some(0x17), // 5
            0x23 => Some(0x16), // 6
            0x24 => Some(0x1A), // 7
            0x25 => Some(0x1C), // 8
            0x26 => Some(0x19), // 9
            0x27 => Some(0x1D), // 0
            0x28 => Some(0x24), // Return
            0x29 => Some(0x35), // Escape
            0x2A => Some(0x33), // Backspace
            0x2B => Some(0x30), // Tab
            0x2C => Some(0x31), // Space
            0x2D => Some(0x1B), // -
            0x2E => Some(0x18), // =
            0x2F => Some(0x21), // [
            0x30 => Some(0x1E), // ]
            0x31 => Some(0x2A), // \
            0x33 => Some(0x29), // ;
            0x34 => Some(0x27), // '
            0x35 => Some(0x32), // `
            0x36 => Some(0x2B), // ,
            0x37 => Some(0x2F), // .
            0x38 => Some(0x2C), // /
            0x39 => Some(0x39), // CapsLock
            0x3A => Some(0x7A), // F1
            0x3B => Some(0x78), // F2
            0x3C => Some(0x63), // F3
            0x3D => Some(0x76), // F4
            0x3E => Some(0x60), // F5
            0x3F => Some(0x61), // F6
            0x40 => Some(0x62), // F7
            0x41 => Some(0x64), // F8
            0x42 => Some(0x65), // F9
            0x43 => Some(0x6D), // F10
            0x44 => Some(0x67), // F11
            0x45 => Some(0x6F), // F12
            0x4A => Some(0x73), // Home
            0x4B => Some(0x74), // PageUp
            0x4C => Some(0x75), // Delete
            0x4D => Some(0x77), // End
            0x4E => Some(0x79), // PageDown
            0x4F => Some(0x7C), // RightArrow
            0x50 => Some(0x7B), // LeftArrow
            0x51 => Some(0x7D), // DownArrow
            0x52 => Some(0x7E), // UpArrow
            0xE0 => Some(0x3B), // LeftCtrl
            0xE1 => Some(0x38), // LeftShift
            0xE2 => Some(0x3A), // LeftAlt / Option
            0xE3 => Some(0x37), // LeftGUI / Command
            0xE4 => Some(0x3E), // RightCtrl
            0xE5 => Some(0x3C), // RightShift
            0xE6 => Some(0x3D), // RightAlt / Option
            0xE7 => Some(0x37), // RightGUI / Command
            _ => None,
        }
    }
}

impl VirtualKeyboardDriver for MacOSKeyboardDriver {
    fn key_event(&mut self, key_code: u16, state: u8, modifiers: u8) -> Result<(), DriverError> {
        #[cfg(target_os = "macos")]
        {
            self.active_modifiers = modifiers;
            if state == 1 || state == 2 {
                self.pressed_keys.insert(key_code);
            } else if state == 0 {
                self.pressed_keys.remove(&key_code);
            }

            if let Some(vk) = Self::hid_to_macos_vk(key_code) {
                let ev = unsafe {
                    ffi::CGEventCreateKeyboardEvent(std::ptr::null_mut(), vk, state != 0)
                };
                if !ev.is_null() {
                    let mut flags: ffi::CGEventFlags = 0;
                    if (modifiers & 0x01) != 0 {
                        flags |= ffi::kCGEventFlagMaskControl;
                    }
                    if (modifiers & 0x02) != 0 {
                        flags |= ffi::kCGEventFlagMaskShift;
                    }
                    if (modifiers & 0x04) != 0 {
                        flags |= ffi::kCGEventFlagMaskAlternate;
                    }
                    if (modifiers & 0x08) != 0 {
                        flags |= ffi::kCGEventFlagMaskCommand;
                    }
                    unsafe {
                        ffi::CGEventSetFlags(ev, flags);
                        ffi::CGEventPost(ffi::kCGHIDEventTap, ev);
                        ffi::CFRelease(ev as _);
                    }
                }
            } else {
                debug!(key_code, "Unmapped HID keycode on macOS");
            }
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = (key_code, state, modifiers);
            Err(DriverError::DriverUnavailable(
                "MacOSKeyboardDriver is only available on macOS".into(),
            ))
        }
    }

    fn media_action(&mut self, action: u8) -> Result<(), DriverError> {
        #[cfg(target_os = "macos")]
        {
            // Consumer media actions mapped to macOS virtual keys / system keys:
            // 1: Play/Pause, 2: Stop, 3: Next, 4: Prev, 5: VolUp, 6: VolDown, 7: Mute
            let vk = match action {
                5 => Some(0x48), // Volume Up
                6 => Some(0x49), // Volume Down
                7 => Some(0x4A), // Mute
                _ => None,
            };

            if let Some(code) = vk {
                // Post down then up
                let ev_down = unsafe {
                    ffi::CGEventCreateKeyboardEvent(std::ptr::null_mut(), code, true)
                };
                let ev_up = unsafe {
                    ffi::CGEventCreateKeyboardEvent(std::ptr::null_mut(), code, false)
                };
                if !ev_down.is_null() {
                    unsafe {
                        ffi::CGEventPost(ffi::kCGHIDEventTap, ev_down);
                        ffi::CFRelease(ev_down as _);
                    }
                }
                if !ev_up.is_null() {
                    unsafe {
                        ffi::CGEventPost(ffi::kCGHIDEventTap, ev_up);
                        ffi::CFRelease(ev_up as _);
                    }
                }
            }
            debug!(action, "MacOSKeyboardDriver media_action executed");
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = action;
            Err(DriverError::DriverUnavailable(
                "MacOSKeyboardDriver is only available on macOS".into(),
            ))
        }
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        #[cfg(target_os = "macos")]
        {
            for key_code in self.pressed_keys.drain() {
                if let Some(vk) = Self::hid_to_macos_vk(key_code) {
                    let ev = unsafe {
                        ffi::CGEventCreateKeyboardEvent(std::ptr::null_mut(), vk, false)
                    };
                    if !ev.is_null() {
                        unsafe {
                            ffi::CGEventPost(ffi::kCGHIDEventTap, ev);
                            ffi::CFRelease(ev as _);
                        }
                    }
                }
            }
            self.active_modifiers = 0;
            debug!("MacOSKeyboardDriver neutralized");
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            self.pressed_keys.clear();
            self.active_modifiers = 0;
            Ok(())
        }
    }
}
