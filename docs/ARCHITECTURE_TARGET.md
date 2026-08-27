# LookARemote — Target Architecture

The end-state the productionization brief describes. SPRINTs move toward it incrementally,
preserving the existing binary protocol, x25519/HMAC-SHA256 pairing, and the WebRTC DataChannel.

## Target data flow

```
PWA
 │  secure host connection
 ▼
HostConnectionManager
 ├── PairingManager        IDLE→DISCOVERING→PAIRING→PAIRED→CONNECTING→CONNECTED→RECONNECTING→FAILED
 ├── SignalingManager
 ├── WebRTCManager         SIGNALING_CONNECTING→CONNECTED→ICE_GATHERING→NEGOTIATING→CONNECTED→DEGRADED→RECONNECTING→FAILED→DISCONNECTED
 ├── DiscoveryManager
 ├── DeviceRegistry        stable device identity (≠ IP)
 ├── TvAdapterManager
 ├── InputRouter
 ├── SafetyWatchdog        heartbeat vs watchdog separated (heartbeat ≤ watchdog/3)
 ├── OS Drivers
 └── TV Adapters           SamsungTizen, LgWebOs, AndroidGoogleTv, Roku, SonyBravia, AppleTv
```

## Non-negotiable constraints (carried into every SPRINT)

- **No rewrite**: React, Vite, Rust, Tokio, Axum, WebRTC, custom binary protocol, X25519, HMAC-SHA256 all stay.
- **No deleted working features**: preserve public interfaces; provide a compatibility layer when one changes.
- **No fake discovery**: never return a hardcoded/hand-rolled "discovered TV". Real LAN discovery only.
- **No dual command dispatch**: exactly one authoritative execution path per TV command; a single, documented
  fallback on primary-transport failure, with command identity preserved and duplicate execution prevented.
- **No hardcoded LAN URLs in the UI**: all transport URL construction centralised in `HostConnectionManager`.
- **No false support**: a TV platform is `IMPLEMENTED` | `EXPERIMENTAL` | `UNSUPPORTED` — never presented as
  real support when it's a fallback.

## Key target modules

| Area | Target |
|---|---|
| PWA | Real production PWA: manifest, SW, icons, offline shell, cache strategy, HTTPS, installability, deployed (Vercel preferred). |
| Host connection | `HostConnectionManager` — host discovery, URL resolution, pairing/signaling endpoints, connection lifecycle, LAN-permission state, secure/insecure handling, diagnostics. |
| Pairing | `PairingManager` — full lifecycle; URL/QR pairing does parse→validate→handshake→store→connect WebRTC; persistent trusted host metadata; clear secrets on reset. |
| WebRTC | `WebRTCManager` — real lifecycle; on signaling reconnect assume PeerConnection NOT recovered; recreate PC/DataChannel, renegotiate, bounded exponential backoff, no concurrent reconnect, no stale-session reconnect. |
| Watchdog | Separate transport heartbeat vs input safety watchdog with explicit `heartbeat_interval_ms` / `watchdog_timeout_ms` / `watchdog_check_interval_ms`; releases all input surfaces on trip; tests for packet loss, DataChannel close, daemon crash, browser suspension. |
| TV command | `TvCommandService` — UI calls `sendCommand(command)` only; service picks the authoritative transport; observable result (accepted/sent/acknowledged/failed/timeout/unsupported); timeout + platform-aware retry; no duplicate execution. |
| TV discovery | `TvDiscoveryService` (mDNS, SSDP/UPnP, vendor discovery, justified probing) → stable `TvDevice` identity (id, ip, hostname, brand, model, protocol, port, capabilities, requires_pairing, last_seen); cached registry recognizes IP change. |
| TV adapters | `TvAdapter` trait: discover/connect/disconnect/pair/is_paired/send_command/send_text/get_capabilities/health_check; structured errors; result distinguishes accepted/sent/acknowledged/failed/timeout/unsupported. |
| Samsung | Real WebSocket registration/pairing + token handling + persistent identity + reconnect + command/response. |
| LG webOS | Real connect→register→client-key persist→reconnect→command/response/health. |
| Android/Google TV | Implement an actual supported control protocol (not arbitrary TCP :5555); separate discovery/pairing/connection/command; explicit capability bumps across generations. |
| Roku | Preserve proven ECP; add discovery, identity, health, capabilities. |
| Sony / Apple TV | Implement vendor protocol OR mark `EXPERIMENTAL`/`UNSUPPORTED` explicitly. |
| Generic TV | Never pretend network remote support; represent HDMI-CEC/DLNA as separate capabilities/protocols. |
| TV UX | `TvConnectionState`: discovered/selected/pairing/connecting/connected/degraded/disconnected/unsupported/error; UI shows real registry data, not TCL/192.168.1.102. |
| API | Versioned `/api/v1/{health,devices,devices/:id,devices/:id/pair,devices/:id/commands,devices/:id/text,discovery/start,discovery/stop}`; compatibility aliases for old endpoints. |
| Security | CORS from a configured trusted origin (never `Any` in prod); validate pairing/nonce/session/device/command/payload/text/ip/port; never arbitrary TCP proxy; no unrestricted LAN commands from a remote page; no secrets in logs. |
| Observability | Structured logs with session_id/device_id/command_id/adapter/state/duration/result; never log keys/secrets. |
| Testing | Unit (Pairing, HostConnection, DeviceRegistry, TvDiscovery, TvAdapterManager, each adapter, watchdog, reconnection, retry, dedup) + integration (pairing→signaling→WebRTC→protocol→router) + failure cases + PWA smoke tests. |
| CI | Keep cargo check/test/clippy + npm test/build; add PWA production build, manifest/SW validation, architecture checks, TV adapter tests. |

## Definition of Done (end state)

PWA installs + offline shell + updates + served over HTTPS + iOS Safari + Android Chrome.
Host starts reliably + health endpoint + pairing QR + secure pairing.
Pairing transitions to WebRTC; WebRTC reconnects after transient network failure; stale sessions cleaned;
DataChannel recreated when necessary. Watchdog never false-triggers in normal use and neutralizes input
after a real disconnect. TV: no hardcoded IP, no fake discovery, real LAN discovery + stable identity +
real vendor adapter + correct pairing lifecycle + command ack + explicit unsupported states.
The chain PWA → HostConnectionManager → PairingManager → WebRTCManager → ProtocolBridge → Host Daemon →
InputRouter → TvAdapterManager → Vendor Adapter → TV is traceable end-to-end.
