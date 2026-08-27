//! Criterion High-Performance Zero-Allocation Codec Benchmarks.
//! Measures serialize/deserialize throughput and latency for all 8 protocol message opcodes.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use lookaremote_protocol::{
    decode_packet, encode_packet, messages::*, Header, HeaderFlags, MessageType, Packet, Payload,
};

fn bench_all_codecs_encode(c: &mut Criterion) {
    let mut group = c.benchmark_group("protocol_encode_v1");

    // 1. MSG_MOTION (0x01)
    let motion_pkt = Packet::new(
        Header::new(MessageType::Motion, HeaderFlags::empty(), 100),
        Payload::Motion(MotionMessage {
            gyro_yaw: 1500,
            gyro_pitch: -2500,
            gyro_roll: 3000,
            accel_x: 981,
            accel_y: -50,
            accel_z: 1020,
            timestamp_us: 1234567,
        }),
    );

    // 2. MSG_GAMEPAD_FULL (0x02)
    let gamepad_pkt = Packet::new(
        Header::new(MessageType::GamepadFull, HeaderFlags::empty(), 101),
        Payload::GamepadFull(GamepadFullMessage {
            buttons: gamepad::buttons::BTN_SOUTH
                | gamepad::buttons::BTN_R1
                | gamepad::buttons::DPAD_UP,
            stick_lx: -15000,
            stick_ly: 20000,
            stick_rx: 1200,
            stick_ry: -1000,
            trigger_l: 200,
            trigger_r: 50,
            player_index: 0,
            reserved: 0,
        }),
    );

    // 3. MSG_TOUCHPAD (0x04)
    let touchpad_pkt = Packet::new(
        Header::new(MessageType::Touchpad, HeaderFlags::empty(), 103),
        Payload::Touchpad(TouchpadMessage {
            dx: 45,
            dy: -30,
            scroll_v: 2,
            scroll_h: -1,
            buttons_mask: touchpad::buttons::BTN_LEFT,
        }),
    );

    // 4. MSG_KEYBOARD (0x05)
    let keyboard_pkt = Packet::new(
        Header::new(MessageType::Keyboard, HeaderFlags::empty(), 104),
        Payload::Keyboard(KeyboardMessage {
            key_code: 0x04,  // 'A'
            state: 1,        // KeyDown
            modifiers: 0x02, // Shift
        }),
    );

    // 5. MSG_MEDIA (0x06)
    let media_pkt = Packet::new(
        Header::new(MessageType::Media, HeaderFlags::empty(), 105),
        Payload::Media(MediaMessage {
            media_action: media::actions::PLAY_PAUSE,
            reserved: 0,
        }),
    );

    // 6. MSG_MODE_SWITCH (0x07)
    let mode_switch_pkt = Packet::new(
        Header::new(MessageType::ModeSwitch, HeaderFlags::empty(), 106),
        Payload::ModeSwitch(ModeSwitchMessage {
            target_mode: 0x01, // Gamepad
            flags: 0x00,
        }),
    );

    // 7. MSG_HEARTBEAT (0x08)
    let heartbeat_pkt = Packet::new(
        Header::new(MessageType::Heartbeat, HeaderFlags::empty(), 107),
        Payload::Heartbeat(HeartbeatMessage {
            client_epoch_ms: 987654321,
            echo_token: 42,
        }),
    );

    // 8. MSG_HAPTIC_EVENT (0x0A)
    let haptic_pkt = Packet::new(
        Header::new(MessageType::HapticEvent, HeaderFlags::empty(), 102),
        Payload::HapticEvent(HapticEventMessage {
            motor_index: haptic::motors::MOTOR_BOTH,
            intensity: 255,
            duration_ms: 150,
        }),
    );

    group.bench_function("encode_motion_0x01", |b| {
        b.iter(|| encode_packet(black_box(&motion_pkt)))
    });

    group.bench_function("encode_gamepad_0x02", |b| {
        b.iter(|| encode_packet(black_box(&gamepad_pkt)))
    });

    group.bench_function("encode_touchpad_0x04", |b| {
        b.iter(|| encode_packet(black_box(&touchpad_pkt)))
    });

    group.bench_function("encode_keyboard_0x05", |b| {
        b.iter(|| encode_packet(black_box(&keyboard_pkt)))
    });

    group.bench_function("encode_media_0x06", |b| {
        b.iter(|| encode_packet(black_box(&media_pkt)))
    });

    group.bench_function("encode_mode_switch_0x07", |b| {
        b.iter(|| encode_packet(black_box(&mode_switch_pkt)))
    });

    group.bench_function("encode_heartbeat_0x08", |b| {
        b.iter(|| encode_packet(black_box(&heartbeat_pkt)))
    });

    group.bench_function("encode_haptic_0x0A", |b| {
        b.iter(|| encode_packet(black_box(&haptic_pkt)))
    });

    group.finish();
}

fn bench_all_codecs_decode(c: &mut Criterion) {
    let mut group = c.benchmark_group("protocol_decode_v1");

    let motion_raw = [
        0x01, 0x01, 0x00, 0x01, 0x00, // Header
        0xDC, 0x05, 0x3C, 0xF6, 0xB8, 0x0B, // Gyro
        0xD5, 0x03, 0xCE, 0xFF, 0xFC, 0x03, // Accel
        0x87, 0xD6, 0x12, 0x00, // Timestamp
    ];

    let gamepad_raw = [
        0x01, 0x02, 0x00, 0x02, 0x00, // Header
        0x11, 0x00, // Buttons
        0x68, 0xC5, 0x20, 0x4E, // Left Stick
        0x00, 0x00, 0x18, 0xFC, // Right Stick
        0xC8, 0x32, 0x00, 0x00, // Triggers + Reserved
    ];

    let touchpad_raw = [
        0x01, 0x04, 0x00, 0x04, 0x00, // Header
        0x32, 0x00, 0xEC, 0xFF, // dx, dy
        0x02, 0x00, 0x01, // scroll_v, scroll_h, buttons
    ];

    let keyboard_raw = [
        0x01, 0x05, 0x00, 0x05, 0x00, // Header
        0x04, 0x00, 0x01, 0x02, // key_code (u16), state (u8), modifiers (u8)
    ];

    let media_raw = [
        0x01, 0x06, 0x00, 0x06, 0x00, // Header
        0x01, 0x00, // action (Play/Pause), reserved
    ];

    let mode_switch_raw = [
        0x01, 0x07, 0x00, 0x07, 0x00, // Header
        0x01, 0x00, // target_mode (Gamepad), flags
    ];

    let heartbeat_raw = [
        0x01, 0x08, 0x00, 0x08, 0x00, // Header
        0x10, 0x20, 0x30, 0x40, // client_epoch_ms
        0x2A, 0x00, 0x00, 0x00, // echo_token: 42
    ];

    let haptic_raw = [
        0x01, 0x0A, 0x00, 0x03, 0x00, // Header (0x0A: HapticEvent)
        0x02, 0xFF, 0x96, 0x00, // motor_index (2), intensity (255), duration_ms (150)
    ];

    group.bench_function("decode_motion_0x01", |b| {
        b.iter(|| decode_packet(black_box(&motion_raw)))
    });

    group.bench_function("decode_gamepad_0x02", |b| {
        b.iter(|| decode_packet(black_box(&gamepad_raw)))
    });

    group.bench_function("decode_touchpad_0x04", |b| {
        b.iter(|| decode_packet(black_box(&touchpad_raw)))
    });

    group.bench_function("decode_keyboard_0x05", |b| {
        b.iter(|| decode_packet(black_box(&keyboard_raw)))
    });

    group.bench_function("decode_media_0x06", |b| {
        b.iter(|| decode_packet(black_box(&media_raw)))
    });

    group.bench_function("decode_mode_switch_0x07", |b| {
        b.iter(|| decode_packet(black_box(&mode_switch_raw)))
    });

    group.bench_function("decode_heartbeat_0x08", |b| {
        b.iter(|| decode_packet(black_box(&heartbeat_raw)))
    });

    group.bench_function("decode_haptic_0x0A", |b| {
        b.iter(|| decode_packet(black_box(&haptic_raw)))
    });

    group.finish();
}

criterion_group!(benches, bench_all_codecs_encode, bench_all_codecs_decode);
criterion_main!(benches);
