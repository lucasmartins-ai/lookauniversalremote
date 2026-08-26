//! High-performance Motion Processor for LookARemote Host Daemon.
//!
//! Converts angular rate (rad/s) from `MSG_MOTION` packets into:
//! 1. Relative mouse cursor deltas (dx, dy) with sub-pixel residual accumulation.
//! 2. Additive Right Stick (RS_x, RS_y) deflection with strict [-32768, 32767] saturation clamping.

use lookaremote_protocol::messages::MotionMessage;
use tracing::trace;

/// Target output mode for gyroscope aiming.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum MotionAimMode {
    /// Injects relative mouse movement into the OS cursor.
    #[default]
    Mouse,
    /// Adds gyro angular rates onto the virtual gamepad's right analog stick (RS).
    RightStickAdditive,
    /// Motion processing disabled.
    Disabled,
}

/// Configuration parameters for motion aiming.
#[derive(Debug, Clone)]
pub struct MotionProcessorConfig {
    pub mode: MotionAimMode,
    pub mouse_sensitivity_x: f32,
    pub mouse_sensitivity_y: f32,
    pub stick_sensitivity_x: f32,
    pub stick_sensitivity_y: f32,
    pub invert_x: bool,
    pub invert_y: bool,
    pub roll_mix: f32,
}

impl Default for MotionProcessorConfig {
    fn default() -> Self {
        Self {
            mode: MotionAimMode::Mouse,
            mouse_sensitivity_x: 1.0,
            mouse_sensitivity_y: 1.0,
            stick_sensitivity_x: 1.0,
            stick_sensitivity_y: 1.0,
            invert_x: false,
            invert_y: false,
            roll_mix: 0.25,
        }
    }
}

/// Motion Processor handling angular velocity conversion and sub-pixel accumulation.
#[derive(Debug, Clone)]
pub struct MotionProcessor {
    config: MotionProcessorConfig,
    subpixel_accumulator_x: f32,
    subpixel_accumulator_y: f32,
    last_timestamp_us: Option<u32>,
}

impl Default for MotionProcessor {
    fn default() -> Self {
        Self::new(MotionProcessorConfig::default())
    }
}

impl MotionProcessor {
    /// Base scale multiplier converting (rad/s * sensitivity * dt) to screen pixels.
    pub const MOUSE_PIXEL_SCALE: f32 = 1200.0;
    /// Stick deflection multiplier per rad/s.
    pub const STICK_DEFLECTION_SCALE: f32 = 16384.0;

    /// Creates a new MotionProcessor with the given configuration.
    pub fn new(config: MotionProcessorConfig) -> Self {
        Self {
            config,
            subpixel_accumulator_x: 0.0,
            subpixel_accumulator_y: 0.0,
            last_timestamp_us: None,
        }
    }

    /// Sets the active motion aiming mode.
    pub fn set_mode(&mut self, mode: MotionAimMode) {
        self.config.mode = mode;
    }

    /// Returns the current configuration.
    pub fn config(&self) -> &MotionProcessorConfig {
        &self.config
    }

    /// Updates the configuration.
    pub fn set_config(&mut self, config: MotionProcessorConfig) {
        self.config = config;
    }

    /// Converts a MotionMessage into integer relative mouse deltas (dx, dy).
    pub fn process_motion_to_mouse(&mut self, msg: &MotionMessage) -> (i32, i32) {
        if self.config.mode != MotionAimMode::Mouse {
            return (0, 0);
        }

        // Calculate delta time in seconds (clamped between 1ms and 50ms)
        let dt = match self.last_timestamp_us {
            Some(prev_ts) => {
                let diff_us = msg.timestamp_us.wrapping_sub(prev_ts);
                let diff_s = (diff_us as f32) / 1_000_000.0;
                diff_s.clamp(0.001, 0.050)
            }
            None => 1.0 / 120.0, // Default 120Hz frame interval (8.33ms)
        };
        self.last_timestamp_us = Some(msg.timestamp_us);

        // Convert protocol fixed point (rad/s * 1000) to rad/s
        let yaw_rad = (msg.gyro_yaw as f32) / 1000.0;
        let pitch_rad = (msg.gyro_pitch as f32) / 1000.0;
        let roll_rad = (msg.gyro_roll as f32) / 1000.0;

        // Yaw-Roll combination for natural horizontal aiming
        let mut omega_x = yaw_rad + roll_rad * self.config.roll_mix;
        let mut omega_y = -pitch_rad; // Inverted pitch for screen coordinates (up is negative Y)

        if self.config.invert_x {
            omega_x = -omega_x;
        }
        if self.config.invert_y {
            omega_y = -omega_y;
        }

        // Compute continuous floating-point movement delta
        let delta_x = omega_x * self.config.mouse_sensitivity_x * Self::MOUSE_PIXEL_SCALE * dt;
        let delta_y = omega_y * self.config.mouse_sensitivity_y * Self::MOUSE_PIXEL_SCALE * dt;

        // Sub-pixel residual accumulation
        let total_x = delta_x + self.subpixel_accumulator_x;
        let total_y = delta_y + self.subpixel_accumulator_y;

        let dx = total_x.trunc() as i32;
        let dy = total_y.trunc() as i32;

        self.subpixel_accumulator_x = total_x.fract();
        self.subpixel_accumulator_y = total_y.fract();

        trace!(dx, dy, omega_x, omega_y, "MotionProcessor calculated mouse delta");
        (dx, dy)
    }

    /// Injects gyro angular rate as an additive deviation on Right Stick (RS_x, RS_y).
    /// Guarantees strict clamping to [-32768, 32767].
    pub fn process_motion_to_stick(
        &mut self,
        msg: &MotionMessage,
        base_stick_rx: i16,
        base_stick_ry: i16,
    ) -> (i16, i16) {
        if self.config.mode != MotionAimMode::RightStickAdditive {
            return (base_stick_rx, base_stick_ry);
        }

        // Convert protocol fixed point (rad/s * 1000) to rad/s
        let yaw_rad = (msg.gyro_yaw as f32) / 1000.0;
        let pitch_rad = (msg.gyro_pitch as f32) / 1000.0;
        let roll_rad = (msg.gyro_roll as f32) / 1000.0;

        let mut omega_x = yaw_rad + roll_rad * self.config.roll_mix;
        let mut omega_y = pitch_rad;

        if self.config.invert_x {
            omega_x = -omega_x;
        }
        if self.config.invert_y {
            omega_y = -omega_y;
        }

        let delta_rx = (omega_x * self.config.stick_sensitivity_x * Self::STICK_DEFLECTION_SCALE) as i32;
        let delta_ry = (omega_y * self.config.stick_sensitivity_y * Self::STICK_DEFLECTION_SCALE) as i32;

        let new_rx = (base_stick_rx as i32 + delta_rx).clamp(-32768, 32767) as i16;
        let new_ry = (base_stick_ry as i32 + delta_ry).clamp(-32768, 32767) as i16;

        trace!(base_rx = base_stick_rx, new_rx, base_ry = base_stick_ry, new_ry, "MotionProcessor calculated additive stick");
        (new_rx, new_ry)
    }

    /// Neutralizes all internal state, clearing subpixel residual accumulators and timestamps.
    pub fn neutralize(&mut self) {
        self.subpixel_accumulator_x = 0.0;
        self.subpixel_accumulator_y = 0.0;
        self.last_timestamp_us = None;
    }
}
