use lookaremote_host_daemon::drivers::{MockKeyboardDriver, VirtualKeyboardDriver};

#[test]
fn test_mock_keyboard_driver_key_lifecycle() {
    let mut driver = MockKeyboardDriver::new();
    assert!(driver.is_neutral);
    assert_eq!(driver.key_events_count, 0);

    // 1. Key Down: 'A' (HID 0x04) with no modifiers
    driver.key_event(0x04, 1, 0).expect("key down should succeed");
    assert!(!driver.is_neutral);
    assert_eq!(driver.key_events_count, 1);
    assert_eq!(driver.last_key, Some((0x04, 1, 0)));
    assert!(driver.pressed_keys.contains(&0x04));
    assert_eq!(driver.active_modifiers, 0);

    // 2. Key Repeat: 'A' (HID 0x04)
    driver.key_event(0x04, 2, 0).expect("key repeat should succeed");
    assert_eq!(driver.key_events_count, 2);
    assert_eq!(driver.last_key, Some((0x04, 2, 0)));
    assert!(driver.pressed_keys.contains(&0x04));

    // 3. Key Up: 'A' (HID 0x04)
    driver.key_event(0x04, 0, 0).expect("key up should succeed");
    assert_eq!(driver.key_events_count, 3);
    assert_eq!(driver.last_key, Some((0x04, 0, 0)));
    assert!(!driver.pressed_keys.contains(&0x04));
    assert!(driver.is_neutral);
}

#[test]
fn test_mock_keyboard_driver_modifiers_and_multi_key() {
    let mut driver = MockKeyboardDriver::new();

    // Press Ctrl (0x01) + 'C' (0x06)
    driver.key_event(0x06, 1, 0x01).expect("key down should succeed");
    assert_eq!(driver.active_modifiers, 0x01);
    assert!(driver.pressed_keys.contains(&0x06));

    // Press 'V' (0x19) while Ctrl is active
    driver.key_event(0x19, 1, 0x01).expect("key down should succeed");
    assert_eq!(driver.pressed_keys.len(), 2);

    // Neutralize
    driver.neutralize().expect("neutralize should succeed");
    assert!(driver.is_neutral);
    assert!(driver.pressed_keys.is_empty());
    assert_eq!(driver.active_modifiers, 0);
}

#[test]
fn test_mock_keyboard_driver_media_actions() {
    let mut driver = MockKeyboardDriver::new();
    assert_eq!(driver.media_events_count, 0);

    // 1: Play/Pause
    driver.media_action(1).expect("play/pause should succeed");
    assert_eq!(driver.last_media, Some(1));
    assert_eq!(driver.media_events_count, 1);

    // 5: VolUp
    driver.media_action(5).expect("volup should succeed");
    assert_eq!(driver.last_media, Some(5));

    // 6: VolDown
    driver.media_action(6).expect("voldown should succeed");
    assert_eq!(driver.last_media, Some(6));

    // 7: Mute
    driver.media_action(7).expect("mute should succeed");
    assert_eq!(driver.last_media, Some(7));
    assert_eq!(driver.media_events_count, 4);
}
