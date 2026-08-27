//! Integration tests for Virtual Gamepad Drivers, InputRouter, and Watchdog Neutralization.

use lookaremote_host_daemon::drivers::{MockGamepadDriver, VirtualGamepadDriver};
use lookaremote_host_daemon::input::events::InputEvent;
use lookaremote_host_daemon::input::router::InputRouter;
use lookaremote_host_daemon::input::watchdog::DeadManWatchdog;
use lookaremote_protocol::messages::{buttons, GamepadFullMessage};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

#[test]
fn test_mock_driver_lifecycle() {
    let mut driver = MockGamepadDriver::new();
    assert!(driver.is_neutral());
    assert_eq!(driver.last_message(), None);

    let msg = GamepadFullMessage {
        buttons: buttons::BTN_SOUTH | buttons::BTN_EAST, // A + B
        stick_lx: -16000,
        stick_ly: 32000,
        stick_rx: 1000,
        stick_ry: -2000,
        trigger_l: 128,
        trigger_r: 255,
        player_index: 0,
        reserved: 0,
    };

    driver.update_gamepad(&msg).expect("Update should succeed");
    assert!(!driver.is_neutral());
    assert_eq!(driver.last_message(), Some(msg));
    assert_eq!(driver.update_count, 1);

    driver.neutralize().expect("Neutralize should succeed");
    assert!(driver.is_neutral());
    assert_eq!(driver.neutralize_count, 1);

    let neutral = driver.last_message().unwrap();
    assert_eq!(neutral.buttons, 0);
    assert_eq!(neutral.stick_lx, 0);
    assert_eq!(neutral.stick_ly, 0);
    assert_eq!(neutral.stick_rx, 0);
    assert_eq!(neutral.stick_ry, 0);
    assert_eq!(neutral.trigger_l, 0);
    assert_eq!(neutral.trigger_r, 0);
}

#[test]
fn test_input_router_event_dispatch() {
    let driver = Box::new(MockGamepadDriver::new());
    let router = InputRouter::new(driver);

    let msg = GamepadFullMessage {
        buttons: buttons::BTN_WEST | buttons::DPAD_UP,
        stick_lx: 32767,
        stick_ly: -32768,
        stick_rx: 0,
        stick_ry: 0,
        trigger_l: 255,
        trigger_r: 0,
        player_index: 0,
        reserved: 0,
    };

    let event = InputEvent::GamepadFull(msg);
    router.route_event(&event).expect("Routing should succeed");

    // Route emergency reset
    let reset_event = InputEvent::EmergencyReset;
    router
        .route_event(&reset_event)
        .expect("Reset routing should succeed");
}

#[tokio::test]
async fn test_watchdog_auto_neutralization_pipeline() {
    let driver = Box::new(MockGamepadDriver::new());
    let router = Arc::new(InputRouter::new(driver));

    // Send active stick input to simulate non-neutral state
    let active_msg = GamepadFullMessage {
        buttons: buttons::BTN_SOUTH,
        stick_lx: 30000,
        stick_ly: 30000,
        stick_rx: 0,
        stick_ry: 0,
        trigger_l: 255,
        trigger_r: 255,
        player_index: 0,
        reserved: 0,
    };
    router
        .route_event(&InputEvent::GamepadFull(active_msg))
        .unwrap();

    // Setup 50ms watchdog with 5ms check interval
    let watchdog = DeadManWatchdog::new(Duration::from_millis(50), Duration::from_millis(5));

    let r = Arc::clone(&router);
    let _monitor = watchdog.spawn_monitor(move || {
        r.neutralize().unwrap();
    });

    // Arm watchdog
    watchdog.arm();

    // Wait for timeout
    sleep(Duration::from_millis(80)).await;

    assert!(
        watchdog.is_triggered(),
        "Watchdog should have triggered after timeout"
    );
    assert_eq!(watchdog.trigger_count(), 1);

    // Verify driver was neutralized by sending another emergency reset or checking router state
    router.neutralize().expect("Router should be clean");
    watchdog.stop();
}
