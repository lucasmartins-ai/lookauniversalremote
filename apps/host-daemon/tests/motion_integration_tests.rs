//! Integration tests for MotionProcessor, Virtual Mouse Driver, and InputRouter motion routing.

use lookaremote_host_daemon::drivers::{MockGamepadDriver, MockMouseDriver};
use lookaremote_host_daemon::input::events::InputEvent;
use lookaremote_host_daemon::input::motion_processor::{
    MotionAimMode, MotionProcessor, MotionProcessorConfig,
};
use lookaremote_host_daemon::input::router::InputRouter;
use lookaremote_protocol::messages::{GamepadFullMessage, MotionMessage, TouchpadMessage};

#[test]
fn test_motion_processor_mouse_delta_and_subpixel_accumulation() {
    let mut processor = MotionProcessor::new(MotionProcessorConfig {
        mode: MotionAimMode::Mouse,
        mouse_sensitivity_x: 1.0,
        mouse_sensitivity_y: 1.0,
        stick_sensitivity_x: 1.0,
        stick_sensitivity_y: 1.0,
        invert_x: false,
        invert_y: false,
        roll_mix: 0.0,
    });

    // 1 rad/s yaw, 0 pitch, 0 roll at timestamp 0
    let msg1 = MotionMessage {
        gyro_yaw: 1000,   // 1.0 rad/s
        gyro_pitch: -500, // -0.5 rad/s (pitch up -> positive Y delta)
        gyro_roll: 0,
        accel_x: 0,
        accel_y: 0,
        accel_z: 981,
        timestamp_us: 0,
    };

    // First sample uses default dt = 1/120s (~8.33ms)
    // dx = 1.0 * 1.0 * 1200 * (1/120) = 10.0 px
    // dy = -(-0.5) * 1.0 * 1200 * (1/120) = 5.0 px
    let (dx1, dy1) = processor.process_motion_to_mouse(&msg1);
    assert_eq!(dx1, 10);
    assert_eq!(dy1, 5);

    // Second sample 8333us later with tiny angular velocity to test subpixel accumulation
    let msg2 = MotionMessage {
        gyro_yaw: 50, // 0.05 rad/s -> delta = 0.05 * 1200 * (8333 / 1_000_000) = 0.49998 px (< 1px)
        gyro_pitch: 0,
        gyro_roll: 0,
        accel_x: 0,
        accel_y: 0,
        accel_z: 981,
        timestamp_us: 8333,
    };

    let (dx2, dy2) = processor.process_motion_to_mouse(&msg2);
    // Truncates to 0, accumulates ~0.5px
    assert_eq!(dx2, 0);
    assert_eq!(dy2, 0);

    // Third sample with 0.06 rad/s -> total accumulated (0.49998 + 0.59998 = 1.09996) >= 1.0px -> emits 1px
    let msg3 = MotionMessage {
        gyro_yaw: 60,
        gyro_pitch: 0,
        gyro_roll: 0,
        accel_x: 0,
        accel_y: 0,
        accel_z: 981,
        timestamp_us: 16666,
    };

    let (dx3, dy3) = processor.process_motion_to_mouse(&msg3);
    assert_eq!(dx3, 1);
    assert_eq!(dy3, 0);
}

#[test]
fn test_motion_processor_roll_mix_and_axis_inversion() {
    let mut processor = MotionProcessor::new(MotionProcessorConfig {
        mode: MotionAimMode::Mouse,
        mouse_sensitivity_x: 2.0,
        mouse_sensitivity_y: 1.5,
        stick_sensitivity_x: 1.0,
        stick_sensitivity_y: 1.0,
        invert_x: true,
        invert_y: true,
        roll_mix: 0.5, // 50% roll contribution
    });

    let msg = MotionMessage {
        gyro_yaw: 500,  // 0.5 rad/s
        gyro_pitch: 400, // 0.4 rad/s
        gyro_roll: 1000, // 1.0 rad/s -> combined horizontal = 0.5 + 1.0 * 0.5 = 1.0 rad/s
        accel_x: 0,
        accel_y: 0,
        accel_z: 981,
        timestamp_us: 0,
    };

    let (dx, dy) = processor.process_motion_to_mouse(&msg);
    // Inverted X: - (1.0 * 2.0 * 1200 * (1/120)) = -20 px
    // Inverted Y: - (-0.4 * 1.5 * 1200 * (1/120)) = +6 px
    assert_eq!(dx, -20);
    assert_eq!(dy, 6);
}

#[test]
fn test_motion_processor_additive_stick_clamping() {
    let mut processor = MotionProcessor::new(MotionProcessorConfig {
        mode: MotionAimMode::RightStickAdditive,
        mouse_sensitivity_x: 1.0,
        mouse_sensitivity_y: 1.0,
        stick_sensitivity_x: 1.0,
        stick_sensitivity_y: 1.0,
        invert_x: false,
        invert_y: false,
        roll_mix: 0.0,
    });

    // Baseline stick at 20000, 20000
    // Gyro motion of 1.0 rad/s -> delta = 1.0 * 16384 = 16384
    // 20000 + 16384 = 36384 -> clamped to 32767
    let msg = MotionMessage {
        gyro_yaw: 1000,
        gyro_pitch: 1000,
        gyro_roll: 0,
        accel_x: 0,
        accel_y: 0,
        accel_z: 981,
        timestamp_us: 0,
    };

    let (new_rx, new_ry) = processor.process_motion_to_stick(&msg, 20000, 20000);
    assert_eq!(new_rx, 32767);
    assert_eq!(new_ry, 32767);

    // Negative clamping test
    let neg_msg = MotionMessage {
        gyro_yaw: -2500, // -2.5 rad/s
        gyro_pitch: -2500,
        gyro_roll: 0,
        accel_x: 0,
        accel_y: 0,
        accel_z: 981,
        timestamp_us: 1000,
    };

    let (neg_rx, neg_ry) = processor.process_motion_to_stick(&neg_msg, -10000, -10000);
    assert_eq!(neg_rx, -32768);
    assert_eq!(neg_ry, -32768);
}

#[test]
fn test_input_router_motion_dispatch_to_mouse() {
    let gamepad_driver = Box::new(MockGamepadDriver::new());
    let mouse_driver = Box::new(MockMouseDriver::new());
    let router = InputRouter::with_mouse_driver(gamepad_driver, mouse_driver);

    // Set mouse aim mode
    router
        .set_motion_aim_mode(MotionAimMode::Mouse)
        .expect("Mode switch should succeed");

    let motion = MotionMessage {
        gyro_yaw: 1000,
        gyro_pitch: 0,
        gyro_roll: 0,
        accel_x: 0,
        accel_y: 0,
        accel_z: 981,
        timestamp_us: 0,
    };

    router
        .route_event(&InputEvent::Motion(motion))
        .expect("Routing motion event should succeed");

    // Route Touchpad event
    let touchpad = TouchpadMessage {
        dx: 15,
        dy: -8,
        scroll_v: 2,
        scroll_h: 0,
        buttons_mask: 0x01,
    };
    router
        .route_event(&InputEvent::Touchpad(touchpad))
        .expect("Routing touchpad event should succeed");

    // Neutralize router
    router.neutralize().expect("Neutralize should succeed");
}

#[test]
fn test_input_router_motion_dispatch_to_additive_stick() {
    let gamepad_driver = Box::new(MockGamepadDriver::new());
    let mouse_driver = Box::new(MockMouseDriver::new());
    let router = InputRouter::with_mouse_driver(gamepad_driver, mouse_driver);

    router
        .set_motion_aim_mode(MotionAimMode::RightStickAdditive)
        .expect("Mode switch should succeed");

    // First send a baseline GamepadFull snapshot
    let base_gp = GamepadFullMessage {
        buttons: 0,
        stick_lx: 0,
        stick_ly: 0,
        stick_rx: 5000,
        stick_ry: -5000,
        trigger_l: 0,
        trigger_r: 0,
        reserved: 0,
    };
    router
        .route_event(&InputEvent::GamepadFull(base_gp))
        .expect("GamepadFull should route");

    // Now send motion event
    let motion = MotionMessage {
        gyro_yaw: 500, // +0.5 rad/s -> +8192
        gyro_pitch: 500,
        gyro_roll: 0,
        accel_x: 0,
        accel_y: 0,
        accel_z: 981,
        timestamp_us: 0,
    };

    router
        .route_event(&InputEvent::Motion(motion))
        .expect("Motion event should route and update right stick");
}
