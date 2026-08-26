# System Architecture Specification — Universal Remote (LookARemote)

**Document ID:** ARCH-2026-001  
**Status:** Approved / Base Architecture  
**Author:** Principal Systems Architect  

---

## 1. Executive Architectural Summary

Universal Remote is architected around the principle of **Deterministic Path Isolation**: strictly decoupling the ultra-low-latency real-time input pipeline from control-plane, background, persistence, and discovery operations.

```text
                                  ┌───────────────────────────┐
                                  │      PWA Client (Web)     │
                                  │  (Mobile Safari/Chrome)   │
                                  └─────────────┬─────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 │                                                             │
                 │ Control Plane (Signaling / Pairing)                         │ Real-Time Hot Path (DataChannel)
                 ▼                                                             ▼
    ┌───────────────────────────┐                                 ┌───────────────────────────┐
    │ HTTP / WebSocket Signaler │                                 │ Unordered SCTP / DTLS /   │
    │  (Axum / Tokio Tasks)     │                                 │ UDP (WebRTC DataChannel)  │
    └────────────┬──────────────┘                                 └─────────────┬─────────────┘
                 │                                                              │
                 │ Session Context / Non-Blocking Msg                           │ Raw Binary Packet (Pinned Memory)
                 ▼                                                              ▼
    ┌───────────────────────────┐                                 ┌───────────────────────────┐
    │     Session Manager       │                                 │     Protocol Decoder      │
    │ (Auth / Crypto / Context) │                                 │   (Zero-alloc parse)      │
    └────────────┬──────────────┘                                 └─────────────┬─────────────┘
                 │                                                              │
                 │ Active Mode & App State (Atomic / ArcSwap)                   │ Typed Input Event
                 ▼                                                              ▼
    ┌───────────────────────────┐                                 ┌───────────────────────────┐
    │   Context & Mode Engine   │────────────────────────────────►│       Input Router        │
    │   (Async Window Watcher)  │      Mode Filter / Mapping      │  (Lookup Table / State)   │
    └───────────────────────────┘                                 └─────────────┬─────────────┘
                                                                                │
                                                                                ▼
                                                                  ┌───────────────────────────┐
                                                                  │     Watchdog Monitor      │
                                                                  │  (Touch Timestamp Guard)  │
                                                                  └─────────────┬─────────────┘
                                                                                │
                                                                                ▼
                                                                  ┌───────────────────────────┐
                                                                  │  OS Driver Abstraction    │
                                                                  │ (ViGEm / uinput / CGEvent)│
                                                                  └─────────────┬─────────────┘
                                                                                │
                                                                                ▼
                                                                  ┌───────────────────────────┐
                                                                  │  Operating System Kernel  │
                                                                  └───────────────────────────┘
```

---

## 2. Structural Layering & Separation of Concerns

The architecture enforces five distinct, isolated layers:

### Layer 1: Mobile Sensor & Input Capture Layer (Client)
- **Direct Event Handlers:** High-frequency pointer and touch event handlers with `{ passive: false }` and `touch-action: none` to bypass browser scrolling/zooming heuristics.
- **Sensor Worker Pipeline:** Offloads continuous IMU accelerometer and gyroscope polling to a dedicated Web Worker (or high-frequency `requestAnimationFrame` sensor loop with pre-allocated TypedArrays).
- **Adaptive Delta Quantizer:** Evaluates delta magnitude against configured deadzones and noise thresholds. If no meaningful movement occurs within a frame window, packet dispatch is suppressed or throttled to a $10\text{ Hz}$ heartbeat.

### Layer 2: Transport Abstraction Layer
- Encapsulates bidirectional communication behind a generic `Transport` trait in Rust and `ITransport` in TypeScript.
- **WebRTC DataChannel Implementation:** Operates over SCTP/DTLS/UDP with `ordered: false` and `maxRetransmits: 0`. This avoids head-of-line blocking while maintaining standard browser compatibility and enterprise-grade DTLS encryption without custom kernel drivers.
- Future-proof design allows drop-in replacement with WebTransport/QUIC or raw UDP (via native wrappers) without modifying protocol or input router logic.

### Layer 3: Daemon Core & Decoding Layer (Rust)
- **Zero-Allocation Protocol Decoder:** Parses incoming binary frames directly from pinned network buffers without heap allocation (`nom` / zero-copy slice indexing).
- **Sequence Filter:** Tracks 16-bit wrapping sequence counters. Packets arriving older than the newest received packet for the same message type are immediately dropped to prevent lag spikes and out-of-order jitter.
- **Lock-Free State Propagation:** Controller modes and context profiles are updated by background workers using lock-free read structures (`arc-swap` or atomic pointer swaps), ensuring the hot path never blocks on mutex acquisition.

### Layer 4: Input Routing & Safety Watchdog Layer
- **Input Router:** Converts binary payload state (button bitfields, normalized floating-point axes, delta mouse coordinates) into OS driver commands based on the active mode (Gamepad, Mouse, Trackpad, Keyboard, Media, Custom).
- **Watchdog Dead-Man Switch:** Evaluates a monotonically increasing timer on every frame. If no valid packet is received from the active session within $100\text{ ms}$, the watchdog forcibly emits release events for all active buttons, resets analog axes to neutral zero, and flags the session as degraded.

### Layer 5: OS Virtual Driver Layer
- Hardware abstraction interface (`InputBackend`) hiding platform-specific driver intricacies behind synchronous, direct system calls.

---

## 3. The Real-Time Hot Path Invariants

```text
[Touch / Sensor] ──> [Pre-allocated TypedArray] ──> [DataChannel.send()]
                                                            │
                                                   (LAN Transit < 3ms)
                                                            │
[OS Kernel] <── [uinput/ViGEm/CGEvent] <── [Decoder/Router] <┘
```

The following operations are **strictly prohibited** inside the real-time hot path:
1. **Dynamic Memory Allocation:** No `malloc`, `Box::new`, `Vec::push` with reallocation, or string formatting.
2. **Lock Contention:** No blocking on mutexes held by background threads.
3. **Synchronous File or Socket I/O:** No disk logging, database queries, or blocking network calls.
4. **Context Switching to Slow Threads:** Direct execution or bounded lock-free ring-buffer handoff (`crossbeam-channel` or `rtrb`).

---

## 4. Control Plane vs. Data Plane Isolation

| Dimension | Control Plane (Signaling / Discovery) | Data Plane (Real-Time Control) |
|---|---|---|
| **Protocol** | HTTP / WebSocket / JSON / mDNS | Binary Protocol v1 / SCTP / DTLS |
| **Reliability** | Ordered, reliable, TCP-based | Unordered, 0-retransmit, UDP-based |
| **Throughput** | Sparse ($< 1\text{ msg/sec}$) | High-rate burst ($60 - 120\text{ msgs/sec}$) |
| **Latency Budget** | $< 200\text{ ms}$ | $< 5\text{ ms}$ |
| **Thread Context** | Tokio async multi-threaded runtime | Dedicated input event loop / async stream |
| **Failure Handling** | Exponential backoff retry | Drop frame & proceed to next state |
