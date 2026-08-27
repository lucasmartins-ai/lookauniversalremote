use criterion::{black_box, criterion_group, criterion_main, Criterion};
use lookaremote_protocol::{
    decode_packet, encode_packet, messages::*, Header, HeaderFlags, MessageType, Packet, Payload,
};

fn bench_protocol_encode(c: &mut Criterion) {
    let mut group = c.benchmark_group("protocol_encode");

    let motion_packet = Packet::new(
        Header::new(MessageType::Motion, HeaderFlags::empty(), 1),
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

    let gamepad_packet = Packet::new(
        Header::new(MessageType::GamepadFull, HeaderFlags::empty(), 2),
        Payload::GamepadFull(GamepadFullMessage {
            buttons: gamepad::buttons::BTN_SOUTH | gamepad::buttons::DPAD_UP,
            stick_lx: -15000,
            stick_ly: 20000,
            stick_rx: 0,
            stick_ry: -1000,
            trigger_l: 200,
            trigger_r: 50,
            player_index: 0,
            reserved: 0,
        }),
    );

    let touchpad_packet = Packet::new(
        Header::new(MessageType::Touchpad, HeaderFlags::empty(), 3),
        Payload::Touchpad(TouchpadMessage {
            dx: 50,
            dy: -20,
            scroll_v: 2,
            scroll_h: 0,
            buttons_mask: touchpad::buttons::BTN_LEFT,
        }),
    );

    group.bench_function("encode_motion", |b| {
        b.iter(|| encode_packet(black_box(&motion_packet)))
    });

    group.bench_function("encode_gamepad_full", |b| {
        b.iter(|| encode_packet(black_box(&gamepad_packet)))
    });

    group.bench_function("encode_touchpad", |b| {
        b.iter(|| encode_packet(black_box(&touchpad_packet)))
    });

    group.finish();
}

fn bench_protocol_decode(c: &mut Criterion) {
    let mut group = c.benchmark_group("protocol_decode");

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
        0x01, 0x04, 0x00, 0x03, 0x00, // Header
        0x32, 0x00, 0xEC, 0xFF, // dx, dy
        0x02, 0x00, 0x01, // scroll_v, scroll_h, buttons
    ];

    group.bench_function("decode_motion", |b| {
        b.iter(|| decode_packet(black_box(&motion_raw)))
    });

    group.bench_function("decode_gamepad_full", |b| {
        b.iter(|| decode_packet(black_box(&gamepad_raw)))
    });

    group.bench_function("decode_touchpad", |b| {
        b.iter(|| decode_packet(black_box(&touchpad_raw)))
    });

    group.finish();
}

criterion_group!(benches, bench_protocol_encode, bench_protocol_decode);
criterion_main!(benches);
