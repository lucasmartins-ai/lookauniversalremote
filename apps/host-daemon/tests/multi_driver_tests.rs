//! Multi-Controller Gamepad Driver Isolation & Neutralization Tests.

use lookaremote_host_daemon::drivers::{MockGamepadDriver, MockKeyboardDriver, MockMouseDriver};
use lookaremote_host_daemon::input::events::InputEvent;
use lookaremote_host_daemon::input::router::InputRouter;
use lookaremote_protocol::messages::GamepadFullMessage;

#[test]
fn test_multi_controller_isolated_driver_routing() {
    let p1 = Box::new(MockGamepadDriver::for_slot(0));
    let p2 = Box::new(MockGamepadDriver::for_slot(1));
    let p3 = Box::new(MockGamepadDriver::for_slot(2));
    let p4 = Box::new(MockGamepadDriver::for_slot(3));
    let mouse = Box::new(MockMouseDriver::new());
    let keyboard = Box::new(MockKeyboardDriver::new());

    let router = InputRouter::with_multi_gamepad_drivers(p1, p2, p3, p4, mouse, keyboard);

    // 1. Send Player 2 input
    let p2_msg = GamepadFullMessage {
        buttons: 0x0001, // A button
        stick_lx: 15000,
        stick_ly: -12000,
        stick_rx: 0,
        stick_ry: 0,
        trigger_l: 100,
        trigger_r: 200,
        player_index: 1,
        reserved: 0,
    };

    router
        .route_slot_event(1, &InputEvent::GamepadFull(p2_msg))
        .expect("P2 event routing succeeds");

    // 2. Send Player 4 input
    let p4_msg = GamepadFullMessage {
        buttons: 0x0002, // B button
        stick_lx: -30000,
        stick_ly: 30000,
        stick_rx: 1000,
        stick_ry: 2000,
        trigger_l: 255,
        trigger_r: 0,
        player_index: 3,
        reserved: 0,
    };

    router
        .route_slot_event(3, &InputEvent::GamepadFull(p4_msg))
        .expect("P4 event routing succeeds");

    // 3. Neutralize only slot 1 (P2)
    router.neutralize_slot(1).expect("Slot 1 neutralized");

    // 4. Global neutralize
    router.neutralize().expect("Global neutralize succeeds");
}
