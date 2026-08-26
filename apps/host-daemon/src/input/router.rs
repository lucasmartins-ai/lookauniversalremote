//! High-speed input event routing to OS virtual drivers with safety watchdog integration.

use crate::drivers::keyboard_driver::create_platform_keyboard_driver;
use crate::drivers::mouse_driver::create_platform_mouse_driver;
use crate::drivers::{DriverError, VirtualGamepadDriver, VirtualKeyboardDriver, VirtualMouseDriver};
use crate::input::events::InputEvent;
use crate::input::motion_processor::{MotionAimMode, MotionProcessor};
use lookaremote_protocol::messages::GamepadFullMessage;
use std::sync::{Arc, Mutex};
use tracing::{trace, warn};

/// High-performance thread-safe Input Router.
/// Dispatches decoded incoming events to active OS virtual gamepad, mouse, and keyboard drivers.
#[derive(Clone)]
pub struct InputRouter {
    gamepad_driver: Arc<Mutex<Box<dyn VirtualGamepadDriver>>>,
    mouse_driver: Arc<Mutex<Box<dyn VirtualMouseDriver>>>,
    keyboard_driver: Arc<Mutex<Box<dyn VirtualKeyboardDriver>>>,
    motion_processor: Arc<Mutex<MotionProcessor>>,
    latest_gamepad_state: Arc<Mutex<Option<GamepadFullMessage>>>,
    last_touchpad_buttons: Arc<Mutex<u8>>,
}

impl InputRouter {
    /// Creates a new InputRouter with the provided virtual gamepad driver and default platform mouse & keyboard drivers.
    pub fn new(gamepad_driver: Box<dyn VirtualGamepadDriver>) -> Self {
        Self::with_drivers(
            gamepad_driver,
            create_platform_mouse_driver(),
            create_platform_keyboard_driver(),
        )
    }

    /// Creates a new InputRouter with explicit gamepad and mouse drivers.
    pub fn with_mouse_driver(
        gamepad_driver: Box<dyn VirtualGamepadDriver>,
        mouse_driver: Box<dyn VirtualMouseDriver>,
    ) -> Self {
        Self::with_drivers(gamepad_driver, mouse_driver, create_platform_keyboard_driver())
    }

    /// Creates a new InputRouter with explicit gamepad, mouse, and keyboard drivers.
    pub fn with_drivers(
        gamepad_driver: Box<dyn VirtualGamepadDriver>,
        mouse_driver: Box<dyn VirtualMouseDriver>,
        keyboard_driver: Box<dyn VirtualKeyboardDriver>,
    ) -> Self {
        Self::new_full(
            gamepad_driver,
            mouse_driver,
            keyboard_driver,
            MotionProcessor::default(),
        )
    }

    /// Creates a fully customizable InputRouter with custom motion processor settings.
    pub fn new_full(
        gamepad_driver: Box<dyn VirtualGamepadDriver>,
        mouse_driver: Box<dyn VirtualMouseDriver>,
        keyboard_driver: Box<dyn VirtualKeyboardDriver>,
        motion_processor: MotionProcessor,
    ) -> Self {
        Self {
            gamepad_driver: Arc::new(Mutex::new(gamepad_driver)),
            mouse_driver: Arc::new(Mutex::new(mouse_driver)),
            keyboard_driver: Arc::new(Mutex::new(keyboard_driver)),
            motion_processor: Arc::new(Mutex::new(motion_processor)),
            latest_gamepad_state: Arc::new(Mutex::new(None)),
            last_touchpad_buttons: Arc::new(Mutex::new(0)),
        }
    }

    /// Updates the motion aiming processor mode.
    pub fn set_motion_aim_mode(&self, mode: MotionAimMode) -> Result<(), DriverError> {
        let mut proc = self
            .motion_processor
            .lock()
            .map_err(|_| DriverError::Internal("Motion processor lock poisoned".into()))?;
        proc.set_mode(mode);
        Ok(())
    }

    /// Dispatches an InputEvent to the underlying virtual drivers.
    pub fn route_event(&self, event: &InputEvent) -> Result<(), DriverError> {
        match event {
            InputEvent::GamepadFull(msg) => {
                trace!(
                    buttons = msg.buttons,
                    lx = msg.stick_lx,
                    ly = msg.stick_ly,
                    rx = msg.stick_rx,
                    ry = msg.stick_ry,
                    lt = msg.trigger_l,
                    rt = msg.trigger_r,
                    "Routing GamepadFull event to virtual driver"
                );

                if let Ok(mut state) = self.latest_gamepad_state.lock() {
                    *state = Some(*msg);
                }

                let mut driver = self
                    .gamepad_driver
                    .lock()
                    .map_err(|_| DriverError::Internal("Failed to acquire gamepad driver lock".into()))?;
                driver.update_gamepad(msg)?;
            }

            InputEvent::Motion(m) => {
                trace!(
                    yaw = m.gyro_yaw,
                    pitch = m.gyro_pitch,
                    roll = m.gyro_roll,
                    "Routing Motion event in router"
                );

                let mut proc = self
                    .motion_processor
                    .lock()
                    .map_err(|_| DriverError::Internal("Failed to acquire motion processor lock".into()))?;

                match proc.config().mode {
                    MotionAimMode::Mouse => {
                        let (dx, dy) = proc.process_motion_to_mouse(m);
                        if dx != 0 || dy != 0 {
                            let mut mouse = self
                                .mouse_driver
                                .lock()
                                .map_err(|_| DriverError::Internal("Failed to acquire mouse driver lock".into()))?;
                            mouse.move_relative(dx, dy)?;
                        }
                    }

                    MotionAimMode::RightStickAdditive => {
                        let base_msg = {
                            let state = self.latest_gamepad_state.lock().ok();
                            state.and_then(|s| *s).unwrap_or_default()
                        };

                        let (new_rx, new_ry) =
                            proc.process_motion_to_stick(m, base_msg.stick_rx, base_msg.stick_ry);

                        let mut updated_msg = base_msg;
                        updated_msg.stick_rx = new_rx;
                        updated_msg.stick_ry = new_ry;

                        let mut driver = self
                            .gamepad_driver
                            .lock()
                            .map_err(|_| DriverError::Internal("Failed to acquire gamepad driver lock".into()))?;
                        driver.update_gamepad(&updated_msg)?;
                    }

                    MotionAimMode::Disabled => {}
                }
            }

            InputEvent::Touchpad(t) => {
                trace!(
                    dx = t.dx,
                    dy = t.dy,
                    scroll_v = t.scroll_v,
                    scroll_h = t.scroll_h,
                    buttons = t.buttons_mask,
                    "Routing Touchpad event to mouse driver"
                );
                let mut mouse = self
                    .mouse_driver
                    .lock()
                    .map_err(|_| DriverError::Internal("Failed to acquire mouse driver lock".into()))?;

                if t.dx != 0 || t.dy != 0 {
                    mouse.move_relative(t.dx as i32, t.dy as i32)?;
                }
                if t.scroll_v != 0 || t.scroll_h != 0 {
                    mouse.scroll(t.scroll_v, t.scroll_h)?;
                }

                // Handle button transitions & tap clicks
                let mut last_buttons = self
                    .last_touchpad_buttons
                    .lock()
                    .map_err(|_| DriverError::Internal("Failed to acquire touchpad buttons lock".into()))?;

                // Check Left (0x01), Right (0x02), Middle (0x04) button state transitions
                for &bit in &[0x01u8, 0x02u8, 0x04u8] {
                    let was_pressed = (*last_buttons & bit) != 0;
                    let is_pressed = (t.buttons_mask & bit) != 0;

                    if is_pressed && !was_pressed {
                        mouse.button_down(bit)?;
                    } else if !is_pressed && was_pressed {
                        mouse.button_up(bit)?;
                    }
                }

                // Tap-to-click momentary pulse (Bit 3)
                if (t.buttons_mask & 0x08) != 0 {
                    mouse.button_down(0x01)?;
                    mouse.button_up(0x01)?;
                }

                *last_buttons = t.buttons_mask & 0x07;
            }

            InputEvent::Keyboard(k) => {
                trace!(
                    key = k.key_code,
                    state = k.state,
                    modifiers = k.modifiers,
                    "Routing Keyboard event to virtual keyboard driver"
                );
                let mut keyboard = self
                    .keyboard_driver
                    .lock()
                    .map_err(|_| DriverError::Internal("Failed to acquire keyboard driver lock".into()))?;
                keyboard.key_event(k.key_code, k.state, k.modifiers)?;
            }

            InputEvent::Media(m) => {
                trace!(
                    action = m.media_action,
                    "Routing Media event to virtual keyboard driver"
                );
                let mut keyboard = self
                    .keyboard_driver
                    .lock()
                    .map_err(|_| DriverError::Internal("Failed to acquire keyboard driver lock".into()))?;
                keyboard.media_action(m.media_action)?;
            }

            InputEvent::EmergencyReset => {
                warn!("Received EmergencyReset event; neutralizing all virtual inputs immediately");
                self.neutralize()?;
            }

            InputEvent::ModeSwitch(_) => {
                // Handled by ContextWatcher in event loop
            }

            InputEvent::Heartbeat(_) => {
                // Handled in transport layer
            }

            InputEvent::HapticEvent(_) => {
                // Handled in host-to-client pipeline
            }
        }

        Ok(())
    }

    /// Neutralizes all inputs immediately (e.g. called by Dead-Man switch timeout or EmergencyReset).
    pub fn neutralize(&self) -> Result<(), DriverError> {
        // 1. Reset Gamepad Driver
        if let Ok(mut driver) = self.gamepad_driver.lock() {
            let _ = driver.neutralize();
        }

        // 2. Reset Mouse Driver
        if let Ok(mut mouse) = self.mouse_driver.lock() {
            let _ = mouse.neutralize();
        }

        // 3. Reset Keyboard Driver
        if let Ok(mut keyboard) = self.keyboard_driver.lock() {
            let _ = keyboard.neutralize();
        }

        // 4. Reset Motion Processor
        if let Ok(mut proc) = self.motion_processor.lock() {
            proc.neutralize();
        }

        // 5. Reset Touchpad buttons state & cached state
        if let Ok(mut buttons) = self.last_touchpad_buttons.lock() {
            *buttons = 0;
        }

        if let Ok(mut state) = self.latest_gamepad_state.lock() {
            *state = None;
        }

        Ok(())
    }
}
