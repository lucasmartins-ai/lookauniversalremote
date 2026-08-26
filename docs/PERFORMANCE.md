# Performance Model & Benchmarking Specification — LookARemote

**Document ID:** PERF-2026-001  
**Status:** Approved / Performance Model  
**Author:** Principal Systems Architect & Performance Lead  

---

## 1. Latency Budgets & Target Metrics

The end-to-end latency budget covers the physical duration from a user touch/motion gesture on the phone screen to the operating system registering the virtual input event.

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Phone Sensor │ ──> │ PWA Pipeline │ ──> │ LAN Transit  │ ──> │ Daemon Parse │ ──> │ OS Driver    │
│ Hardware Lat │     │ & Serialize  │     │ WebRTC/DTLS  │     │ & Routing    │     │ Injection    │
│  [1.0 - 2.5] │     │  [0.5 - 1.5] │     │  [1.5 - 4.0] │     │  [0.1 - 0.5] │     │  [0.5 - 1.5] │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                  TOTAL BUDGET (P95): < 10.0 ms
```

### Detailed Component Latency Breakdown (Milliseconds)

| Pipeline Stage | P50 (Typical) | P95 (Target) | P99 (Max Tolerable) | Optimization Strategy |
|---|---|---|---|---|
| **1. Sensor Capture & Browser Event** | $1.2\text{ ms}$ | $2.5\text{ ms}$ | $4.0\text{ ms}$ | `{ passive: false }`, `touch-action: none`, high-rate pointer events. |
| **2. Client Filter & Binary Serialization** | $0.4\text{ ms}$ | $1.0\text{ ms}$ | $2.0\text{ ms}$ | Pre-allocated `ArrayBuffer`, zero-allocation bit packing, fast lookup tables. |
| **3. WebRTC LAN DataChannel Transit** | $2.0\text{ ms}$ | $4.5\text{ ms}$ | $8.0\text{ ms}$ | Unordered SCTP (`ordered: false`, `maxRetransmits: 0`), 5GHz Wi-Fi. |
| **4. Daemon Receive & Zero-Copy Decode** | $0.1\text{ ms}$ | $0.4\text{ ms}$ | $1.0\text{ ms}$ | Direct slice parsing, zero memory allocation in hot loop. |
| **5. Input Router & Watchdog Guard** | $0.1\text{ ms}$ | $0.3\text{ ms}$ | $0.8\text{ ms}$ | Lock-free mode state lookup (`ArcSwap`), direct struct mapping. |
| **6. Virtual Driver Dispatch** | $0.6\text{ ms}$ | $1.3\text{ ms}$ | $2.5\text{ ms}$ | Synchronous kernel driver call (`/dev/uinput` ioctl / ViGEmBus client). |
| **Total End-to-End Latency** | **$4.4\text{ ms}$** | **$10.0\text{ ms}$** | **$18.3\text{ ms}$** | **Sub-frame responsiveness (< 1 frame at 60 FPS)** |

---

## 2. Resource Overhead Budgets

### Host Daemon (Desktop)
- **Idle CPU:** $< 0.1\%$ on an Intel Core i5-8400 / AMD Ryzen 5 3600 or equivalent.
- **Active 120Hz Control CPU:** $< 1.5\%$ of a single CPU core.
- **Resident Set Size (RSS) RAM:** $< 25\text{ MB}$ total footprint.
- **Thread Count:** $\le 4$ active OS threads (1 network/signaling, 1 real-time transport, 1 context engine worker, 1 timer watchdog).

### Web Client (Mobile PWA)
- **Heap Allocations per Frame:** Exactly $0\text{ bytes}$ in the steady-state sensor/touch loop.
- **Garbage Collection Pauses:** 0 GC stalls during active control.
- **Mobile Battery Consumption:** $< 8\%\text{ discharge per hour}$ under sustained 120Hz IMU aiming on an iPhone 13 or modern Android device.

---

## 3. Zero-Allocation Hot Path Design Patterns

### TypeScript Client Hot Loop
```typescript
// Pre-allocated static buffers - ZERO heap churn per frame
const FRAME_BUFFER = new ArrayBuffer(24);
const DATA_VIEW = new DataView(FRAME_BUFFER);
const UINT8_VIEW = new Uint8Array(FRAME_BUFFER);

export function serializeMotionFrame(
  seq: number,
  yaw: number,
  pitch: number,
  roll: number,
  ax: number,
  ay: number,
  az: number,
  timestampUs: number
): Uint8Array {
  DATA_VIEW.setUint8(0, 0x01); // Version
  DATA_VIEW.setUint8(1, 0x01); // MSG_MOTION
  DATA_VIEW.setUint8(2, 0x00); // Flags
  DATA_VIEW.setUint16(3, seq, true); // Sequence LE
  DATA_VIEW.setInt16(5, (yaw * 1000) | 0, true);
  DATA_VIEW.setInt16(7, (pitch * 1000) | 0, true);
  DATA_VIEW.setInt16(9, (roll * 1000) | 0, true);
  DATA_VIEW.setInt16(11, (ax * 100) | 0, true);
  DATA_VIEW.setInt16(13, (ay * 100) | 0, true);
  DATA_VIEW.setInt16(15, (az * 100) | 0, true);
  DATA_VIEW.setUint32(17, timestampUs, true);
  return UINT8_VIEW.subarray(0, 21);
}
```

### Rust Daemon Zero-Copy Decoder
```rust
#[inline(always)]
pub fn decode_motion_payload(data: &[u8]) -> Result<MotionPayload, ProtocolError> {
    if data.len() < 16 {
        return Err(ProtocolError::TruncatedPayload);
    }
    // Direct slice indexing without memory allocation
    let yaw = i16::from_le_bytes([data[0], data[1]]);
    let pitch = i16::from_le_bytes([data[2], data[3]]);
    let roll = i16::from_le_bytes([data[4], data[5]]);
    let ax = i16::from_le_bytes([data[6], data[7]]);
    let ay = i16::from_le_bytes([data[8], data[9]]);
    let az = i16::from_le_bytes([data[10], data[11]]);
    let ts = u32::from_le_bytes([data[12], data[13], data[14], data[15]]);

    Ok(MotionPayload {
        yaw_rad_s: yaw as f32 / 1000.0,
        pitch_rad_s: pitch as f32 / 1000.0,
        roll_rad_s: roll as f32 / 1000.0,
        accel_x_ms2: ax as f32 / 100.0,
        accel_y_ms2: ay as f32 / 100.0,
        accel_z_ms2: az as f32 / 100.0,
        timestamp_us: ts,
    })
}
```

---

## 4. Benchmarking & Verification Methodology

1. **Automated Round-Trip Latency Harness:** Host reflects `MSG_HEARTBEAT` with exact timestamps; client calculates continuous rolling RTT percentiles ($P_{50}, P_{95}, P_{99}$).
2. **High-Speed Camera Optical Verification:** 240 FPS optical recording comparing physical finger tap on mobile glass against screen pixel update on host desktop.
3. **Network Stress Matrix:**
   - Standard 5GHz Wi-Fi (Clean channel).
   - Congested 2.4GHz Wi-Fi (Simulated 2% packet loss and 15ms jitter).
   - Saturated LAN link (Concurrent 100 Mbps background stream).
