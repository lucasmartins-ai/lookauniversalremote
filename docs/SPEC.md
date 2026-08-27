# System Requirements Specification (SRS) — LookARemote Universal Remote

**Document ID:** SRS-2026-001  
**Status:** Approved / Extended Specification  
**System Name:** Universal Smart Remote (Project: LookARemote)  
**Version:** 1.1.0  

---

## 1. Introduction

### 1.1 Purpose
This specification defines the functional, non-functional, interface, security, and performance requirements for **LookARemote** — an ultra-low-latency, zero-install, local-first universal remote control ecosystem.
- **Primary Hero Platform:** **Smart TV & Streaming Devices** (Samsung Tizen, LG webOS, Android TV / Google TV / Fire TV, Roku, Sony Bravia, Apple TV) with full channel changing, direct TV text typing/search, volume/mute control, TV settings & 5-way D-Pad, streaming app shortcuts, 4 TV color buttons, and Gyroscope Air Mouse (Magic Remote pointer).
- **Secondary Target Platforms:** **Gaming Consoles** (PlayStation, Xbox, Nintendo Switch, Steam Deck) and **Desktop Computers** (PC Windows, Linux, macOS) for gamepad, trackpad, keyboard, and media control.

### 1.2 Scope
The scope encompasses:
1. **Web Client (PWA):** Zero-install Progressive Web Application running on modern mobile browsers (iOS Safari, Android Chrome/Firefox) featuring:
   - Flagship **Smart TV Remote (`TvRemoteView`)**: Channel Rockers & 0-9 Numpad, Volume/Mute rocker with hold-to-repeat, 5-way circular D-Pad, Direct TV Text Input & Search box with voice typing, Streaming launchers (Netflix, YouTube, Prime, Disney, Spotify), and 4 color buttons.
   - **Gyroscope Air Mouse (`AirMouseView`)**: Magic Remote style pointer casting a precision cursor across the screen via smartphone IMU motion sensors with center recalibration, trigger click, drag lock, and scroll slider.
   - Multi-Device **Target Selector**: Fast 1-tap switching between Smart TV, PC/Mac, and Console.
   - Secondary Gamepad, Trackpad, Virtual Keyboard, and Media decks.
2. **Host Daemon & TV Gateway (Rust):** Zero-cloud daemon hosting local signaling, ephemeral X25519 pairing, WebRTC DataChannel streaming, safety watchdog, and multi-protocol Smart TV command dispatchers (Samsung Tizen WS, LG webOS SSAP, Android TV ADB/Keyevents, Roku ECP, Sony IRCC, and OS virtual drivers).
3. **Local Transport & Protocol:** Binary protocol v1 operating over WebRTC DataChannel (`ordered: false`, `maxRetransmits: 0` SCTP/DTLS/UDP) for input streams, including `MSG_TV_COMMAND` (0x0C) and `MSG_TV_TEXT_INPUT` (0x0D).
4. **Virtual Driver Subsystems:** Native OS driver layers (ViGEm/SendInput on Windows; `/dev/uinput` on Linux; `CGEvent` on macOS).

---

## 2. Overall Architectural Invariants & Principles

1. **Deterministic Hot Path:** The real-time input path (Sensor Capture → Binary Serialization → WebRTC DataChannel → Protocol Decoder → Input Router → TV Gateway / OS Driver) MUST be zero-allocation, lock-free or minimal-contention, and strictly isolated from heap churn, file I/O, and UI layout recalculations.
2. **Zero Cloud Dependency for Core Control:** All pairing, discovery, signaling, input transmission, watchdog monitoring, and driver dispatch MUST function entirely over the Local Area Network (LAN) without internet connectivity once PWA assets are cached.
3. **Fail-Safe Watchdog Guarantee:** Loss of network connection, browser closure, phone sleep, or packet timeouts MUST deterministically trigger immediate release of all virtual pressed keys, buttons, and axes within a maximum threshold of 100ms.
4. **Adaptive Sensor Transmission:** The mobile IMU pipeline must employ noise filtering, deadzones, change detection, and adaptive rate switching (10 Hz idle to 120 Hz active).
5. **No Arbitrary Code/Command Execution:** The protocol explicitly rejects generic command-line execution or shell invocation. Only strongly typed, bounded, enumerated input events and mode transitions are accepted.

---

## 3. Functional Requirements (FR)

### 3.1 Primary Mobile TV Remote & Multi-Device Modes
- **FR-01: Smart TV Remote Control:**
  - Channel Up/Down rocker, Previous Channel (Recall), Electronic Program Guide (EPG/Guide), and Info button.
  - Direct Channel Number Keypad (0-9, dot, dash, confirm).
  - Volume Up/Down rocker, Audio Mute, and hold-to-repeat ramp.
  - 5-Way Ergonomic D-Pad (Up, Down, Left, Right, OK / Select / Enter), Back/Return, and Exit.
  - Power / Standby toggle and Source / HDMI input selection.
  - 4 Traditional TV Color Buttons (Red, Green, Yellow, Blue).
  - 1-Tap Streaming App Launchers (Netflix, YouTube, Prime Video, Disney+, Spotify, Web Browser).
- **FR-02: Direct TV Text Input & Search:** Direct smartphone keyboard and voice-to-text input box streaming UTF-8 search queries to TV in a single low-latency packet.
- **FR-03: Gyroscope Air Mouse (Magic Remote):** Smartphone IMU angular rate processing translating hand tilt and orientation into on-screen pointer movement, with center recalibrate, click trigger, drag lock, and scroll slider.
- **FR-04: Gamepad Emulation (Console & PC):** Dual analog sticks with radial deadzones, D-Pad, 4 action buttons (A/B/X/Y), shoulder bumpers, analog triggers, and system buttons.
- **FR-05: Desktop Trackpad & Keyboard:** Ballistic 2D relative pointer, multi-touch gestures (1-finger click/drag, 2-finger scroll, 2-finger right-click), full virtual keyboard with sticky modifiers.

### 3.2 Transport & Networking
- **FR-07: Local WebRTC Transport:** Direct peer-to-peer data transport over LAN using WebRTC DataChannel (`ordered: false`, `maxRetransmits: 0`).
- **FR-08: Local Signaling:** Host-embedded lightweight HTTP/WebSocket signaling server binding to private LAN interfaces for SDP/ICE exchange.
- **FR-09: Discovery Hierarchy:** Automatic host discovery via mDNS (`_lookaremote._tcp.local`), QR-code pairing containing ephemeral connection tokens, and manual IP/port entry fallback.
- **FR-10: Capability Negotiation:** Handshake phase negotiating protocol version, supported controller features, haptic feedback capability, maximum frame rates, and OS driver limitations.

### 3.3 Host Daemon & OS Drivers
- **FR-11: Cross-Platform Virtual Input:**
  - *Windows:* ViGEmBus client (Xbox 360 / DualShock 4 virtual gamepad) + `SendInput` (mouse/keyboard).
  - *Linux:* Kernel `/dev/uinput` subsystem for virtual gamepad, mouse, and keyboard creation.
  - *macOS:* `CGEvent` synthesis for mouse/keyboard + Foohid/VirtualHID / IOHIDEvent for gamepad.
- **FR-12: Smart Context Engine:** Non-blocking background worker monitoring active foreground application, fullscreen state, and window titles to switch controller profiles automatically.
- **FR-13: Mode Priority Arbitration:** Strict priority hierarchy: Emergency/Failsafe (1) > User Explicit Override (2) > Application Profile Match (3) > Auto-Detected Context (4) > System Default (5).

---

## 4. Non-Functional Requirements (NFR)

### 4.1 Performance & Latency Budgets
- **NFR-01: LAN Transport Latency:** WebRTC DataChannel transit time over standard 5GHz 802.11ac/ax Wi-Fi: $P_{50} < 2.5\text{ ms}$, $P_{95} < 5.0\text{ ms}$, $P_{99} < 10.0\text{ ms}$.
- **NFR-02: End-to-End Latency:** Total latency from mobile touch/sensor event to OS input event injection: $P_{50} < 8\text{ ms}$, $P_{95} < 15\text{ ms}$.
- **NFR-03: Host Daemon Resource Overhead:** Idle CPU $< 0.1\%$, active 120Hz processing CPU $< 1.5\%$ of a single core; Resident Set Size (RSS) memory $< 25\text{ MB}$.
- **NFR-04: Mobile Client Overhead:** Zero garbage collection pauses in the hot path ($0\text{ alloc/frame}$ in sensor loop); battery consumption $< 8\%\text{ per hour}$ of active gaming/aiming.

### 4.2 Security & Threat Mitigation
- **NFR-05: Ephemeral QR Pairing:** QR codes contain single-use, time-bounded (60s lifetime) cryptographically random pairing secrets ($256\text{-bit}$ entropy) and host public keys.
- **NFR-06: Transport Encryption:** Mandatory DTLS 1.3 / AES-128-GCM encryption on WebRTC DataChannels.
- **NFR-07: Interface Isolation:** Daemon binds signaling and discovery strictly to RFC 1918 private IPv4 and link-local IPv6 addresses, preventing public WAN exposure.
- **NFR-08: Replay & Flooding Defense:** Sequence-numbered frames with sliding-window validation; token-bucket rate limiting ($300\text{ msgs/sec}$ max per client).

### 4.3 Reliability & Failsafe
- **NFR-09: Watchdog Dead-Man Switch:** Host watchdog resets all virtual axes to neutral and releases all virtual buttons within $100\text{ ms}$ if heartbeat/data packets cease.
- **NFR-10: Offline-First PWA:** Service Worker caching of HTML/JS/CSS/WebAssembly assets with Cache-First strategy ensuring $100\%$ operational availability without WAN connectivity.

---

## 5. Domain Model & Entities

```text
┌────────────────────────────────────────────────────────┐
│                        Session                         │
│  - session_id: Uuid                                    │
│  - device_id: String                                   │
│  - client_public_key: [u8; 32]                         │
│  - negotiated_version: u8                              │
│  - capabilities: CapabilityFlags                       │
│  - active_mode: ControllerMode                         │
│  - state: SessionState                                 │
│  - last_heartbeat_timestamp: Instant                   │
│  - last_sequence_num: u16                              │
└──────────────────────────┬─────────────────────────────┘
                           │ 1
                           ▼ 1..*
┌────────────────────────────────────────────────────────┐
│                      Input State                       │
│  - gamepad_buttons: u32 (bitfield)                     │
│  - left_stick: (f32, f32)                              │
│  - right_stick: (f32, f32)                             │
│  - triggers: (f32, f32)                                │
│  - motion_gyro: (f32, f32, f32)                        │
│  - motion_accel: (f32, f32, f32)                       │
│  - mouse_delta: (i16, i16)                             │
│  - mouse_buttons: u8                                   │
│  - active_keys: Set<KeyCode>                           │
└────────────────────────────────────────────────────────┘
```
