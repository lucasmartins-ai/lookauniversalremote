//! Linux `/dev/uinput` Virtual Gamepad Driver (Xbox 360 controller emulation).

use crate::drivers::{DriverError, VirtualGamepadDriver};
#[allow(unused_imports)]
use lookaremote_protocol::messages::{buttons, GamepadFullMessage};

#[cfg(target_os = "linux")]
use evdev::uinput::{VirtualDevice, VirtualDeviceBuilder};
#[cfg(target_os = "linux")]
use evdev::{
    AbsInfo, AbsoluteAxisType, AttributeSet, BusType, EventType,
    InputEvent as EvdevInputEvent, InputId, Key, SynchronizationCode, UinputAbsSetup,
};
#[cfg(target_os = "linux")]
use tracing::{debug, info, warn};

/// Virtual Xbox 360 Controller for Linux via `/dev/uinput`.
pub struct UInputGamepadDriver {
    #[cfg(target_os = "linux")]
    device: VirtualDevice,
}

#[cfg(target_os = "linux")]
impl UInputGamepadDriver {
    /// Creates and registers a new virtual Xbox 360 controller on `/dev/uinput`.
    pub fn new() -> Result<Self, DriverError> {
        info!("Initializing Linux /dev/uinput virtual Xbox 360 gamepad driver...");

        let mut keys = AttributeSet::<Key>::new();
        keys.insert(Key::BTN_A);
        keys.insert(Key::BTN_B);
        keys.insert(Key::BTN_X);
        keys.insert(Key::BTN_Y);
        keys.insert(Key::BTN_TL);
        keys.insert(Key::BTN_TR);
        keys.insert(Key::BTN_THUMBL);
        keys.insert(Key::BTN_THUMBR);
        keys.insert(Key::BTN_START);
        keys.insert(Key::BTN_SELECT);
        keys.insert(Key::BTN_MODE); // Guide / Home
        keys.insert(Key::BTN_DPAD_UP);
        keys.insert(Key::BTN_DPAD_DOWN);
        keys.insert(Key::BTN_DPAD_LEFT);
        keys.insert(Key::BTN_DPAD_RIGHT);

        let stick_abs = AbsInfo::new(0, -32768, 32767, 16, 128, 0);
        let trigger_abs = AbsInfo::new(0, 0, 255, 0, 0, 0);

        let abs_x = UinputAbsSetup::new(AbsoluteAxisType::ABS_X, stick_abs);
        let abs_y = UinputAbsSetup::new(AbsoluteAxisType::ABS_Y, stick_abs);
        let abs_rx = UinputAbsSetup::new(AbsoluteAxisType::ABS_RX, stick_abs);
        let abs_ry = UinputAbsSetup::new(AbsoluteAxisType::ABS_RY, stick_abs);
        let abs_z = UinputAbsSetup::new(AbsoluteAxisType::ABS_Z, trigger_abs); // LT
        let abs_rz = UinputAbsSetup::new(AbsoluteAxisType::ABS_RZ, trigger_abs); // RT

        let input_id = InputId::new(BusType::BUS_USB, 0x045e, 0x028e, 0x0114);

        let device = VirtualDeviceBuilder::new()
            .map_err(|e| DriverError::DeviceNotFound(format!("Failed to open /dev/uinput: {e}")))?
            .name("LookARemote Virtual Xbox Controller")
            .input_id(input_id)
            .with_keys(&keys)
            .map_err(|e| DriverError::Internal(format!("Failed to register keys: {e}")))?
            .with_absolute_axis(&abs_x)
            .map_err(|e| DriverError::Internal(format!("Failed to register ABS_X: {e}")))?
            .with_absolute_axis(&abs_y)
            .map_err(|e| DriverError::Internal(format!("Failed to register ABS_Y: {e}")))?
            .with_absolute_axis(&abs_rx)
            .map_err(|e| DriverError::Internal(format!("Failed to register ABS_RX: {e}")))?
            .with_absolute_axis(&abs_ry)
            .map_err(|e| DriverError::Internal(format!("Failed to register ABS_RY: {e}")))?
            .with_absolute_axis(&abs_z)
            .map_err(|e| DriverError::Internal(format!("Failed to register ABS_Z: {e}")))?
            .with_absolute_axis(&abs_rz)
            .map_err(|e| DriverError::Internal(format!("Failed to register ABS_RZ: {e}")))?
            .build()
            .map_err(|e| DriverError::PermissionDenied(format!("Failed to build uinput virtual device (check /dev/uinput permissions): {e}")))?;

        info!("Successfully created Linux /dev/uinput virtual Xbox 360 controller");
        Ok(Self { device })
    }

    fn emit_events(&mut self, events: &[EvdevInputEvent]) -> Result<(), DriverError> {
        self.device
            .emit(events)
            .map_err(|e| DriverError::Io(e))?;
        Ok(())
    }
}

#[cfg(target_os = "linux")]
impl VirtualGamepadDriver for UInputGamepadDriver {
    fn update_gamepad(&mut self, msg: &GamepadFullMessage) -> Result<(), DriverError> {
        let key_val = |mask: u16| -> i32 {
            if (msg.buttons & mask) != 0 {
                1
            } else {
                0
            }
        };

        let events = [
            // Buttons
            EvdevInputEvent::new(EventType::KEY, Key::BTN_A.code(), key_val(buttons::BTN_SOUTH)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_B.code(), key_val(buttons::BTN_EAST)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_X.code(), key_val(buttons::BTN_WEST)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_Y.code(), key_val(buttons::BTN_NORTH)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_TL.code(), key_val(buttons::BTN_L1)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_TR.code(), key_val(buttons::BTN_R1)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_THUMBL.code(), key_val(buttons::BTN_L3)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_THUMBR.code(), key_val(buttons::BTN_R3)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_START.code(), key_val(buttons::BTN_START)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_SELECT.code(), key_val(buttons::BTN_SELECT)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_MODE.code(), key_val(buttons::BTN_GUIDE)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_DPAD_UP.code(), key_val(buttons::DPAD_UP)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_DPAD_DOWN.code(), key_val(buttons::DPAD_DOWN)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_DPAD_LEFT.code(), key_val(buttons::DPAD_LEFT)),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_DPAD_RIGHT.code(), key_val(buttons::DPAD_RIGHT)),
            // Analog Axes
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_X.0, msg.stick_lx as i32),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_Y.0, msg.stick_ly as i32),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_RX.0, msg.stick_rx as i32),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_RY.0, msg.stick_ry as i32),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_Z.0, msg.trigger_l as i32),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_RZ.0, msg.trigger_r as i32),
            // Synchronization Report
            EvdevInputEvent::new(EventType::SYNCHRONIZATION, SynchronizationCode::SYN_REPORT.0, 0),
        ];

        self.emit_events(&events)
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        let events = [
            EvdevInputEvent::new(EventType::KEY, Key::BTN_A.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_B.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_X.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_Y.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_TL.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_TR.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_THUMBL.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_THUMBR.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_START.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_SELECT.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_MODE.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_DPAD_UP.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_DPAD_DOWN.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_DPAD_LEFT.code(), 0),
            EvdevInputEvent::new(EventType::KEY, Key::BTN_DPAD_RIGHT.code(), 0),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_X.0, 0),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_Y.0, 0),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_RX.0, 0),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_RY.0, 0),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_Z.0, 0),
            EvdevInputEvent::new(EventType::ABSOLUTE, AbsoluteAxisType::ABS_RZ.0, 0),
            EvdevInputEvent::new(EventType::SYNCHRONIZATION, SynchronizationCode::SYN_REPORT.0, 0),
        ];

        self.emit_events(&events)
    }
}

#[cfg(not(target_os = "linux"))]
impl UInputGamepadDriver {
    pub fn new() -> Result<Self, DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputGamepadDriver is only supported on Linux".into(),
        ))
    }
}

#[cfg(not(target_os = "linux"))]
impl VirtualGamepadDriver for UInputGamepadDriver {
    fn update_gamepad(&mut self, _msg: &GamepadFullMessage) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputGamepadDriver is only supported on Linux".into(),
        ))
    }

    fn neutralize(&mut self) -> Result<(), DriverError> {
        Err(DriverError::DriverUnavailable(
            "UInputGamepadDriver is only supported on Linux".into(),
        ))
    }
}
