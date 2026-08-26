//! Integration tests for Cross-Platform Native Drivers (macOS, Windows, Linux, Mock).

use lookaremote_host_daemon::drivers::{
    check_macos_accessibility_permissions, create_platform_keyboard_driver,
    create_platform_mouse_driver, MacOSKeyboardDriver, WindowsKeyboardDriver,
};

#[test]
fn test_macos_permissions_check_callable() {
    // Verifies the permission checker does not panic and returns a boolean
    let trusted = check_macos_accessibility_permissions();
    println!("Accessibility trusted: {trusted}");
}

#[test]
fn test_macos_keyboard_hid_mapping_coverage() {
    // Alphanumeric keys
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x04), Some(0x00)); // A
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x16), Some(0x01)); // S
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x07), Some(0x02)); // D
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x1A), Some(0x0D)); // W
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x28), Some(0x24)); // Return
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x2C), Some(0x31)); // Space
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x29), Some(0x35)); // Escape

    // Arrow keys
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x50), Some(0x7B)); // Left
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x4F), Some(0x7C)); // Right
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x51), Some(0x7D)); // Down
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0x52), Some(0x7E)); // Up

    // Modifiers
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0xE0), Some(0x3B)); // LCtrl
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0xE1), Some(0x38)); // LShift
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0xE2), Some(0x3A)); // LAlt
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0xE3), Some(0x37)); // LCommand

    // Unmapped
    assert_eq!(MacOSKeyboardDriver::hid_to_macos_vk(0xFFFF), None);
}

#[test]
fn test_windows_keyboard_hid_mapping_coverage() {
    // Alphanumeric
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x04), Some(0x41)); // 'A'
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x1D), Some(0x5A)); // 'Z'
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x1E), Some(0x31)); // '1'
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x27), Some(0x30)); // '0'
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x28), Some(0x0D)); // VK_RETURN
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x2C), Some(0x20)); // VK_SPACE
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x29), Some(0x1B)); // VK_ESCAPE

    // Navigation & Function
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x3A), Some(0x70)); // VK_F1
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x45), Some(0x7B)); // VK_F12
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x4F), Some(0x27)); // VK_RIGHT
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x50), Some(0x25)); // VK_LEFT
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x51), Some(0x28)); // VK_DOWN
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0x52), Some(0x26)); // VK_UP

    // Modifiers
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0xE0), Some(0xA2)); // VK_LCONTROL
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0xE1), Some(0xA0)); // VK_LSHIFT
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0xE2), Some(0x12)); // VK_MENU
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0xE3), Some(0x5B)); // VK_LWIN

    // Unmapped
    assert_eq!(WindowsKeyboardDriver::hid_to_win32_vk(0xFFFF), None);
}

#[test]
fn test_platform_driver_factory_creation() {
    let mut mouse = create_platform_mouse_driver();
    assert!(mouse.neutralize().is_ok());

    let mut keyboard = create_platform_keyboard_driver();
    assert!(keyboard.neutralize().is_ok());
}
