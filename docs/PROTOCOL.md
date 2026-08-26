# Binary Protocol Specification v1 — LookARemote

**Document ID:** PROTO-2026-001  
**Status:** Approved / Canonical Protocol v1  
**Author:** Principal Systems Architect & Protocol Engineer  

---

## 1. Protocol Design Goals & Constraints

1. **Compactness:** Fixed-size or predictable bounded payloads to fit within a single SCTP datagram without fragmentation.
2. **Zero-Allocation Deserialization:** Binary structures mapped directly via memory offsets / slice dereferencing.
3. **Little-Endian Byte Order:** Standardized little-endian (LE) byte ordering for all multi-byte integer and float fields.
4. **Sequence Tracking:** 16-bit monotonic sequence numbers with modular arithmetic to reject late/out-of-order frames.
5. **Extensibility & Versioning:** Explicit 1-byte version field in the header to support future protocol revisions.

---

## 2. Frame Structure & Header Layout

Every packet transmitted over the real-time data channel consists of a **5-byte Base Header** followed by a type-specific **Payload**:

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|    Version    |  Message Type |     Flags     |   Sequence    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| (Seq cont.)   | Payload Data ...                              |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### 2.1 Header Field Definitions

| Byte Offset | Field | Type | Description |
|---|---|---|---|
| `0x00` | `Version` | `u8` | Protocol version. Current version is `0x01`. |
| `0x01` | `Type` | `u8` | Message type identifier (see Section 3). |
| `0x02` | `Flags` | `u8` | Bitfield flags: Bit 0: Needs ACK, Bit 1: Emergency/Reset, Bits 2-7: Reserved (0). |
| `0x03..0x04` | `Sequence` | `u16` | Monotonically increasing sequence number (LE, wrapping at 65535). |
| `0x05..N` | `Payload` | `[u8]` | Message-specific payload data. |

---

## 3. Message Type Catalog

```text
0x01 : MSG_MOTION        (IMU Gyroscope & Accelerometer deltas)
0x02 : MSG_GAMEPAD_FULL  (Complete gamepad state snapshot)
0x03 : MSG_GAMEPAD_DELTA (Incremental button/axis changes)
0x04 : MSG_TOUCHPAD      (Relative cursor movement & multi-touch gestures)
0x05 : MSG_KEYBOARD      (Key press / release events)
0x06 : MSG_MEDIA         (Consumer media key action)
0x07 : MSG_MODE_SWITCH   (Client explicit mode request)
0x08 : MSG_HEARTBEAT     (Keepalive & latency echo probe)
0x09 : MSG_ACK           (Acknowledgment for reliable control frames)
0x0A : MSG_HAPTIC_EVENT  (Host-to-Client haptic rumble trigger)
```

---

## 4. Detailed Payload Specifications

### 4.1 `0x01` MSG_MOTION (16 Bytes Payload, Total Frame: 21 Bytes)
Used for high-rate gyroscope aiming and orientation tracking.

```text
Offset  Type     Field          Description
+0      i16 (LE) gyro_yaw       Yaw rate in rad/s * 1000 (-32.768 to +32.767 rad/s)
+2      i16 (LE) gyro_pitch     Pitch rate in rad/s * 1000
+4      i16 (LE) gyro_roll      Roll rate in rad/s * 1000
+6      i16 (LE) accel_x        Linear acceleration X in m/s^2 * 100
+8      i16 (LE) accel_y        Linear acceleration Y in m/s^2 * 100
+10     i16 (LE) accel_z        Linear acceleration Z in m/s^2 * 100
+12     u32 (LE) timestamp_us   Client microsecond timestamp for jitter calculation
```

### 4.2 `0x02` MSG_GAMEPAD_FULL (14 Bytes Payload, Total Frame: 19 Bytes)
Full snapshot of virtual controller state for reliable synchronization.

```text
Offset  Type     Field          Description
+0      u16 (LE) buttons        Bitfield (A, B, X, Y, D-pad, L1, R1, L3, R3, Start, Select, Guide)
+2      i16 (LE) stick_lx       Left Stick X (-32768 to 32767)
+4      i16 (LE) stick_ly       Left Stick Y (-32768 to 32767)
+6      i16 (LE) stick_rx       Right Stick X (-32768 to 32767)
+8      i16 (LE) stick_ry       Right Stick Y (-32768 to 32767)
+10     u8       trigger_l      Left Trigger (0 to 255)
+11     u8       trigger_r      Right Trigger (0 to 255)
+12     u16 (LE) reserved       Reserved for paddle buttons / extensions
```

#### Gamepad Button Bitmask Layout (`u16`)
```text
Bit 0 : DPAD_UP          Bit 8  : BTN_L1 (Left Bumper)
Bit 1 : DPAD_DOWN        Bit 9  : BTN_R1 (Right Bumper)
Bit 2 : DPAD_LEFT        Bit 10 : BTN_L3 (Left Stick Click)
Bit 3 : DPAD_RIGHT       Bit 11 : BTN_R3 (Right Stick Click)
Bit 4 : BTN_SOUTH (A)    Bit 12 : BTN_START
Bit 5 : BTN_EAST (B)     Bit 13 : BTN_SELECT
Bit 6 : BTN_WEST (X)     Bit 14 : BTN_GUIDE / HOME
Bit 7 : BTN_NORTH (Y)    Bit 15 : RESERVED
```

### 4.3 `0x04` MSG_TOUCHPAD (7 Bytes Payload, Total Frame: 12 Bytes)
Coordinates and gesture events from the mobile trackpad surface.

```text
Offset  Type     Field          Description
+0      i16 (LE) dx             Relative horizontal cursor delta in pixels
+2      i16 (LE) dy             Relative vertical cursor delta in pixels
+4      i8       scroll_v       Vertical scroll wheel delta (-128 to 127)
+5      i8       scroll_h       Horizontal scroll wheel delta (-128 to 127)
+6      u8       buttons_mask   Bit 0: Left, Bit 1: Right, Bit 2: Middle, Bit 3: Tap-to-click
```

### 4.4 `0x05` MSG_KEYBOARD (4 Bytes Payload, Total Frame: 9 Bytes)

```text
Offset  Type     Field          Description
+0      u16 (LE) key_code       Standard USB HID Usage ID or mapped scan code
+2      u8       state          0 = Key Up (Released), 1 = Key Down (Pressed), 2 = Key Repeat
+3      u8       modifiers      Bitfield (Bit 0: Ctrl, Bit 1: Shift, Bit 2: Alt, Bit 3: Meta/Super)
```

### 4.5 `0x06` MSG_MEDIA (2 Bytes Payload, Total Frame: 7 Bytes)

```text
Offset  Type     Field          Description
+0      u8       media_action   1: Play/Pause, 2: Stop, 3: Next, 4: Prev, 5: VolUp, 6: VolDown, 7: Mute
+1      u8       reserved       Alignment padding (0)
```

### 4.6 `0x08` MSG_HEARTBEAT (8 Bytes Payload, Total Frame: 13 Bytes)

```text
Offset  Type     Field          Description
+0      u32 (LE) client_epoch_ms Client millisecond clock timestamp
+4      u32 (LE) echo_token      Arbitrary token echoed back in response for RTT measurement
```

### 4.7 `0x0A` MSG_HAPTIC_EVENT (Host to Client, 4 Bytes Payload, Total Frame: 9 Bytes)

```text
Offset  Type     Field          Description
+0      u8       motor_index    0: Left/Low freq, 1: Right/High freq, 2: Both
+1      u8       intensity      0 to 255 amplitude
+2      u16 (LE) duration_ms    Vibration duration in milliseconds
```

---

## 5. Sequence & Ordering Semantics

1. **Sequence Numbering:** Sequence numbers start at `0x0001` on connection establishment and increment monotonically per packet.
2. **Rejection of Out-of-Order Frames:**
   Let $S_{\text{latest}}$ be the highest sequence number processed for a given message category, and $S_{\text{incoming}}$ be the incoming packet sequence.
   The frame is accepted if and only if:
   $$0 < (S_{\text{incoming}} - S_{\text{latest}}) \pmod{65536} < 32768$$
   Otherwise, the packet is discarded as a late arriving duplicate or obsolete frame.
3. **Sequence Wraparound:** The 16-bit unsigned modular arithmetic correctly handles rollover from `65535` to `0` without disruption.

---

## 6. Packet Validation & Safety Rules

1. **Frame Size Validation:** Packets whose byte lengths do not match the exact expected size for their `Message Type` MUST be dropped immediately and logged to diagnostic metrics.
2. **Range Clamping:** Analog axes and delta coordinates MUST be strictly bounded to valid numeric ranges before passing to OS drivers.
3. **Reserved Bits Enforcement:** Unused flag or reserved bits MUST be verified as zero or ignored.
