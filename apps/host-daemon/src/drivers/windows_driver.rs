//! Native Windows Virtual Mouse and Keyboard Drivers via Win32 `SendInput`.
//!
//! Provides hardware-level mouse cursor motion, multi-button clicks, scroll wheel,
//! full HID keyboard mapping, and consumer media key actions on Windows.

use crate::drivers::keyboard_driver::VirtualKeyboardDriver;
use crate::drivers::mouse_driver::VirtualMouseDriver;
use crate::drivers::DriverError;
use std::collections::HashSet;
use tracing::{debug, info};

#[cfg(target_os = "windows")]
mod ffi {
    pub const INPUT_MOUSE: u32 = 0;
    pub const INPUT_KEYBOARD: u32 = 1;

    pub const MOUSEEVENTF_MOVE: u32 = 0x0001;
    pub const MOUSEEVENTF_LEFTDOWN: u32 = 0x0002;
    pub const MOUSEEVENTF_LEFTUP: u32 = 0x0004;
    pub const MOUSEEVENTF_RIGHTDOWN: u32 = 0x0008;
    pub const MOUSEEVENTF_RIGHTUP: u32 = 0x0010;
    pub const MOUSEEVENTF_MIDDLEDOWN: u32 = 0x0020;
    pub const MOUSEEVENTF_MIDDLEUP: u32 = 0x0040;
    pub const MOUSEEVENTF_WHEEL: u32 = 0x0800;
    pub const MOUSEEVENTF_HWHEEL: u32 = 0x1000;

    pub const KEYEVENTF_EXTENDEDKEY: u32 = 0x0001;
    pub const KEYEVENTF_KEYUP: u32 = 0x0002;

    pub const WHEEL_DELTA: i32 = 120;

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct MOUSEINPUT {
        pub dx: i32,
        pub dy: i32,
        pub mouse_data: u32,
        pub dw_flags: u32,
        pub time: u32,
        pub dw_extra_info: usize,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct KEYBDINPUT {
        pub w_vk: u16,
        pub w_scan: u16,
        pub dw_flags: u32,
        pub time: u32,
        pub dw_extra_info: usize,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub union INPUT_UNION {
        pub mi: MOUSEINPUT,
        pub ki: KEYBDINPUT,
        pub padding: [u8; 32],
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct INPUT {
        pub r#type: u32,
        pub u: INPUT_UNION,
    }

    #[link(name = "user32")]
    extern "system" {
        pub fn SendInput(c_inputs: u32, p_inputs: *const INPUT, cb_size: i32) -> u32;
    }
}

/// Native Windows Mouse Driver using Win32 `SendInput`.
#[derive(Debug, Default)]
pub struct WindowsMouseDriver {
    pub buttons_mask: u8,
}

impl WindowsMouseDriver {
    /// Creates and initializes a new WindowsMouseDriver.
    pub fn new() -> Result<Self, DriverError> {
        info!("Initializing native Windows SendInput virtual mouse driver...");
        Ok(Self { buttons_mask: 0 })
    }

    #[cfg(target_os = "windows")]
    fn send_mouse_input(&self, flags: u32, dx: i32, dy: i32, data: u32) -> Result<(), DriverError> {
        let input = ffi::INPUT {
            r#type: ffi::INPUT_MOUSE,
            u: ffi::INPUT_UNION {
                mi: ffi::MOUSEINPUT {
                    dx,
                    dy,
                    mouse_data: data,
                    dw_flags: flags,
                    time: 0,
                    dw_extra_info: 0,
                },
            },
        };

        let sent = unsafe { ffi::SendInput(1, &input, std::mem::size_of::<ffi::INPUT>() as i32) };

        if sent == 1 {
            Ok(())
        } else {
            Err(DriverError::Communication(
                "SendInput failed to post mouse event".into(),
            ))
        }
    }
}

impl VirtualMouseDriver for WindowsMouseDriver {
    fn move_relative(&mut self, dx: i32, dy: i32) -> Result<(), DriverError> {
        #[cfg(target_os = "windows")]
        {
            self.send_mouse_input(ffi::MOUSEEVENTF_MOVE, dx, dy, 0)?;
            debug!(dx, dy, "WindowsMouseDriver move_relative");
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = (dx, dy);
            Err(DriverError::DriverUnavailable(
                "WindowsMouseDriver is only available on Windows".into(),
            ))
        }
    }

    fn button_down(&mut self, button: u8) -> Result<(), DriverError> {
        #[cfg(target_os = "windows")]
        {
            self.buttons_mask |= button;
            let flag = match button {
                0x01 => ffi::MOUSEEVENTF_LEFTDOWN,
                0x02 => ffi::MOUSEEVENTF_RIGHTDOWN,
                0x04 => ffi::MOUSEEVENTF_MIDDLEDOWN,
                _ => ffi::MOUSEEVENTF_LEFTDOWN,
            };

            self.send_mouse_input(flag, 0, 0, 0)?;
            debug!(button, "WindowsMouseDriver button_down");
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = button;
            Err(DriverError::DriverUnavailable(
                "WindowsMouseDriver is only available on Windows".into(),
            ))
        }
    }

    fn button_up(&mut self, button: u8) -> Result<(), DriverError> {
        #[cfg(target_os = "windows")]
        {
            self.buttons_mask &= !button;
            let flag = match button {
                0x01 => ffi::MOUSEEVENTF_LEFTUP,
                0x02 => ffi::MOUSEEVENTF_RIGHTUP,
                0x04 => ffi::MOUSEEVENTF_MIDDLEUP,
                _ => ffi::MOUSEEVENTF_LEFTUP,
            };

            self.send_mouse_input(flag, 0, 0, 0)?;
            debug!(button, "WindowsMouseDriver button_up");
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = button;
            Err(DriverError::DriverUnavailable(
                "WindowsMouseDriver is only available on Windows".into(),
            ))
        }
    }

    fn scroll(&mut self, scroll_v: i8, scroll_h: i8) -> Result<(), DriverError> {
        #[cfg(target_os = "windows")]
        {
            if scroll_v != 0 {
                let delta = (scroll_v as i32) * ffi::WHEEL_DELTA;
                self.send_mouse_input(ffi::MOUSEEVENTF_WHEEL, 0, 0, delta as u32)?;
            }
            if scroll_h != 0 {
                let delta = (scroll_h as i32) * ffi::WHEEL_DELTA;
                self.send_mouse_input(ffi::MOUSEEVENTF_HWHEEL, 0, 0, delta as u32)?;
            }
            debug!(scroll_v, scroll_h, "WindowsMouseDriver scroll");
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = (scroll_v, scroll_h);
            Err(DriverError::DriverUnavailable(
                "WindowsMouseDriver is only available on Windows".into(),
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
        debug!("WindowsMouseDriver neutralized");
        Ok(())
    }
}

/// Native Windows Keyboard & Media Driver using Win32 `SendInput`.
#[derive(Debug, Default)]
pub struct WindowsKeyboardDriver {
    pub pressed_keys: HashSet<u16>,
    pub active_modifiers: u8,
}

impl WindowsKeyboardDriver {
    /// Creates and initializes a new WindowsKeyboardDriver.
    pub fn new() -> Result<Self, DriverError> {
        info!("Initializing native Windows SendInput virtual keyboard driver...");
        Ok(Self {
            pressed_keys: HashSet::new(),
            active_modifiers: 0,
        })
    }

    /// Maps USB HID Usage ID (0x04..0xE7) to Win32 Virtual-Key Code.
    pub fn hid_to_win32_vk(hid_code: u16) -> Option<u16> {
        match hid_code {
            0x04..=0x1D => Some(0x41 + (hid_code - 0x04)), // A-Z (0x41-0x5A)
            0x1E..=0x26 => Some(0x31 + (hid_code - 0x1E)), // 1-9 (0x31-0x39)
            0x27 => Some(0x30),                            // 0 (0x30)
            0x28 => Some(0x0D),                            // Return / Enter (VK_RETURN)
            0x29 => Some(0x1B),                            // Escape (VK_ESCAPE)
            0x2A => Some(0x08),                            // Backspace (VK_BACK)
            0x2B => Some(0x09),                            // Tab (VK_TAB)
            0x2C => Some(0x20),                            // Space (VK_SPACE)
            0x2D => Some(0xBD),                            // - (VK_OEM_MINUS)
            0x2E => Some(0xBB),                            // = (VK_OEM_PLUS)
            0x2F => Some(0xDB),                            // [ (VK_OEM_4)
            0x30 => Some(0xDD),                            // ] (VK_OEM_6)
            0x31 => Some(0xDC),                            // \ (VK_OEM_5)
            0x33 => Some(0xBA),                            // ; (VK_OEM_1)
            0x34 => Some(0xDE),                            // ' (VK_OEM_7)
            0x35 => Some(0xC0),                            // ` (VK_OEM_3)
            0x36 => Some(0xBC),                            // , (VK_OEM_COMMA)
            0x37 => Some(0xBE),                            // . (VK_OEM_PERIOD)
            0x38 => Some(0xBF),                            // / (VK_OEM_2)
            0x39 => Some(0x14),                            // CapsLock (VK_CAPITAL)
            0x3A..=0x45 => Some(0x70 + (hid_code - 0x3A)), // F1-F12 (VK_F1-VK_F12)
            0x4A => Some(0x24),                            // Home (VK_HOME)
            0x4B => Some(0x21),                            // PageUp (VK_PRIOR)
            0x4C => Some(0x2E),                            // Delete (VK_DELETE)
            0x4D => Some(0x23),                            // End (VK_END)
            0x4E => Some(0x22),                            // PageDown (VK_NEXT)
            0x4F => Some(0x27),                            // RightArrow (VK_RIGHT)
            0x50 => Some(0x25),                            // LeftArrow (VK_LEFT)
            0x51 => Some(0x28),                            // DownArrow (VK_DOWN)
            0x52 => Some(0x26),                            // UpArrow (VK_UP)
            0xE0 => Some(0xA2),                            // LeftCtrl (VK_LCONTROL)
            0xE1 => Some(0xA0),                            // LeftShift (VK_LSHIFT)
            0xE2 => Some(0x12),                            // LeftAlt (VK_MENU)
            0xE3 => Some(0x5B),                            // LeftGUI (VK_LWIN)
            0xE4 => Some(0xA3),                            // RightCtrl (VK_RCONTROL)
            0xE5 => Some(0xA1),                            // RightShift (VK_RSHIFT)
            0xE6 => Some(0xA5),                            // RightAlt (VK_RMENU)
            0xE7 => Some(0x5C),                            // RightGUI (VK_RWIN)
            _ => None,
        }
    }

    #[cfg(target_os = "windows")]
    fn send_key(&self, vk: u16, key_up: bool) -> Result<(), DriverError> {
        let flags = if key_up { ffi::KEYEVENTF_KEYUP } else { 0 };
        let input = ffi::INPUT {
            r#type: ffi::INPUT_KEYBOARD,
            u: ffi::INPUT_UNION {
                ki: ffi::KEYBDINPUT {
                    w_vk: vk,
                    w_scan: 0,
                    dw_flags: flags,
                    time: 0,
                    dw_extra_info: 0,
                },
            },
        };

        let sent = unsafe { ffi::SendInput(1, &input, std::mem::size_of::<ffi::INPUT>() as i32) };

        if sent == 1 {
            Ok(())
        } else {
            Err(DriverError::Communication(
                "SendInput failed to post keyboard event".into(),
            ))
        }
    }
}

impl VirtualKeyboardDriver for WindowsKeyboardDriver {
    fn key_event(&mut self, key_code: u16, state: u8, modifiers: u8) -> Result<(), DriverError> {
        #[cfg(target_os = "windows")]
        {
            self.active_modifiers = modifiers;
            if state == 1 || state == 2 {
                self.pressed_keys.insert(key_code);
            } else if state == 0 {
                self.pressed_keys.remove(&key_code);
            }

            if let Some(vk) = Self::hid_to_win32_vk(key_code) {
                self.send_key(vk, state == 0)?;
            } else {
                debug!(key_code, "Unmapped HID keycode on Windows");
            }
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = (key_code, state, modifiers);
            Err(DriverError::DriverUnavailable(
                "WindowsKeyboardDriver is only available on Windows".into(),
            ))
        }
    }

    fn media_action(&mut self, action: u8) -> Result<(), DriverError> {
        #[cfg(target_os = "windows")]
        {
            let vk = match action {
                1 => Some(0xB3), // VK_MEDIA_PLAY_PAUSE
                2 => Some(0xB2), // VK_MEDIA_STOP
                3 => Some(0xB0), // VK_MEDIA_NEXT_TRACK
                4 => Some(0xB1), // VK_MEDIA_PREV_TRACK
                5 => Some(0xAF), // VK_VOLUME_UP
                6 => Some(0xAE), // VK_VOLUME_DOWN
                7 => Some(0xAD), // VK_VOLUME_MUTE
                _ => None,
            };

            if let Some(code) = vk {
                self.send_key(code, false)?;
                self.send_key(code, true)?;
            }
            debug!(action, "WindowsKeyboardDriver media_action executed");
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = action;
            Err(DriverError::DriverUnavailable(
                "WindowsKeyboardDriver is only available on Windows".into(),
            ))
        }
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        #[cfg(target_os = "windows")]
        {
            for key_code in self.pressed_keys.drain() {
                if let Some(vk) = Self::hid_to_win32_vk(key_code) {
                    let _ = self.send_key(vk, true);
                }
            }
            self.active_modifiers = 0;
            debug!("WindowsKeyboardDriver neutralized");
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            self.pressed_keys.clear();
            self.active_modifiers = 0;
            Ok(())
        }
    }
}
