# Failure & Recovery Model — LookARemote

**Document ID:** FAIL-2026-001  
**Status:** Approved / Failsafe Model  
**Author:** Principal Reliability Engineer  

---

## 1. Watchdog State Machine & Failsafe Guarantee

The most critical safety invariant of LookARemote is:
> **An unexpected client disconnection or packet gap MUST NEVER leave physical or virtual inputs stuck in a pressed state.**

```text
┌────────────────────────────────────────────────────────┐
│                   Active Control State                 │
│      (Valid input packets arriving within 100ms)       │
└──────────────────────────┬─────────────────────────────┘
                           │ No packet received for > 100ms
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Watchdog Triggered                   │
│                                                        │
│  1. Force release all pressed gamepad buttons          │
│  2. Reset all analog sticks to center (0.0, 0.0)       │
│  3. Reset triggers to 0.0                              │
│  4. Release all pressed mouse buttons                  │
│  5. Release all active keyboard keycodes               │
│  6. Flush driver input queues                          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                Degraded / Standby State                │
│            (Awaiting reconnection / packet)            │
└──────────────────────────┬─────────────────────────────┘
                           │ Valid authenticated packet arrives
                           ▼
┌────────────────────────────────────────────────────────┐
│               Resume Normal Control State              │
└────────────────────────────────────────────────────────┘
```

---

## 2. Failure Scenarios & Deterministic Recovery Matrix

| Failure Event | Detection Mechanism | Immediate Action | Recovery Procedure |
|---|---|---|---|
| **Mobile Phone Sleeps / Locks** | Heartbeat and sensor stream cease. | Host Watchdog fires at $100\text{ ms}$; releases all virtual keys/buttons. | PWA listens to `visibilitychange` event. When unlocked, immediately initiates ICE restart or WebSocket reconnect. |
| **Wi-Fi Disconnect / Network Drop** | WebRTC connection state transitions to `disconnected` / `failed`. | Watchdog releases inputs. Peer connection marked dead. | PWA triggers local network reconnect loop with exponential backoff ($500\text{ ms}, 1\text{s}, 2\text{s}, 5\text{s}$). |
| **Browser Tab Closed / Crashed** | DTLS session teardown / SCTP shutdown or abrupt socket close. | Host drops session, resets virtual devices, and returns to pairing/listening state. | Clean session teardown; host allows new QR/mDNS pairing immediately. |
| **Host Daemon Unexpected Crash** | Host process termination. | OS driver (ViGEm/uinput) automatically unregisters virtual device nodes upon handle closure. | On daemon restart, previous temporary sessions are purged and clean state is re-initialized. |
| **Packet Sequence Gap / Out of Order** | Sequence number $S_{\text{incoming}} < S_{\text{latest}}$. | Out-of-order packet dropped immediately without error. | Next newer packet accepted seamlessly without retransmission delay. |
| **Driver Initialization Failure** | `InputBackend::initialize()` returns `Err(DriverUnavailable)`. | Daemon disables affected mode, logs diagnostic warning, and exposes degraded status via API. | System gracefully falls back to available driver modes (e.g. mouse/keyboard fallback if ViGEm is not installed). |
| **Protocol Version Mismatch** | Client header `Version != Host Version`. | Host immediately drops packet or rejects signaling handshake with error code `ERR_VERSION_MISMATCH`. | Client displays friendly UI prompt instructing the user to update the host daemon or refresh the PWA cache. |
| **Malformed / Corrupted Packet** | Payload length does not match expected size for message type. | Packet rejected at decoder level; `malformed_packet_count` incremented. | No crash or memory corruption occurs; watchdog timer continues counting. |

---

## 3. Session Reconnection Flow

```text
┌──────────────────────────┐                                    ┌──────────────────────────┐
│   Mobile Client (PWA)    │                                    │    Host Daemon (Rust)    │
└────────────┬─────────────┘                                    └────────────┬─────────────┘
             │                                                               │
             │ [Network Interruption / Wi-Fi Glitch Occurs]                 │
             │                                                               │
             │ 1. ICE Connection State = 'disconnected'                      │
             │                                                               │ 2. Watchdog fires at 100ms
             │                                                               │    (Releases all inputs)
             │                                                               │
             │ 3. Client initiates ICE Restart via Signaling WebSocket       │
             │    { session_id, reconnect_token, new_ice_ufrag }             │
             ├──────────────────────────────────────────────────────────────►│
             │                                                               │ 4. Validates session_id
             │                                                               │    & reconnect_token
             │ 5. Signaling Response (New SDP Offer / Answer)                │
             │◄──────────────────────────────────────────────────────────────┤
             │                                                               │
             │ 6. Fast DTLS Session Resumption                               │
             │◄═════════════════════════════════════════════════════════════►│
             │                                                               │
             │ 7. Real-Time DataChannel Resumed                              │
             │    (Sequence counter continues seamlessly)                    │
             ▼                                                               ▼
```
