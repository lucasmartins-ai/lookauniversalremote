use lookaremote_protocol::{
    decode_packet, encode_packet, is_valid_sequence_advance, messages::*, HeaderFlags, Payload,
    ProtocolError, SequenceGenerator, SequenceTracker, HEADER_SIZE,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct GoldenFile {
    vectors: Vec<GoldenVector>,
}

#[derive(Debug, Deserialize)]
struct GoldenVector {
    name: String,
    hex: String,
    header: GoldenHeader,
    payload: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct GoldenHeader {
    version: u8,
    #[serde(rename = "type")]
    msg_type: u8,
    flags: u8,
    sequence: u16,
}

#[test]
fn test_golden_vectors_decode_and_encode_parity() {
    let json_str = include_str!("golden_vectors.json");
    let golden: GoldenFile = serde_json::from_str(json_str).expect("Valid golden vectors JSON");

    for vec in golden.vectors {
        let raw_bytes = hex::decode(&vec.hex).expect("Valid hex string");

        // 1. Decode raw bytes
        let packet = decode_packet(&raw_bytes)
            .unwrap_or_else(|e| panic!("Failed to decode vector '{}': {:?}", vec.name, e));

        // 2. Validate header fields
        assert_eq!(
            packet.header.version, vec.header.version,
            "Vector: {}",
            vec.name
        );
        assert_eq!(
            packet.header.msg_type.as_u8(),
            vec.header.msg_type,
            "Vector: {}",
            vec.name
        );
        assert_eq!(
            packet.header.flags.bits(),
            vec.header.flags,
            "Vector: {}",
            vec.name
        );
        assert_eq!(
            packet.header.sequence, vec.header.sequence,
            "Vector: {}",
            vec.name
        );

        // 3. Validate specific payload fields
        let p_type = vec.payload.get("type").and_then(|v| v.as_str()).unwrap();
        match (p_type, &packet.payload) {
            ("motion", Payload::Motion(m)) => {
                assert_eq!(m.gyro_yaw, vec.payload["gyro_yaw"].as_i64().unwrap() as i16);
                assert_eq!(
                    m.gyro_pitch,
                    vec.payload["gyro_pitch"].as_i64().unwrap() as i16
                );
                assert_eq!(
                    m.gyro_roll,
                    vec.payload["gyro_roll"].as_i64().unwrap() as i16
                );
                assert_eq!(m.accel_x, vec.payload["accel_x"].as_i64().unwrap() as i16);
                assert_eq!(m.accel_y, vec.payload["accel_y"].as_i64().unwrap() as i16);
                assert_eq!(m.accel_z, vec.payload["accel_z"].as_i64().unwrap() as i16);
                assert_eq!(
                    m.timestamp_us,
                    vec.payload["timestamp_us"].as_u64().unwrap() as u32
                );
            }
            ("gamepad_full", Payload::GamepadFull(g)) => {
                assert_eq!(g.buttons, vec.payload["buttons"].as_u64().unwrap() as u16);
                assert_eq!(g.stick_lx, vec.payload["stick_lx"].as_i64().unwrap() as i16);
                assert_eq!(g.stick_ly, vec.payload["stick_ly"].as_i64().unwrap() as i16);
                assert_eq!(g.stick_rx, vec.payload["stick_rx"].as_i64().unwrap() as i16);
                assert_eq!(g.stick_ry, vec.payload["stick_ry"].as_i64().unwrap() as i16);
                assert_eq!(
                    g.trigger_l,
                    vec.payload["trigger_l"].as_u64().unwrap() as u8
                );
                assert_eq!(
                    g.trigger_r,
                    vec.payload["trigger_r"].as_u64().unwrap() as u8
                );
                if let Some(pi) = vec.payload.get("player_index") {
                    assert_eq!(g.player_index, pi.as_u64().unwrap() as u8);
                }
                assert_eq!(
                    g.reserved,
                    (vec.payload["reserved"].as_u64().unwrap() & 0xFF) as u8
                );
            }
            ("touchpad", Payload::Touchpad(t)) => {
                assert_eq!(t.dx, vec.payload["dx"].as_i64().unwrap() as i16);
                assert_eq!(t.dy, vec.payload["dy"].as_i64().unwrap() as i16);
                assert_eq!(t.scroll_v, vec.payload["scroll_v"].as_i64().unwrap() as i8);
                assert_eq!(t.scroll_h, vec.payload["scroll_h"].as_i64().unwrap() as i8);
                assert_eq!(
                    t.buttons_mask,
                    vec.payload["buttons_mask"].as_u64().unwrap() as u8
                );
            }
            ("keyboard", Payload::Keyboard(k)) => {
                assert_eq!(k.key_code, vec.payload["key_code"].as_u64().unwrap() as u16);
                assert_eq!(k.state, vec.payload["state"].as_u64().unwrap() as u8);
                assert_eq!(
                    k.modifiers,
                    vec.payload["modifiers"].as_u64().unwrap() as u8
                );
            }
            ("media", Payload::Media(m)) => {
                assert_eq!(
                    m.media_action,
                    vec.payload["media_action"].as_u64().unwrap() as u8
                );
                assert_eq!(m.reserved, vec.payload["reserved"].as_u64().unwrap() as u8);
            }
            ("heartbeat", Payload::Heartbeat(h)) => {
                assert_eq!(
                    h.client_epoch_ms,
                    vec.payload["client_epoch_ms"].as_u64().unwrap() as u32
                );
                assert_eq!(
                    h.echo_token,
                    vec.payload["echo_token"].as_u64().unwrap() as u32
                );
            }
            ("haptic", Payload::HapticEvent(h)) => {
                assert_eq!(
                    h.motor_index,
                    vec.payload["motor_index"].as_u64().unwrap() as u8
                );
                assert_eq!(
                    h.intensity,
                    vec.payload["intensity"].as_u64().unwrap() as u8
                );
                assert_eq!(
                    h.duration_ms,
                    vec.payload["duration_ms"].as_u64().unwrap() as u16
                );
            }
            _ => panic!("Payload type mismatch for vector '{}'", vec.name),
        }

        // 4. Re-encode packet and verify exact hex match
        let encoded_buffer = encode_packet(&packet).expect("Encoding success");
        let re_encoded_hex = hex::encode(encoded_buffer.as_slice());
        assert_eq!(
            re_encoded_hex, vec.hex,
            "Re-encoded hex mismatch on '{}'",
            vec.name
        );
    }
}

#[test]
fn test_decode_truncated_buffer_errors() {
    // Empty buffer
    assert!(matches!(
        decode_packet(&[]),
        Err(ProtocolError::BufferTooShort {
            expected: HEADER_SIZE,
            actual: 0
        })
    ));

    // Incomplete header (3 bytes)
    assert!(matches!(
        decode_packet(&[0x01, 0x01, 0x00]),
        Err(ProtocolError::BufferTooShort {
            expected: HEADER_SIZE,
            actual: 3
        })
    ));

    // Valid header for MSG_MOTION (expects 16 bytes payload) with only 8 bytes total
    let truncated_motion = [0x01, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00];
    assert!(matches!(
        decode_packet(&truncated_motion),
        Err(ProtocolError::InvalidPayloadLength {
            expected: 16,
            actual: 3
        })
    ));
}

#[test]
fn test_decode_invalid_version_and_unknown_type() {
    // Invalid version 0x02
    let bad_version = [0x02, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00];
    assert!(matches!(
        decode_packet(&bad_version),
        Err(ProtocolError::InvalidVersion(0x02))
    ));

    // Unknown message type 0xFF
    let bad_type = [0x01, 0xFF, 0x00, 0x01, 0x00];
    assert!(matches!(
        decode_packet(&bad_type),
        Err(ProtocolError::UnknownMessageType(0xFF))
    ));
}

#[test]
fn test_decode_trailing_garbage_rejected() {
    // MSG_MEDIA is 7 bytes. Pass 8 bytes.
    let oversized = [0x01, 0x06, 0x00, 0x01, 0x00, 0x01, 0x00, 0xAA];
    assert!(matches!(
        decode_packet(&oversized),
        Err(ProtocolError::InvalidPayloadLength {
            expected: 2,
            actual: 3
        })
    ));
}

#[test]
fn test_sequence_tracking_and_wraparound() {
    let mut tracker = SequenceTracker::new();
    assert_eq!(tracker.latest(), None);

    // Initial frame accepted
    assert!(tracker.check_and_update(100));
    assert_eq!(tracker.latest(), Some(100));

    // In-order advancement accepted
    assert!(tracker.check_and_update(101));
    assert!(tracker.check_and_update(150));
    assert_eq!(tracker.latest(), Some(150));

    // Duplicate rejected
    assert!(!tracker.check_and_update(150));

    // Late / out-of-order rejected
    assert!(!tracker.check_and_update(149));
    assert!(!tracker.check_and_update(50));

    // Large jump within window accepted (< 32768)
    assert!(tracker.check_and_update(20000));
    assert_eq!(tracker.latest(), Some(20000));

    // Jump by exactly 32768 is rejected
    assert!(!is_valid_sequence_advance(20000, 20000 + 32768));

    // Step forward to 50000 (< 32768 jump)
    assert!(tracker.check_and_update(50000));
    assert_eq!(tracker.latest(), Some(50000));

    // Step forward to 65535 (< 32768 jump)
    assert!(tracker.check_and_update(65535));
    assert_eq!(tracker.latest(), Some(65535));

    // Rollover across 65535 -> 0
    assert!(tracker.check_and_update(0));
    assert_eq!(tracker.latest(), Some(0));

    // Rollover to 5
    assert!(tracker.check_and_update(5));
    assert_eq!(tracker.latest(), Some(5));

    // Old sequence 65535 is now late/rejected
    assert!(!tracker.check_and_update(65535));

    // Reset tracker
    tracker.reset();
    assert_eq!(tracker.latest(), None);
    assert!(tracker.check_and_update(42));
    assert_eq!(tracker.latest(), Some(42));
}

#[test]
fn test_sequence_generator() {
    let mut gen = SequenceGenerator::new();
    assert_eq!(gen.current(), 1);
    assert_eq!(gen.next_sequence(), 1);
    assert_eq!(gen.next_sequence(), 2);
    assert_eq!(gen.current(), 3);

    let mut wrap_gen = SequenceGenerator::with_start(65535);
    assert_eq!(wrap_gen.next_sequence(), 65535);
    assert_eq!(wrap_gen.next_sequence(), 0);
    assert_eq!(wrap_gen.next_sequence(), 1);
}

#[test]
fn test_flags_and_bitmasks() {
    let mut flags = HeaderFlags::empty();
    assert_eq!(flags.bits(), 0);
    assert!(!flags.contains(HeaderFlags::NEEDS_ACK));

    flags.set(HeaderFlags::NEEDS_ACK, true);
    assert!(flags.contains(HeaderFlags::NEEDS_ACK));
    assert_eq!(flags.bits(), 0x01);

    flags.set(HeaderFlags::EMERGENCY_RESET, true);
    assert!(flags.contains(HeaderFlags::EMERGENCY_RESET));
    assert_eq!(flags.bits(), 0x03);

    flags.set(HeaderFlags::NEEDS_ACK, false);
    assert!(!flags.contains(HeaderFlags::NEEDS_ACK));
    assert_eq!(flags.bits(), 0x02);

    let gamepad = GamepadFullMessage {
        buttons: gamepad::buttons::BTN_SOUTH | gamepad::buttons::DPAD_UP,
        ..Default::default()
    };
    assert!(gamepad.is_button_pressed(gamepad::buttons::BTN_SOUTH));
    assert!(gamepad.is_button_pressed(gamepad::buttons::DPAD_UP));
    assert!(!gamepad.is_button_pressed(gamepad::buttons::BTN_NORTH));

    let touchpad = TouchpadMessage {
        buttons_mask: touchpad::buttons::BTN_LEFT | touchpad::buttons::TAP_CLICK,
        ..Default::default()
    };
    assert!(touchpad.is_left_pressed());
    assert!(!touchpad.is_right_pressed());
    assert!(touchpad.is_tap_click());

    let keyboard = KeyboardMessage {
        modifiers: keyboard::modifiers::CTRL | keyboard::modifiers::ALT,
        ..Default::default()
    };
    assert!(keyboard.has_ctrl());
    assert!(!keyboard.has_shift());
    assert!(keyboard.has_alt());
    assert!(!keyboard.has_meta());
}

#[test]
fn test_mode_switch_codec() {
    let msg = ModeSwitchMessage::new(
        control_modes::GAMEPAD,
        mode_switch_flags::IS_MANUAL_OVERRIDE | mode_switch_flags::IS_ENFORCED_BY_HOST,
    );
    assert!(msg.is_manual_override());
    assert!(msg.is_enforced_by_host());

    let header =
        lookaremote_protocol::Header::new(MessageType::ModeSwitch, HeaderFlags::empty(), 42);
    let packet = lookaremote_protocol::Packet::new(header, Payload::ModeSwitch(msg));

    let encoded = encode_packet(&packet).expect("Encoding mode switch succeeds");
    assert_eq!(encoded.len(), MODE_SWITCH_TOTAL_SIZE);
    assert_eq!(encoded.len(), 7);

    let decoded = decode_packet(encoded.as_slice()).expect("Decoding mode switch succeeds");
    assert_eq!(decoded.header.sequence, 42);
    assert_eq!(decoded.header.msg_type, MessageType::ModeSwitch);

    if let Payload::ModeSwitch(decoded_msg) = decoded.payload {
        assert_eq!(decoded_msg.target_mode, control_modes::GAMEPAD);
        assert_eq!(decoded_msg.flags, 0x03);
        assert!(decoded_msg.is_manual_override());
        assert!(decoded_msg.is_enforced_by_host());
    } else {
        panic!("Expected Payload::ModeSwitch");
    }
}

#[test]
fn test_slot_assignment_codec() {
    let msg = SlotAssignmentMessage::new(1, "Gaming Rig").with_battery(85);

    assert_eq!(msg.player_index, 1);
    assert_eq!(msg.player_color_rgb565, player_colors::P2_MAGENTA);
    assert_eq!(msg.battery_level, 85);
    assert_eq!(msg.host_name_str(), "Gaming Rig");

    let header =
        lookaremote_protocol::Header::new(MessageType::SlotAssignment, HeaderFlags::empty(), 100);
    let packet = lookaremote_protocol::Packet::new(header, Payload::SlotAssignment(msg));

    let encoded = encode_packet(&packet).expect("Encoding slot assignment succeeds");
    assert_eq!(encoded.len(), SLOT_ASSIGNMENT_TOTAL_SIZE);
    assert_eq!(encoded.len(), 25);

    let decoded = decode_packet(encoded.as_slice()).expect("Decoding slot assignment succeeds");
    assert_eq!(decoded.header.sequence, 100);
    assert_eq!(decoded.header.msg_type, MessageType::SlotAssignment);

    if let Payload::SlotAssignment(decoded_msg) = decoded.payload {
        assert_eq!(decoded_msg.player_index, 1);
        assert_eq!(decoded_msg.player_color_rgb565, player_colors::P2_MAGENTA);
        assert_eq!(decoded_msg.battery_level, 85);
        assert_eq!(decoded_msg.host_name_str(), "Gaming Rig");
    } else {
        panic!("Expected Payload::SlotAssignment");
    }
}

#[test]
fn test_gamepad_player_index_codec() {
    let msg = GamepadFullMessage {
        buttons: gamepad::buttons::BTN_SOUTH,
        stick_lx: 1000,
        stick_ly: -2000,
        stick_rx: 3000,
        stick_ry: -4000,
        trigger_l: 128,
        trigger_r: 255,
        player_index: 3,
        reserved: 0,
    };

    let header =
        lookaremote_protocol::Header::new(MessageType::GamepadFull, HeaderFlags::empty(), 77);
    let packet = lookaremote_protocol::Packet::new(header, Payload::GamepadFull(msg));

    let encoded = encode_packet(&packet).expect("Encoding gamepad succeeds");
    assert_eq!(encoded.len(), GAMEPAD_FULL_TOTAL_SIZE);
    assert_eq!(encoded.len(), 19);

    let decoded = decode_packet(encoded.as_slice()).expect("Decoding gamepad succeeds");
    assert_eq!(decoded.header.sequence, 77);
    if let Payload::GamepadFull(decoded_msg) = decoded.payload {
        assert_eq!(decoded_msg.player_index, 3);
        assert_eq!(decoded_msg.buttons, gamepad::buttons::BTN_SOUTH);
        assert_eq!(decoded_msg.trigger_l, 128);
        assert_eq!(decoded_msg.trigger_r, 255);
    } else {
        panic!("Expected Payload::GamepadFull");
    }
}

#[test]
fn test_tv_command_codec() {
    let msg = TvCommandMessage {
        command_code: tv_commands::CHANNEL_UP,
        target_device: tv_target_devices::SAMSUNG_TIZEN,
        flags: 0x01,
    };

    let header =
        lookaremote_protocol::Header::new(MessageType::TvCommand, HeaderFlags::empty(), 123);
    let packet = lookaremote_protocol::Packet::new(header, Payload::TvCommand(msg));

    let encoded = encode_packet(&packet).expect("Encoding TV command succeeds");
    assert_eq!(encoded.len(), TV_COMMAND_TOTAL_SIZE);
    assert_eq!(encoded.len(), 9);

    let decoded = decode_packet(encoded.as_slice()).expect("Decoding TV command succeeds");
    assert_eq!(decoded.header.sequence, 123);
    assert_eq!(decoded.header.msg_type, MessageType::TvCommand);

    if let Payload::TvCommand(decoded_msg) = decoded.payload {
        assert_eq!(decoded_msg.command_code, tv_commands::CHANNEL_UP);
        assert_eq!(decoded_msg.target_device, tv_target_devices::SAMSUNG_TIZEN);
        assert_eq!(decoded_msg.flags, 0x01);
    } else {
        panic!("Expected Payload::TvCommand");
    }
}

#[test]
fn test_tv_text_input_codec() {
    let msg = TvTextInputMessage::from_str_truncate("Stranger Things 4K");
    assert_eq!(msg.as_str(), "Stranger Things 4K");
    assert_eq!(msg.length, 18);

    let header =
        lookaremote_protocol::Header::new(MessageType::TvTextInput, HeaderFlags::empty(), 555);
    let packet = lookaremote_protocol::Packet::new(header, Payload::TvTextInput(msg));

    let encoded = encode_packet(&packet).expect("Encoding TV text succeeds");
    assert_eq!(encoded.len(), TV_TEXT_TOTAL_SIZE);
    assert_eq!(encoded.len(), 37);

    let decoded = decode_packet(encoded.as_slice()).expect("Decoding TV text succeeds");
    assert_eq!(decoded.header.sequence, 555);
    assert_eq!(decoded.header.msg_type, MessageType::TvTextInput);

    if let Payload::TvTextInput(decoded_msg) = decoded.payload {
        assert_eq!(decoded_msg.as_str(), "Stranger Things 4K");
        assert_eq!(decoded_msg.length, 18);
    } else {
        panic!("Expected Payload::TvTextInput");
    }
}
