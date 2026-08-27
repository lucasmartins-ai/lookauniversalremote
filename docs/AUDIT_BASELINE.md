# LookARemote — Audit Baseline (SPRINT 0)

Generated from the forensic baseline of the repository at `lucasmartins-ai/lookauniversalremote`.
Phase 0 of the productionization brief: **no functional refactor**. Document the current state so the
next sprints change the system deliberately, not blindly.

## 1. Repository structure

```
LookARemote/
├── apps/
│   ├── host-daemon/       Rust — Axum/Tokio daemon (the "host")
│   │   └── src/
│   │       ├── pairing/   X25519 + HMAC-SHA256 pairing, nonce
│   │       ├── transport/ signaling (HTTP/WS), WebRTC, network helpers
│   │       ├── input/     watchdog (DeadManWatchdog), input router/drivers
│   │       ├── context/   Smart Context engine, arbitrator
│   │       ├── core/      config (port, bind, allowed_origin), state
│   │       ├── drivers/   virtual input drivers (mock, etc.)
│   │       ├── tray/      macOS tray
│   │       ├── tv/        TV dispatcher, adapters, discovery
│   │       └── lib.rs / main.rs
│   └── web-client/        React + TS + Vite + vite-plugin-pwa
│       └── src/
│           ├── transport/ ProtocolBridge, WebRtcTransport, SignalingClient
│           ├── features/  pairing, connection, context, gamepad, trackpad,
│           │              keyboard, media, airmouse, battery, multiplayer,
│           │              studio, tv, settings
│           ├── sensors/   airmouse/gyro
│           └── app/       App shell, routing
├── packages/
│   ├── protocol/          Rust — custom binary protocol (encoder/decoder, messages)
│   └── protocol-types/    TS — mirror protocol types (encoder/decoder)
├── scripts/               build/packaging helpers
├── docs/                  README, SPEC, ROADMAP (+ these baseline docs)
├── .github/workflows/     ci.yml, release.yml
├── config.toml            daemon runtime config (poll_interval=500ms, profiles)
├── Cargo.toml             workspace
├── package.json           npm workspaces (packages/*, apps/*)
└── dist-release/          built host release artifacts
```

## 2. Runtime components

| Component | Language | Role | Port |
|---|---|---|---|
| `lookaremote-host-daemon` | Rust (Axum/Tokio) | Host: signaling, WebRTC, pairing, input routing, TV dispatch | 8765 (DEFAULT_PORT) |
| Web client (PWA) | React/TS/Vite | Controller UI, protocol bridge, WebRTC peer | 5173 (dev) |
| `@lookaremote/protocol` | Rust | Binary protocol codec + message types (gamepad, tv_command, …) | — |
| `@lookaremote/protocol-types` | TS | Protocol encoder/decoder mirror | — |

## 3. Dependency graph (simplified)

- web-client → `@lookaremote/protocol-types` (encoder/decoder), WebRTC, React, vite-plugin-pwa
- host-daemon → `@lookaremote/protocol` (codec), axum, tokio, webrtc, tokio-rustls, reqwest, tower-http, x25519/hmac (pairing)
- No shared build between Rust and TS; they talk over the wire (binary protocol + signaling).

## 4. Build matrix (baseline result)

| Check | Command | Result |
|---|---|---|
| Rust compile | `cargo check --workspace` | ✅ finished (~9s, dev profile). Only future-incompat warning for `block v0.1.6`. |
| Rust tests | `cargo test --workspace` | ✅ `12 passed; 0 failed` (protocol codec + host tests). |
| Rust lints | `cargo clippy --workspace --all-targets -- -D warnings` | ❌ **NOT clean — 2 violations**: `if-same-then-else` at `core/multi_peer.rs:183`; `wildcard-in-or-patterns` at `tv/dispatcher.rs:182`. (Lint debt, pre-existing; fix deferred to a later sprint per "no refactor in Phase 0".) |
| JS tests | `npm test` | ✅ `18 files / 73 passed` (vitest, web-client). |
| JS build | `npm run build --workspaces --if-present` | ✅ success in 1.62s — PWA dist generated: `manifest.webmanifest`, `dist/sw.js`, `dist/workbox-*.js`, precache 17 entries (870 KiB). **Confirms finding 1: the PWA builds correctly; the gap is deployment, not generation.** |
| Typecheck | `npm run typecheck --workspaces --if-present` | ⏳ (not run in this pass — covered by `tsc && vite build`) |

## 5. Known failures / confirmed critical findings

Confirmed by direct inspection (not yet fixed — Phase 0 is diagnostic):

1. **PWA deploy path (F1)** — `vite.config.ts` defines a valid PWA (manifest, icons, workbox,
   registerType autoUpdate), but `.github/workflows/release.yml` packages `apps/web-client/dist`
   into a release ZIP only; there is **no production PWA deployment** (no Vercel/HTTPS step).
   The PWA is configured, not deployed.
2. **Secure-page → insecure host (F2/F3)** — `apps/web-client/src/transport/WebRtcTransport.ts:63`
   sets `wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'`. On an HTTPS PWA it
   would open `wss://` against a daemon that exposes plain HTTP/WS → connection breaks.
3. **Pairing stops before connect (F4)** — `usePairing.ts:84` auto-processes the URL hash but the
   lifecycle does not guarantee handshake → session store → WebRTC connect as one flow.
4. **Signaling reconnect ≠ PeerConnection reconnect (F5)** — reconnect logic returns on the
   signaling socket; a failed/stale PeerConnection is not recreated.
5. **Watchdog/heartbeat mismatch (F6)** — `host-daemon/src/input/watchdog.rs:49`
   `DeadManWatchdog::new(Duration::from_millis(100), Duration::from_millis(10))` (100ms / 10ms)
   vs client heartbeat interval ~500ms (`config.toml` `poll_interval_ms = 500`).
6. **TV dual dispatch (F7)** — `apps/web-client/src/features/tv/TvRemoteView.tsx:78,100` issues
   `fetch(\`http://${host}:8765/api/tv-command\`)` **and** drives `ProtocolBridge`, for the same action.
7. **Hardcoded TV IP (F8)** — `apps/host-daemon/src/tv/dispatcher.rs:47,62` defaults to
   `"192.168.1.102"`.
8. **Fake discovery (F9/F10)** — `apps/host-daemon/src/transport/signaling.rs:187-195`
   `GET /api/tv-target` returns `"discovered_tv": "192.168.1.102 (TCL Smart TV)"` — hardcoded/fake.
9. **Hardcoded LAN/IPs** — `transport/network.rs:82-83`, and the pairing URI default port `8765`
   (`pairingCrypto.ts`).
10. **CORS allows Any (F15)** — `signaling.rs:133-136` `CorsLayer::new().allow_origin(Any)`
    despite `core/config.rs:56,89` defining `allowed_origin` (default `https://remote.lookaberry.com`).
11. **Adapter lifecycles** — Samsung/LG/Android TV adapters present but incomplete pairing/registration
    lifecycles; Sony/Apple/Generic mapped to fallback (needs explicit implemented/experimental/unsupported).
12. **`/api/tv-command` HTTP path** coexists with WebRTC path as a second dispatch route (ties to F7).

## 6. Known technical debt

- PWA is configured in-source but no deployment pipeline or install/offline smoke test.
- No `HostConnectionManager` — transport URLs are constructed ad-hoc in components (hardcoded `:8765`).
- One watchdog (input safety) conflated with transport heartbeat; timing inconsistent (100ms vs 500ms).
- TV device identity == IP address (no stable registry across IP changes).
- Vendor TV adapters do not enforce "accepted/sent/acknowledged/failed/timeout/unsupported" results.
- No versioned `/api/v1/*` surface; endpoints are ad-hoc (`/api/tv-target`, `/api/tv-command`).
- CORS `Any` in production.
