use lookaremote_host_daemon::drivers::{MockGamepadDriver, MockKeyboardDriver, MockMouseDriver};
use lookaremote_host_daemon::input::events::InputEvent;
use lookaremote_host_daemon::input::router::InputRouter;
use lookaremote_protocol::messages::{KeyboardMessage, MediaMessage, TouchpadMessage};

#[test]
fn test_input_router_touchpad_routing() {
    let mock_gamepad = Box::new(MockGamepadDriver::new());
    let mock_mouse = Box::new(MockMouseDriver::new());
    let mock_keyboard = Box::new(MockKeyboardDriver::new());

    let router = InputRouter::with_drivers(mock_gamepad, mock_mouse, mock_keyboard);

    // 1. Relative Cursor Movement
    let touch_move = InputEvent::Touchpad(TouchpadMessage {
        dx: 25,
        dy: -12,
        scroll_v: 0,
        scroll_h: 0,
        buttons_mask: 0,
    });
    router
        .route_event(&touch_move)
        .expect("routing touchpad move should succeed");

    // 2. Scroll Wheel
    let touch_scroll = InputEvent::Touchpad(TouchpadMessage {
        dx: 0,
        dy: 0,
        scroll_v: 5,
        scroll_h: -2,
        buttons_mask: 0,
    });
    router
        .route_event(&touch_scroll)
        .expect("routing touchpad scroll should succeed");

    // 3. Mouse Button Down & Up
    let touch_button_down = InputEvent::Touchpad(TouchpadMessage {
        dx: 0,
        dy: 0,
        scroll_v: 0,
        scroll_h: 0,
        buttons_mask: 0x01, // Left button down
    });
    router
        .route_event(&touch_button_down)
        .expect("routing button down should succeed");

    let touch_button_up = InputEvent::Touchpad(TouchpadMessage {
        dx: 0,
        dy: 0,
        scroll_v: 0,
        scroll_h: 0,
        buttons_mask: 0x00, // Left button up
    });
    router
        .route_event(&touch_button_up)
        .expect("routing button up should succeed");

    // 4. Tap to click pulse (Bit 3)
    let touch_tap = InputEvent::Touchpad(TouchpadMessage {
        dx: 0,
        dy: 0,
        scroll_v: 0,
        scroll_h: 0,
        buttons_mask: 0x08,
    });
    router
        .route_event(&touch_tap)
        .expect("routing tap click should succeed");
}

#[test]
fn test_input_router_keyboard_and_media_routing() {
    let mock_gamepad = Box::new(MockGamepadDriver::new());
    let mock_mouse = Box::new(MockMouseDriver::new());
    let mock_keyboard = Box::new(MockKeyboardDriver::new());

    let router = InputRouter::with_drivers(mock_gamepad, mock_mouse, mock_keyboard);

    // 1. Keyboard event: Enter key (0x28) pressed with Shift (0x02)
    let key_event = InputEvent::Keyboard(KeyboardMessage {
        key_code: 0x28,
        state: 1, // Down
        modifiers: 0x02,
    });
    router
        .route_event(&key_event)
        .expect("routing key event should succeed");

    // 2. Media event: Volume Up (5)
    let media_event = InputEvent::Media(MediaMessage {
        media_action: 5,
        reserved: 0,
    });
    router
        .route_event(&media_event)
        .expect("routing media event should succeed");
}

#[test]
fn test_input_router_emergency_neutralization_all_drivers() {
    let mock_gamepad = Box::new(MockGamepadDriver::new());
    let mock_mouse = Box::new(MockMouseDriver::new());
    let mock_keyboard = Box::new(MockKeyboardDriver::new());

    let router = InputRouter::with_drivers(mock_gamepad, mock_mouse, mock_keyboard);

    // Send Key Down
    router
        .route_event(&InputEvent::Keyboard(KeyboardMessage {
            key_code: 0x04,
            state: 1,
            modifiers: 0x01,
        }))
        .unwrap();

    // Trigger EmergencyReset
    router
        .route_event(&InputEvent::EmergencyReset)
        .expect("emergency reset should neutralize cleanly");
}
