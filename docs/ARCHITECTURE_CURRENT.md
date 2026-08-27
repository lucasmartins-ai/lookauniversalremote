# LookARemote — Current Architecture (as found)

Describes how the system works *today*, before SPRINT refactors. Based on the forensic baseline.

## High-level flow

```
Web client (PWA, React/Vite)
  │  URL hash pairing  ──►  Signaling (HTTP/WS)  ──►  Host daemon (Axum/Tokio :8765)
  │                                 │                        │
  │  ProtocolBridge ◄── WebRTC DataChannel ◄── PeerConnection  │
  │                                 │                        │
  │                                 └── input router ──► drivers ──► OS input
  │                                                        │
  └────────────────────────────── TV path ───────────────► TvDispatcher / adapters
                                                          └── vendor TV
```

## Layer by layer

### Web client
- **App shell** (`src/app/App.tsx`) — single-page, feature-based UI.
- **Transport layer** (`src/transport/`):
  - `ProtocolBridge` — wraps the binary protocol, sends over `WebRtcTransport`.
  - `WebRtcTransport` — establishes PeerConnection + DataChannel; line 63 switches `ws:`/`wss:` by page scheme.
  - `SignalingClient` — WS signaling; handles socket reconnect (HTTP/WS only).
- **Features** (`src/features/`): pairing, connection state, smart context, gamepad, trackpad, keyboard, media, airmouse, battery, multiplayer, studio, tv.
- **PWA** (`vite.config.ts` `VitePWA`): manifest, icons, workbox precache + google-fonts cache, registerType `autoUpdate`.

### Host daemon (Rust)
- **Signaling** (`transport/signaling.rs`) — Axum router: pairing, `/ws/signaling`, `/api/tv-target`, `/api/tv-command`; CORS `Any`.
- **WebRTC** (`transport/webrtc.rs`) — DataChannel with `ordered=false, maxRetransmits=0`; DeadManWatchdog wired into channel lifecycles.
- **Pairing** (`pairing/`) — X25519 key exchange + HMAC-SHA256 single-use nonce; stores session.
- **Input** (`input/`) — `DeadManWatchdog` (100ms/10ms), router → drivers; Smart Context arbitration.
- **TV** (`tv/`) — `TvDispatcher` (defaults to hardcoded `192.168.1.102`), vendor adapters (Samsung, LG, Android/Google, Roku, Sony, Apple, Generic — varying completeness).
- **Core** (`core/config.rs`) — `DEFAULT_PORT=8765`, `bind_addr`, `allowed_origin` (default `remote.lookaberry.com`), profiles.
- **Drivers** (`drivers/`) — virtual input drivers (mock + platform).
- **Context** (`context/`) — Smart Context engine (process/profile detection).

### Packages
- `@lookaremote/protocol` (Rust) + `@lookaremote/protocol-types` (TS) — binary codec + message types (gamepad, tv_command, tv_text, slot_assignment…).

## Where the seams are weak (drives the sprint plan)

1. Transport URL construction is spread across components (`:8765`, `192.168.*` hardcoded) — no single `HostConnectionManager`.
2. Pairing handshake does not reliably roll into a WebRTC connect.
3. WebRTC reconnect == signaling reconnect only.
4. Input watchdog (100ms) and transport heartbeat (500ms) are independent and mismatched.
5. TV has a hardcoded target + fake discovery + dual dispatch (ProtocolBridge + direct HTTP).
6. Vendor adapters lack a real pairing/registration lifecycle and structured results.
7. CORS is `Any` despite a configured `allowed_origin`.
8. Endpoints are ad-hoc (`/api/tv-target`, `/api/tv-command`), not versioned `/api/v1/*`.
