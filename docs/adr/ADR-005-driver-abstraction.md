# ADR-005: OS Virtual Driver Abstraction Strategy

**Status:** Accepted  
**Date:** 2026-08-26  
**Context:** The host daemon must synthesize gamepad, mouse, keyboard, and media events across Windows, Linux, and macOS without coupling the core protocol or input routing logic to platform-specific system headers or kernel drivers.

---

## Decision
Define a unified `InputBackend` Rust trait and decouple platform-specific implementations into dedicated submodules (`drivers/windows.rs`, `drivers/linux.rs`, `drivers/macos.rs`, and a headless `drivers/mock.rs` for automated integration testing).

---

## Rationale
1. **Separation of Concerns:** Protocol decoding and safety watchdog logic remain completely platform-agnostic and testable on any OS.
2. **Platform Native Drivers:**
   - *Windows:* ViGEmBus client for virtual Xbox 360 / DualShock 4 gamepads; Win32 `SendInput` with hardware scan codes for mouse/keyboard.
   - *Linux:* Kernel `/dev/uinput` ioctls directly emitting `EV_KEY`, `EV_REL`, and `EV_ABS` events without external daemon dependencies.
   - *macOS:* Quartz `CGEvent` services for mouse/keyboard; VirtualHID / IOHIDEvent for gamepad.
3. **Graceful Driver Degradation:** If a specific driver component is missing (e.g. ViGEmBus not installed on Windows), the daemon dynamically disables gamepad mode while maintaining mouse, keyboard, and media remote capabilities.

---

## Alternatives Considered
- **Direct Ad-Hoc System Calls in Input Router:** Faster initial prototyping, but results in tangled conditional compilation (`#[cfg(target_os = ...)]`), inability to unit test on non-native hosts, and brittle architecture.
- **Cross-Platform C Libraries (e.g. Enigo, libuiohook):** Convenient, but often lack virtual gamepad emulation (Xbox/PS4) and have high latency or blocking behavior in multi-threaded environments.

---

## Trade-offs
- Requires implementing and maintaining three distinct platform driver backends.
- Gamepad support on macOS is experimental due to strict macOS driver signing and kernel extensions policies.

---

## Consequences
- Clean, modular architecture with clear boundary interfaces.
- Headless mock drivers enable 100% CI test coverage on any operating system.

---

## Revisit When
- Revisit when unified cross-platform user-space HID emulation standards mature.
