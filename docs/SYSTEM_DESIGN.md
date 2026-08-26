# Detailed System Design — Universal Remote (LookARemote)

**Document ID:** SYS-2026-001  
**Status:** Approved / Detailed Design  
**Author:** Principal Systems Architect  

---

## 1. Web Client (PWA) Subsystem Design

### 1.1 Architecture & Component Hierarchy
```text
apps/web-client/
├── src/
│   ├── app/
│   │   ├── App.tsx               # Root container, service worker registration
│   │   └── routes.tsx            # View transitions (Pairing, Remote, Settings)
│   ├── features/
│   │   ├── pairing/              # QR scanner, token storage, signaling init
│   │   ├── connection/           # WebRTC peer lifecycle, RTT stats, reconnect
│   │   ├── gamepad/              # Virtual dual-stick, D-pad, action triggers
│   │   ├── trackpad/             # Multi-touch gesture surface, scroll engine
│   │   ├── keyboard/             # Full keyboard overlay, modifiers, raw keys
│   │   ├── motion/               # Gyroscope aiming canvas, calibration dialog
│   │   └── media/                # Media controller surface (play/pause/vol)
│   ├── transport/
│   │   ├── ITransport.ts         # Transport interface abstraction
│   │   ├── WebRtcTransport.ts    # RTCPeerConnection, DataChannel wrapper
│   │   └── ProtocolEncoder.ts    # ArrayBuffer/DataView zero-alloc encoder
│   ├── sensors/
│   │   ├── ImuPipeline.ts        # IMU stream consumer, filter coordinator
│   │   ├── Calibration.ts        # Zero-bias calibration offset calculator
│   │   ├── KalmanFilter.ts       # Complementary/Kalman angular filter
│   │   ├── DeadzoneFilter.ts     # Radial and axis deadzone thresholding
│   │   └── AdaptiveSampler.ts    # Rate modulation (10Hz idle -> 120Hz active)
│   ├── ui/
│   │   ├── components/           # Button, Joystick, Toggle, StatusBadge
│   │   ├── haptics/              # Navigator.vibrate pulse generator
│   │   └── styles/               # CSS variables, high-contrast dark theme
│   └── workers/
│       └── sensor.worker.ts      # Off-thread sensor reader & frame dispatcher
```

### 1.2 IMU Sensor & Motion Processing Pipeline
To eliminate garbage collector jitter and ensure crisp aiming:
1. **Ring Buffer:** Fixed pre-allocated `Float32Array(1024)` storing circular historical IMU readings.
2. **Bias Calibration:** Upon user zeroing (or stationary detection over 1000ms), moving averages of $G_x, G_y, G_z$ are calculated and subtracted as drift bias offsets:
   $$\omega_{\text{calibrated}} = \omega_{\text{raw}} - \omega_{\text{bias}}$$
3. **Complementary / Low-Pass Filter:** Blends accelerometer tilt estimation with integrated gyroscope angular velocity:
   $$\theta_t = \alpha (\theta_{t-1} + \omega \cdot \Delta t) + (1 - \alpha) \theta_{\text{accel}}, \quad \text{where } \alpha \approx 0.98$$
4. **Radial Deadzone & Quantization:** Small tremor movements within $\epsilon_{\text{deadzone}}$ ($< 0.02\text{ rad/s}$) are truncated to zero. Valid deltas are quantized into 16-bit signed fixed-point integers (`i16`, scaling factor $1000.0$) to minimize packet payload.
5. **Adaptive Rate Dispatcher:**
   - If $\|\Delta \omega\| > \text{Threshold}_{\text{active}}$, dispatch immediately at hardware rate ($60 - 120\text{ Hz}$).
   - If stationary for $> 50\text{ ms}$, downsample to heartbeat rate ($10\text{ Hz}$) containing state confirmation.

---

## 2. Rust Host Daemon Subsystem Design

### 2.1 Daemon Architecture & Thread Model
```text
apps/host-daemon/
├── src/
│   ├── main.rs                   # Entry point, CLI args, daemonizer
│   ├── core/
│   │   ├── config.rs             # TOML config loader & hot reload
│   │   ├── session.rs            # Session state machine, auth validation
│   │   ├── state.rs              # Global shared state (ArcSwap, Atomics)
│   │   └── capabilities.rs       # Feature flags & driver capability matrix
│   ├── transport/
│   │   ├── transport_trait.rs    # Transport abstraction trait
│   │   ├── webrtc.rs             # libdatachannel or webrtc-rs endpoint
│   │   ├── signaling.rs          # Axum HTTP + WebSocket local signaling
│   │   └── packet_decoder.rs     # Zero-copy binary parser
│   ├── input/
│   │   ├── router.rs             # Event router -> Driver adapter
│   │   ├── watchdog.rs           # 100ms dead-man switch monitor
│   │   ├── mappings.rs           # Keycode translation tables
│   │   └── ringbuffer.rs         # Lock-free SPSC / bounded channel
│   ├── context/
│   │   ├── detector.rs           # Background window polling loop
│   │   ├── foreground.rs         # OS-specific active window grabber
│   │   └── profiles.rs           # Process-to-Mode mapping matcher
│   ├── drivers/
│   │   ├── driver_trait.rs       # InputBackend trait
│   │   ├── windows.rs            # ViGEm + SendInput implementation
│   │   ├── linux.rs              # uinput / evdev implementation
│   │   └── macos.rs              # CGEvent + VirtualHID implementation
│   ├── pairing/
│   │   ├── qr.rs                 # Terminal & web QR code generator
│   │   └── crypto.rs             # X25519 key exchange & HMAC verification
│   ├── discovery/
│   │   └── mdns.rs               # mDNS daemon broadcaster (astro-dnssd / mdns)
│   └── diagnostics/
│       ├── metrics.rs            # Atomic counters: RTT, packet loss, FPS
│       └── logging.rs            # Non-blocking tracing subscriber
```

### 2.2 Threading & Concurrency Model
1. **Signaling & Management Runtime (Tokio Multi-threaded):** Handles HTTP static routes, WebSocket SDP/ICE negotiation, mDNS discovery announcements, and QR code pairing API.
2. **Real-time Transport Loop (Dedicated Native Thread / Event Loop):** Polls WebRTC DataChannel socket, executes zero-copy packet validation, and passes decoded events to the Input Router.
3. **Context Engine Worker (Low-priority Async Task):** Runs every $250\text{ ms}$ inspecting the OS foreground window and updates the atomic mode pointer.
4. **Safety Watchdog (High-priority Timer Task):** Checks last packet reception timestamp every $20\text{ ms}$; fires emergency neutral reset if elapsed time $> 100\text{ ms}$.

---

## 3. Virtual Driver Subsystem & OS Abstraction

### 3.1 `InputBackend` Unified Interface
```rust
pub trait InputBackend: Send + Sync {
    fn initialize(&mut self) -> Result<(), DriverError>;
    fn update_gamepad(&mut self, state: &GamepadState) -> Result<(), DriverError>;
    fn send_mouse_motion(&mut self, dx: i16, dy: i16) -> Result<(), DriverError>;
    fn send_mouse_button(&mut self, button: MouseButton, pressed: bool) -> Result<(), DriverError>;
    fn send_mouse_scroll(&mut self, dx: i8, dy: i8) -> Result<(), DriverError>;
    fn send_keyboard_key(&mut self, key_code: u16, pressed: bool) -> Result<(), DriverError>;
    fn send_media_key(&mut self, key: MediaKey) -> Result<(), DriverError>;
    fn reset_all(&mut self) -> Result<(), DriverError>;
    fn shutdown(&mut self) -> Result<(), DriverError>;
}
```

### 3.2 Platform-Specific Driver Matrix

| Platform | Virtual Gamepad Strategy | Mouse / Keyboard Strategy | Media Control Strategy |
|---|---|---|---|
| **Windows** | ViGEmBus driver (Virtual Xbox 360 / DualShock 4 controller) | Win32 `SendInput` (hardware scan codes) | `SendInput` with virtual key codes (`VK_MEDIA_*`) |
| **Linux** | Linux Kernel `/dev/uinput` device node (`UI_SET_EVBIT`, `EV_KEY`, `EV_ABS`) | `/dev/uinput` mouse and keyboard event devices | `/dev/uinput` emitting `KEY_PLAYPAUSE`, `KEY_VOLUMEUP`, etc. |
| **macOS** | VirtualHID driver / Foohid / IOHIDEvent (Experimental) | Quartz Event Services (`CGEventCreateMouseEvent`, `CGEventCreateKeyboardEvent`) | System Media Remote Key Events via IOHIDSystem |

---

## 4. Smart Context Engine Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   Context Engine Loop                  │
│                     (Every 250ms)                      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             OS Foreground Window Detective             │
│   Windows: GetForegroundWindow() + GetWindowText()     │
│   Linux:   X11 _NET_ACTIVE_WINDOW / Wayland Foreign    │
│   macOS:   NSWorkspace.shared.frontmostApplication     │
└──────────────────────────┬─────────────────────────────┘
                           │ Process Name / Window Title
                           ▼
┌────────────────────────────────────────────────────────┐
│              Profile Classification Matcher            │
│   - "steam.exe" / "retroarch" / "game.exe"  -> GAMEPAD │
│   - "vlc.exe" / "spotify.exe" / "netflix"   -> MEDIA   │
│   - Default Fallback                        -> DESKTOP │
└──────────────────────────┬─────────────────────────────┘
                           │ Target Mode Candidate
                           ▼
┌────────────────────────────────────────────────────────┐
│               Mode Priority Arbitrator                 │
│                                                        │
│  1. Safety / Emergency Reset                           │
│  2. User Explicit Mode Lock (via Mobile Client UI)     │
│  3. Matched Application Profile                        │
│  4. System Default (Desktop Trackpad/Keyboard)         │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼ Atomic Swap
┌────────────────────────────────────────────────────────┐
│        Active Session Mode Pointer (ArcSwap)           │
│     (Read instantaneously by Real-time Router)         │
└────────────────────────────────────────────────────────┘
```
