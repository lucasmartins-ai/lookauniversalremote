//! Criterion Benchmark for Host Daemon End-to-End Input Pipeline.
//! Measures the complete cycle latency from raw binary packet slice to InputRouter driver dispatch.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use lookaremote_host_daemon::drivers::{MockGamepadDriver, MockKeyboardDriver, MockMouseDriver};
use lookaremote_host_daemon::input::events::InputEvent;
use lookaremote_host_daemon::input::router::InputRouter;
use lookaremote_protocol::decode_packet;

fn bench_host_input_pipeline(c: &mut Criterion) {
    let mut group = c.benchmark_group("host_input_pipeline");

    let router = InputRouter::with_drivers(
        Box::new(MockGamepadDriver::new()),
        Box::new(MockMouseDriver::new()),
        Box::new(MockKeyboardDriver::new()),
    );

    // Raw Gamepad packet
    let gamepad_raw = [
        0x01, 0x02, 0x00, 0x01, 0x00, // Header
        0x11, 0x00,                   // Buttons: South | DPadUp
        0x68, 0xC5, 0x20, 0x4E,       // Left Stick
        0x00, 0x00, 0x18, 0xFC,       // Right Stick
        0xC8, 0x32, 0x00, 0x00,       // Triggers + Reserved
    ];

    // Raw Touchpad packet
    let touchpad_raw = [
        0x01, 0x04, 0x00, 0x02, 0x00, // Header
        0x32, 0x00, 0xEC, 0xFF,       // dx: 50, dy: -20
        0x02, 0x00, 0x01,             // scroll_v: 2, scroll_h: 0, buttons: 1
    ];

    // Raw Motion packet
    let motion_raw = [
        0x01, 0x01, 0x00, 0x03, 0x00, // Header
        0xDC, 0x05, 0x3C, 0xF6, 0xB8, 0x0B, // Gyro
        0xD5, 0x03, 0xCE, 0xFF, 0xFC, 0x03, // Accel
        0x87, 0xD6, 0x12, 0x00,       // Timestamp
    ];

    // Raw Keyboard packet
    let keyboard_raw = [
        0x01, 0x05, 0x00, 0x04, 0x00, // Header
        0x04, 0x00, 0x01, 0x02,       // 'A', KeyDown, Shift
    ];

    group.bench_function("pipeline_gamepad_dispatch", |b| {
        b.iter(|| {
            let pkt = decode_packet(black_box(&gamepad_raw)).unwrap();
            let event: InputEvent = pkt.into();
            router.route_event(black_box(&event)).unwrap();
        })
    });

    group.bench_function("pipeline_touchpad_dispatch", |b| {
        b.iter(|| {
            let pkt = decode_packet(black_box(&touchpad_raw)).unwrap();
            let event: InputEvent = pkt.into();
            router.route_event(black_box(&event)).unwrap();
        })
    });

    group.bench_function("pipeline_motion_dispatch", |b| {
        b.iter(|| {
            let pkt = decode_packet(black_box(&motion_raw)).unwrap();
            let event: InputEvent = pkt.into();
            router.route_event(black_box(&event)).unwrap();
        })
    });

    group.bench_function("pipeline_keyboard_dispatch", |b| {
        b.iter(|| {
            let pkt = decode_packet(black_box(&keyboard_raw)).unwrap();
            let event: InputEvent = pkt.into();
            router.route_event(black_box(&event)).unwrap();
        })
    });

    group.finish();
}

criterion_group!(benches, bench_host_input_pipeline);
criterion_main!(benches);
