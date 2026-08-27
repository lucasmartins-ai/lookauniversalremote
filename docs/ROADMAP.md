# Engineering Roadmap & Sprint Plan — LookARemote

**Document ID:** ROAD-2026-001  
**Status:** Complete / Production Release  
**Author:** Technical Product Lead & Principal Architect  

---

## 1. Phased Architecture & Release Roadmap

```text
Phase 0: Specifications, ADRs, Threat Model & Protocol Definition [COMPLETE]
  │
  ▼
Phase 1: Core Monorepo Setup, Protocol Crates & Shared Types [COMPLETE]
  │
  ▼
Phase 2: Rust Host Daemon — Signaling, WebRTC DataChannel & Watchdog [COMPLETE]
  │
  ▼
Phase 3: PWA Web Client — UI Shell, WebRTC Transport & Pairing Scanner [COMPLETE]
  │
  ▼
Phase 4: Gamepad Engine — Dual Stick, Action Buttons & Virtual Driver (ViGEm/uinput) [COMPLETE]
  │
  ▼
Phase 5: IMU Sensor Pipeline — Gyro Aiming, Deadzone & Adaptive 120Hz Sampler [COMPLETE]
  │
  ▼
Phase 6: Desktop Control — Multi-touch Trackpad, Keyboard & Media Remote [COMPLETE]
  │
  ▼
Phase 7: Smart Context Engine — Foreground App Detection & Auto-Mode Switching [COMPLETE]
  │
  ▼
Phase 8: Cross-Platform Hardening (Windows, Linux, macOS) & Performance Profiling [COMPLETE]
  │
  ▼
Phase 9: CI/CD Matrix, Packaging (.tar.gz, .zip), Documentation & Release [COMPLETE]
```

---

## 2. Sprint Specifications Breakdown

### Sprint 1: Monorepo Foundation & Protocol Core [COMPLETE]
- **Goal:** Establish monorepo structure, shared TypeScript/Rust protocol packages, and zero-allocation binary codec test suite.
- **Deliverables:**
  - `packages/protocol`: Rust crate with `packet_decoder`, `packet_encoder`, unit tests, Criterion benchmarks.
  - `packages/protocol-types`: TypeScript serialization library with Vitest coverage.
  - Verification: 100% cross-language binary compatibility tests.

### Sprint 2: Host Daemon Transport & Local Signaling [COMPLETE]
- **Goal:** Rust daemon hosting Axum local signaling server, ephemeral QR code pairing generator, and WebRTC DataChannel endpoint.
- **Deliverables:**
  - `apps/host-daemon/src/transport/`: WebRTC peer setup via `webrtc` (pure Rust `webrtc-rs`), zero-retransmit (`max_retransmits: 0`, `ordered: false`) DataChannel handler, and local network RFC 1918 discovery/WAN isolation.
  - `apps/host-daemon/src/pairing/`: Ephemeral X25519 pairing, Diffie-Hellman shared secret derivation, HMAC-SHA256 authentication proofs, 60s TTL Nonce Manager (single-use replay attack protection), and terminal ANSI/Unicode QR code generator.
  - `apps/host-daemon/src/input/watchdog.rs`: 100ms dead-man safety watchdog with 10ms sampling interval and emergency input neutralization trigger.
  - Comprehensive Test Suite: 22 tests across `pairing_tests.rs`, `signaling_tests.rs`, `watchdog_tests.rs`, `webrtc_e2e_tests.rs`, and `codec_tests.rs`.

### Sprint 3: Mobile PWA Client Core & Pairing UX [COMPLETE]
- **Goal:** Zero-install React 19 + Vite PWA client with dark OLED UI (#000000), QR scanner, ephemeral X25519 + HMAC-SHA256 handshake, WebRTC DataChannel (`ordered: false`, `maxRetransmits: 0`), and real-time latency HUD.
- **Deliverables:**
  - `apps/web-client/src/ui/`: Pure OLED `#000000` design system tokens, `100dvh` viewport, `touch-action: none` / `user-select: none` lock, Screen Wake Lock integration (`useWakeLock.ts`), and tactile `HapticEngine` (`navigator.vibrate`).
  - `apps/web-client/src/features/pairing/`: QR scanner (`@zxing/browser`) with laser HUD & camera switcher, `ManualPairView.tsx`, and `pairingCrypto.ts` implementing ephemeral X25519 Diffie-Hellman & HMAC-SHA256 authentication proof with `POST /api/pair`.
  - `apps/web-client/src/transport/`: `WebRtcTransport.ts` (`ordered: false`, `maxRetransmits: 0`), `SignalingClient.ts` (WebSocket `/ws/signaling`), and `ProtocolBridge.ts` with `@lookaremote/protocol-types` binary serialization.
  - `apps/web-client/src/features/connection/`: `LatencyHud.tsx` telemetry badge (RTT in ms/μs, packet counters, jitter, watchdog status, color coding: 🟢 < 8ms, 🟡 8-25ms, 🔴 > 25ms).
  - Comprehensive Test Suite: 15 Vitest tests across `pairingCrypto.test.ts`, `signalingClient.test.ts`, `protocolBridge.test.ts`, and `webrtcTransport.test.ts`.

### Sprint 4: Gamepad Mode & OS Virtual Drivers [COMPLETE]
- **Goal:** Real-time dual-stick virtual controller with Linux `/dev/uinput`, Windows `ViGEmBus`, and macOS/CI mock driver integration, multi-touch PointerEvents, 120Hz sampler, and watchdog safety pipeline.
- **Deliverables:**
  - `apps/web-client/src/features/gamepad/`: `VirtualJoystick.tsx` (radial deadzones, linear rescaling, spring snap), `ActionDiamond.tsx` (A/B/X/Y neon cluster with sliding touch), `DPad.tsx` (8-way directional cross), `ShoulderTriggers.tsx` (LB/RB bumpers and LT/RT analog pressure sliders $\in [0, 255]$), `SystemButtons.tsx` (Start, Select, Guide/Home, L3, R3), `useGamepadState.ts` (atomic state consolidator), and `GamepadSampler.ts` (120Hz decoupled input loop).
  - `apps/web-client/src/features/settings/GamepadSettingsTab.tsx`: Calibration for deadzones (0..40%), sensitivity (0.5x..2.0x), stick Y inversion, floating joysticks, and sampling rate (60Hz/120Hz).
  - `apps/host-daemon/src/drivers/`: `VirtualGamepadDriver` trait with `UInputGamepadDriver` (Linux `/dev/uinput` Xbox 360 controller), `ViGEmGamepadDriver` (Windows `ViGEmBus` XInput), and `MockGamepadDriver` (macOS/CI).
  - `apps/host-daemon/src/input/router.rs`: `InputRouter` with `DeadManWatchdog` (100ms) instant emergency input neutralization.
  - Comprehensive Test Suite: 26 Vitest tests in `@lookaremote/web-client` and 18 Rust integration/unit tests across the workspace.

### Sprint 5: Gyroscope Aiming & IMU Sensor Pipeline [COMPLETE]
- **Goal:** Real-time high-rate smartphone IMU motion capture (120Hz/60Hz), MEMS zero-rate drift auto-calibration, complementary EMA low-pass filtering, radial angular deadzones, Splatoon/Steam Deck yaw-roll combination, and host mouse delta / additive right stick injection.
- **Deliverables:**
  - `apps/web-client/src/sensors/`: `ImuSensorPipeline.ts` (DeviceMotionEvent listener, iOS Safari permissions, deg/s $\to$ rad/s conversion), `BiasCalibrator.ts` (resting bias averaging, disturbance detection, localStorage persistence), `MotionFilters.ts` (radial deadzone, EMA smoothing $<2\text{ms}$ delay, yaw-roll blending, sensitivity), `MotionSampler.ts` (120Hz decoupled loop streaming `MSG_MOTION` `0x01`), and `GyroAimController.ts` (Always On, Hold LT, Toggle Aim, Disabled).
  - `apps/web-client/src/features/settings/`: `GyroCalibrateModal.tsx` (interactive calibration wizard with stability gauge), `GyroSettingsTab.tsx` (sensitivity, deadzone, smoothing, roll mix, trigger mode sliders), and `GamepadView.tsx` HUD gyro status badge (🟢 Active / ⚪ Idle).
  - `apps/host-daemon/src/drivers/mouse_driver.rs`: `VirtualMouseDriver` trait with Linux `/dev/uinput` relative mouse driver and in-memory `MockMouseDriver`.
  - `apps/host-daemon/src/input/motion_processor.rs`: `MotionProcessor` converting angular rate (rad/s) into relative mouse cursor deltas $(dx, dy)$ with sub-pixel residual accumulation and additive right stick $(RS_x, RS_y)$ deflection clamped strictly to $[-32768, 32767]$.
  - `apps/host-daemon/src/input/router.rs`: `InputRouter` dispatching `InputEvent::Motion` and `InputEvent::Touchpad` with complete emergency neutralization.
  - Comprehensive Test Suite: 42 Vitest tests in `@lookaremote/web-client` and 23 Rust integration/unit tests across the workspace.

### Sprint 6: Desktop Trackpad, Keyboard & Media Controls [COMPLETE]
- **Goal:** Multi-touch gesture trackpad, full screen virtual keyboard overlay, sticky modifiers, productivity macros, consumer media control deck, and OS virtual keyboard/media drivers.
- **Deliverables:**
  - `apps/web-client/src/features/trackpad/`: `GestureRecognizer.ts` (1-finger ballistic cursor motion, tap-to-click, 2-finger smooth vertical/horizontal scroll with natural scrolling, 2-finger right-click tap, and double-tap drag), `TrackpadSurface.tsx` (OLED glass surface with active touch visualization), `TrackpadView.tsx` (trackpad view with physical virtual buttons L/M/R), and `TrackpadSettingsTab.tsx`.
  - `apps/web-client/src/features/keyboard/`: `HidKeyMapper.ts` (USB HID Usage IDs, char-to-HID translation, and modifier bitmasks), `KeyboardDeck.tsx` (sticky Ctrl/Alt/Shift/Cmd modifiers, IME bridge for native smartphone typing, F1..F12, directional navigation pad, and productivity macros), and `KeyboardView.tsx`.
  - `apps/web-client/src/features/media/`: `MediaRemoteView.tsx` (dedicated OLED media deck with Play/Pause, Next, Prev, Stop, Vol+, Vol-, and Mute with hold-to-repeat).
  - `apps/host-daemon/src/drivers/keyboard_driver.rs`: `VirtualKeyboardDriver` trait with `UInputKeyboardDriver` (Linux `/dev/uinput` standard keyboard + media keys) and `MockKeyboardDriver`.
  - `apps/host-daemon/src/input/router.rs`: `InputRouter` routing `MSG_TOUCHPAD` (`0x04`), `MSG_KEYBOARD` (`0x05`), and `MSG_MEDIA` (`0x06`) with emergency watchdog neutralization.
  - Comprehensive Test Suite: 53 Vitest tests in `@lookaremote/web-client` and 29 Rust integration/unit tests across the workspace.

### Sprint 7: Smart Context Engine & Dynamic Modes [COMPLETE]
- **Goal:** Real-time host foreground window detection, configurable profile engine (`config.toml`), 4-tier priority arbitrator (Emergency > Manual Override > Profile Match > Default), bidirectional binary `MSG_MODE_SWITCH` (`0x07`) protocol, and mobile HUD transition toast notifications.
- **Deliverables:**
  - `packages/protocol` & `packages/protocol-types`: `MSG_MODE_SWITCH` opcode `0x07` (7 bytes total, 2 bytes payload: `target_mode: u8`, `flags: u8`), with unit tests and TypeScript codecs.
  - `config.toml`: Declarative configuration supporting polling intervals, debounce thresholds, fallback default modes, and profile rule matching (process names + case-insensitive regex on window titles).
  - `apps/host-daemon/src/context/`:
    - `window_detector.rs`: Non-blocking platform abstraction trait (`LinuxWindowDetector` via `_NET_ACTIVE_WINDOW`/`xdotool`, `WindowsWindowDetector` via `GetForegroundWindow`, `MacOSWindowDetector` via `NSWorkspace`, and `MockWindowDetector`).
    - `profile.rs`: TOML parser, schema validator, and `ProfileMatcher`.
    - `arbitrator.rs`: `ContextArbitrator` strictly enforcing the 4-tier arbitration priority hierarchy.
    - `watcher.rs`: `ContextWatcher` debounced loop (200ms default) with zero-cost DataChannel broadcasting.
  - `apps/web-client/src/features/context/`: `useSmartContext.ts` hook, `ContextToast.tsx` neon OLED HUD banner with quick manual lock/dismiss, and `ContextSettingsTab.tsx` in settings modal.
  - Comprehensive Test Suite: 61 Vitest tests in `@lookaremote/web-client`, 23 Vitest tests in `@lookaremote/protocol-types`, and 34 Rust integration/unit tests (42 total across workspace).

### Sprint 9: Multi-Controller Party Mode, Desktop System Tray Companion & Custom Touch Studio [COMPLETE]
- **Goal:** Support up to 4 concurrent smartphone controller peers (P1..P4) with dynamic slot allocation, player color identifiers, slot isolation, binary protocol extension `MSG_SLOT_ASSIGNMENT` (`0x0B`), driver virtualization, desktop System Tray Companion (`tray-item`) with status monitoring and local browser QR Code launcher (`/qr`), visual Custom Touch Layout Studio with magnetic grid snapping, custom macro and turbo auto-fire buttons, layout presets (Xbox, FPS Claw, Fighting Arcade), JSON import/export, and Battery Status API telemetry with multi-motor haptics.
- **Deliverables:**
  - `packages/protocol` & `packages/protocol-types`:
    - `MSG_SLOT_ASSIGNMENT` opcode `0x0B` (25-byte frame, 20-byte payload: `slot_index: u8`, `player_color_rgb565: u16`, `battery_level: u8`, `host_name: [u8; 16]`).
    - `MSG_GAMEPAD_FULL` (`0x02`) updated with `player_index: u8` (byte 12) without breaking 14-byte payload size.
    - Zero-allocation Rust and TypeScript codecs with unit and golden vector test coverage.
  - `apps/host-daemon`:
    - `core/multi_peer.rs`: `MultiPeerSessionManager` managing fixed 4 player slots (`MAX_PEERS = 4`), session ID indexing, dynamic allocation/deallocation, and real-time battery & RTT telemetry tracking.
    - `transport/signaling.rs` & `transport/webrtc.rs`: Multi-peer pairing endpoint (`POST /api/pair`) with slot capacity check (rejecting 5th peer with HTTP 409 Conflict), slot assignment dispatch on DataChannel open, and slot-isolated WebSockets (`GET /ws/signaling?session_id=...`).
    - `transport/qr_page.rs`: Cyberpunk OLED HTML pairing page served at `GET /qr` rendering live SVG pairing QR code.
    - `tray/companion.rs`: Desktop System Tray Companion with live status labels, QR Code launcher in browser, connected devices inspector, active mode overrides, config opener, and graceful daemon exit.
    - `drivers/`: Multi-controller virtual driver routing in `InputRouter` with isolated neutralization per player slot.
  - `apps/web-client`:
    - `features/battery/useBatteryTelemetry.ts`: Battery Status API hook streaming battery percentage and charging state to host daemon every 30s.
    - `features/haptics/HapticEngine.ts`: Expanded haptic engine with pulse width modulated rumble emulation and directional multi-motor feedback (`left` heavy / `right` light).
    - `features/multiplayer/PlayerBadge.tsx` & `features/connection/LatencyHud.tsx`: Real-time player slot badge (`P1`..`P4`) with dynamic accent colors (`#00E5FF`, `#FF007F`, `#FFE600`, `#00FF66`) and battery percentage indicator.
    - `features/studio/`: Custom Touch Layout Studio with live canvas, magnetic snap-to-grid (8px/16px/24px), draggable/resizable element controls, toolbox palette (Button, Stick, D-Pad, Trigger, Turbo Fire 5..30Hz, Macro Combos, Touchpad), built-in presets (Xbox, FPS Claw, 6-Button Arcade), properties inspector, and JSON import/export via `localStorage`.
  - Comprehensive Test Suite: 69 Vitest tests in `@lookaremote/web-client`, 27 Vitest tests in `@lookaremote/protocol-types`, and 48 Rust integration/unit tests across the workspace passing with 100% success and 0 compilation warnings.

