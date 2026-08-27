//! High-speed input event routing to OS virtual drivers with safety watchdog integration.

use crate::drivers::keyboard_driver::create_platform_keyboard_driver;
use crate::drivers::mouse_driver::create_platform_mouse_driver;
use crate::drivers::{
    DriverError, VirtualGamepadDriver, VirtualKeyboardDriver, VirtualMouseDriver,
};
use crate::input::events::InputEvent;
use crate::input::motion_processor::{MotionAimMode, MotionProcessor};
use lookaremote_protocol::messages::GamepadFullMessage;
use std::sync::{Arc, Mutex};
use tracing::{trace, warn};

/// High-performance thread-safe Input Router.
/// Dispatches decoded incoming events to active OS virtual gamepad (P1..P4), mouse, and keyboard drivers.
#[derive(Clone)]
pub struct InputRouter {
    gamepad_drivers: [Arc<Mutex<Box<dyn VirtualGamepadDriver>>>; 4],
    mouse_driver: Arc<Mutex<Box<dyn VirtualMouseDriver>>>,
    keyboard_driver: Arc<Mutex<Box<dyn VirtualKeyboardDriver>>>,
    motion_processor: Arc<Mutex<MotionProcessor>>,
    tv_dispatcher: Arc<Mutex<crate::tv::TvDispatcher>>,
    latest_gamepad_state: [Arc<Mutex<Option<GamepadFullMessage>>>; 4],
    last_touchpad_buttons: Arc<Mutex<u8>>,
}

impl InputRouter {
    /// Creates a new InputRouter with the provided virtual gamepad driver for Player 1,
    /// auto-creating platform drivers for Player 2..4, and default mouse & keyboard drivers.
    pub fn new(gamepad_driver: Box<dyn VirtualGamepadDriver>) -> Self {
        let p2 = crate::drivers::create_platform_driver_for_slot(1);
        let p3 = crate::drivers::create_platform_driver_for_slot(2);
        let p4 = crate::drivers::create_platform_driver_for_slot(3);

        Self::with_multi_gamepad_drivers(
            gamepad_driver,
            p2,
            p3,
            p4,
            create_platform_mouse_driver(),
            create_platform_keyboard_driver(),
        )
    }

    /// Creates a new InputRouter with explicit gamepad and mouse drivers.
    pub fn with_mouse_driver(
        gamepad_driver: Box<dyn VirtualGamepadDriver>,
        mouse_driver: Box<dyn VirtualMouseDriver>,
    ) -> Self {
        let p2 = crate::drivers::create_platform_driver_for_slot(1);
        let p3 = crate::drivers::create_platform_driver_for_slot(2);
        let p4 = crate::drivers::create_platform_driver_for_slot(3);

        Self::with_multi_gamepad_drivers(
            gamepad_driver,
            p2,
            p3,
            p4,
            mouse_driver,
            create_platform_keyboard_driver(),
        )
    }

    /// Creates a new InputRouter with explicit gamepad, mouse, and keyboard drivers.
    pub fn with_drivers(
        gamepad_driver: Box<dyn VirtualGamepadDriver>,
        mouse_driver: Box<dyn VirtualMouseDriver>,
        keyboard_driver: Box<dyn VirtualKeyboardDriver>,
    ) -> Self {
        let p2 = crate::drivers::create_platform_driver_for_slot(1);
        let p3 = crate::drivers::create_platform_driver_for_slot(2);
        let p4 = crate::drivers::create_platform_driver_for_slot(3);

        Self::with_multi_gamepad_drivers(gamepad_driver, p2, p3, p4, mouse_driver, keyboard_driver)
    }

    /// Creates a new InputRouter with all 4 isolated player gamepad drivers explicitly provided.
    pub fn with_multi_gamepad_drivers(
        p1_gamepad: Box<dyn VirtualGamepadDriver>,
        p2_gamepad: Box<dyn VirtualGamepadDriver>,
        p3_gamepad: Box<dyn VirtualGamepadDriver>,
        p4_gamepad: Box<dyn VirtualGamepadDriver>,
        mouse_driver: Box<dyn VirtualMouseDriver>,
        keyboard_driver: Box<dyn VirtualKeyboardDriver>,
    ) -> Self {
        Self {
            gamepad_drivers: [
                Arc::new(Mutex::new(p1_gamepad)),
                Arc::new(Mutex::new(p2_gamepad)),
                Arc::new(Mutex::new(p3_gamepad)),
                Arc::new(Mutex::new(p4_gamepad)),
            ],
            mouse_driver: Arc::new(Mutex::new(mouse_driver)),
            keyboard_driver: Arc::new(Mutex::new(keyboard_driver)),
            motion_processor: Arc::new(Mutex::new(MotionProcessor::default())),
            tv_dispatcher: Arc::new(Mutex::new(crate::tv::TvDispatcher::new())),
            latest_gamepad_state: [
                Arc::new(Mutex::new(None)),
                Arc::new(Mutex::new(None)),
                Arc::new(Mutex::new(None)),
                Arc::new(Mutex::new(None)),
            ],
            last_touchpad_buttons: Arc::new(Mutex::new(0)),
        }
    }

    /// Creates a fully customizable InputRouter with custom motion processor settings.
    pub fn new_full(
        gamepad_driver: Box<dyn VirtualGamepadDriver>,
        mouse_driver: Box<dyn VirtualMouseDriver>,
        keyboard_driver: Box<dyn VirtualKeyboardDriver>,
        motion_processor: MotionProcessor,
    ) -> Self {
        let p2 = crate::drivers::create_platform_driver_for_slot(1);
        let p3 = crate::drivers::create_platform_driver_for_slot(2);
        let p4 = crate::drivers::create_platform_driver_for_slot(3);

        Self {
            gamepad_drivers: [
                Arc::new(Mutex::new(gamepad_driver)),
                Arc::new(Mutex::new(p2)),
                Arc::new(Mutex::new(p3)),
                Arc::new(Mutex::new(p4)),
            ],
            mouse_driver: Arc::new(Mutex::new(mouse_driver)),
            keyboard_driver: Arc::new(Mutex::new(keyboard_driver)),
            motion_processor: Arc::new(Mutex::new(motion_processor)),
            tv_dispatcher: Arc::new(Mutex::new(crate::tv::TvDispatcher::new())),
            latest_gamepad_state: [
                Arc::new(Mutex::new(None)),
                Arc::new(Mutex::new(None)),
                Arc::new(Mutex::new(None)),
                Arc::new(Mutex::new(None)),
            ],
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

    /// Dispatches an InputEvent to the underlying virtual drivers using player_index from the event.
    pub fn route_event(&self, event: &InputEvent) -> Result<(), DriverError> {
        let slot = match event {
            InputEvent::GamepadFull(msg) => msg.player_index.min(3),
            _ => 0,
        };
        self.route_slot_event(slot, event)
    }

    /// Dispatches an InputEvent specifically for a given player slot (0..3).
    pub fn route_slot_event(&self, slot: u8, event: &InputEvent) -> Result<(), DriverError> {
        let slot_idx = (slot as usize).min(3);
        match event {
            InputEvent::GamepadFull(msg) => {
                let mut updated_msg = *msg;
                updated_msg.player_index = slot;

                trace!(
                    slot = slot,
                    buttons = updated_msg.buttons,
                    lx = updated_msg.stick_lx,
                    ly = updated_msg.stick_ly,
                    rx = updated_msg.stick_rx,
                    ry = updated_msg.stick_ry,
                    lt = updated_msg.trigger_l,
                    rt = updated_msg.trigger_r,
                    "Routing GamepadFull event to virtual driver for slot"
                );

                if let Ok(mut state) = self.latest_gamepad_state[slot_idx].lock() {
                    *state = Some(updated_msg);
                }

                let mut driver = self.gamepad_drivers[slot_idx].lock().map_err(|_| {
                    DriverError::Internal("Failed to acquire gamepad driver lock".into())
                })?;
                driver.update_gamepad(&updated_msg)?;
            }

            InputEvent::Motion(m) => {
                trace!(
                    yaw = m.gyro_yaw,
                    pitch = m.gyro_pitch,
                    roll = m.gyro_roll,
                    "Routing Motion event in router"
                );

                let mut proc = self.motion_processor.lock().map_err(|_| {
                    DriverError::Internal("Failed to acquire motion processor lock".into())
                })?;

                match proc.config().mode {
                    MotionAimMode::Mouse => {
                        let (dx, dy) = proc.process_motion_to_mouse(m);
                        if dx != 0 || dy != 0 {
                            let mut mouse = self.mouse_driver.lock().map_err(|_| {
                                DriverError::Internal("Failed to acquire mouse driver lock".into())
                            })?;
                            mouse.move_relative(dx, dy)?;
                        }
                    }

                    MotionAimMode::RightStickAdditive => {
                        let base_msg = {
                            let state = self.latest_gamepad_state[0].lock().ok();
                            state.and_then(|s| *s).unwrap_or_default()
                        };

                        let (new_rx, new_ry) =
                            proc.process_motion_to_stick(m, base_msg.stick_rx, base_msg.stick_ry);

                        let mut updated_msg = base_msg;
                        updated_msg.stick_rx = new_rx;
                        updated_msg.stick_ry = new_ry;

                        let mut driver = self.gamepad_drivers[0].lock().map_err(|_| {
                            DriverError::Internal("Failed to acquire gamepad driver lock".into())
                        })?;
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
                let mut mouse = self.mouse_driver.lock().map_err(|_| {
                    DriverError::Internal("Failed to acquire mouse driver lock".into())
                })?;

                if t.dx != 0 || t.dy != 0 {
                    mouse.move_relative(t.dx as i32, t.dy as i32)?;
                }
                if t.scroll_v != 0 || t.scroll_h != 0 {
                    mouse.scroll(t.scroll_v, t.scroll_h)?;
                }

                // Handle button transitions & tap clicks
                let mut last_buttons = self.last_touchpad_buttons.lock().map_err(|_| {
                    DriverError::Internal("Failed to acquire touchpad buttons lock".into())
                })?;

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
                let mut keyboard = self.keyboard_driver.lock().map_err(|_| {
                    DriverError::Internal("Failed to acquire keyboard driver lock".into())
                })?;
                keyboard.key_event(k.key_code, k.state, k.modifiers)?;
            }

            InputEvent::Media(m) => {
                trace!(
                    action = m.media_action,
                    "Routing Media event to virtual keyboard driver"
                );
                let mut keyboard = self.keyboard_driver.lock().map_err(|_| {
                    DriverError::Internal("Failed to acquire keyboard driver lock".into())
                })?;
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

            InputEvent::SlotAssignment(_) => {
                // Handled in transport layer
            }

            InputEvent::TvCommand(cmd) => {
                tracing::info!(
                    command = cmd.command_code,
                    target = cmd.target_device,
                    "Routing TvCommand from smartphone peer"
                );
                if let Ok(dispatcher) = self.tv_dispatcher.lock() {
                    let _ = dispatcher.dispatch_command(cmd);
                }

                // Map media/volume actions directly to host OS keyboard driver
                if let Ok(mut keyboard) = self.keyboard_driver.lock() {
                    match cmd.command_code {
                        lookaremote_protocol::messages::tv_commands::VOLUME_UP => {
                            let _ = keyboard.media_action(
                                lookaremote_protocol::messages::media::actions::VOL_UP,
                            );
                        }
                        lookaremote_protocol::messages::tv_commands::VOLUME_DOWN => {
                            let _ = keyboard.media_action(
                                lookaremote_protocol::messages::media::actions::VOL_DOWN,
                            );
                        }
                        lookaremote_protocol::messages::tv_commands::MUTE => {
                            let _ = keyboard
                                .media_action(lookaremote_protocol::messages::media::actions::MUTE);
                        }
                        lookaremote_protocol::messages::tv_commands::MEDIA_PLAY_PAUSE => {
                            let _ = keyboard.media_action(
                                lookaremote_protocol::messages::media::actions::PLAY_PAUSE,
                            );
                        }
                        lookaremote_protocol::messages::tv_commands::MEDIA_STOP => {
                            let _ = keyboard
                                .media_action(lookaremote_protocol::messages::media::actions::STOP);
                        }
                        lookaremote_protocol::messages::tv_commands::MEDIA_FAST_FORWARD => {
                            let _ = keyboard
                                .media_action(lookaremote_protocol::messages::media::actions::NEXT);
                        }
                        lookaremote_protocol::messages::tv_commands::MEDIA_REWIND => {
                            let _ = keyboard
                                .media_action(lookaremote_protocol::messages::media::actions::PREV);
                        }
                        _ => {}
                    }
                }
            }

            InputEvent::TvTextInput(txt) => {
                trace!(text = txt.as_str(), "Routing TvTextInput in InputRouter");
                if let Ok(dispatcher) = self.tv_dispatcher.lock() {
                    let _ = dispatcher.dispatch_text_input(txt);
                }
            }
        }

        Ok(())
    }

    /// Access the TV dispatcher instance.
    pub fn tv_dispatcher(&self) -> Arc<Mutex<crate::tv::TvDispatcher>> {
        self.tv_dispatcher.clone()
    }

    /// Neutralizes inputs for a specific player slot without affecting other players.
    pub fn neutralize_slot(&self, slot: u8) -> Result<(), DriverError> {
        let slot_idx = (slot as usize).min(3);
        if let Ok(mut driver) = self.gamepad_drivers[slot_idx].lock() {
            let _ = driver.neutralize();
        }
        if let Ok(mut state) = self.latest_gamepad_state[slot_idx].lock() {
            *state = None;
        }
        Ok(())
    }

    /// Neutralizes all inputs across all 4 players, mouse, and keyboard immediately.
    pub fn neutralize(&self) -> Result<(), DriverError> {
        // 1. Reset all 4 Gamepad Drivers
        for slot in 0..4 {
            let _ = self.neutralize_slot(slot);
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

        // 5. Reset Touchpad buttons state
        if let Ok(mut buttons) = self.last_touchpad_buttons.lock() {
            *buttons = 0;
        }

        Ok(())
    }
}
