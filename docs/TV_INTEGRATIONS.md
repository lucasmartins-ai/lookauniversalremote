# LookARemote Smart TV Integrations & Discovery Guide

## 1. Overview & Architecture

LookARemote features a vendor-isolated Smart TV integration engine that discovers, connects, and controls Smart TVs and streaming devices across local area networks (LAN).

```
                        ┌───────────────────────────────┐
                        │   LookARemote Web Client PWA   │
                        └───────────────┬───────────────┘
                                        │ WebRTC DataChannel (Single Authoritative Path)
                                        ▼
                        ┌───────────────────────────────┐
                        │      Host Daemon Router       │
                        └───────┬───────────────┬───────┘
                                │               │
          ┌─────────────────────┴───┐       ┌───┴───────────────────────┐
          │   TvDiscoveryService    │       │    TvAdapterManager       │
          ├─────────────────────────┤       ├───────────────────────────┤
          │ • SSDP (239.255.255.250)│       │ • Samsung Tizen (WS:8001) │
          │ • mDNS (224.0.0.251)    │       │ • LG webOS (SSAP:3000)    │
          │ • Probes (8060, 8008...)│       │ • Roku (ECP:8060)         │
          │ • Thread-Safe Registry  │       │ • Android / Google TV     │
          └─────────────────────────┘       │ • Sony Bravia (IRCC-IP)   │
                                            │ • Apple TV (AirPlay)      │
                                            │ • Generic (DLNA UPnP)     │
                                            └───────────────────────────┘
```

---

## 2. LAN Discovery Subsystems

### 2.1 SSDP / UPnP M-SEARCH (`apps/host-daemon/src/tv/discovery/ssdp.rs`)
- Multicast destination: `239.255.255.250:1900`
- Search Targets (ST):
  - `urn:dial-multiscreen-org:service:dial:1` (Samsung, LG, Google Cast, Roku)
  - `roku:ecp` (Roku Streaming Devices & TVs)
  - `urn:schemas-upnp-org:device:MediaRenderer:1` (DLNA/UPnP TVs)
  - `ssdp:all`
- Parses `LOCATION`, `ST`, `USN` (extracts UDN for stable device identity), and `SERVER` headers.

### 2.2 Multicast DNS / DNS-SD (`apps/host-daemon/src/tv/discovery/mdns.rs`)
- Multicast destination: `224.0.0.251:5353`
- DNS PTR queries:
  - `_googlecast._tcp.local` (Android TV / Google TV / Chromecast)
  - `_airplay._tcp.local` (Apple TV / tvOS)

### 2.3 Non-Invasive Capability Probes (`apps/host-daemon/src/tv/discovery/probe.rs`)
- Probes candidate IPs with 300ms bounded HTTP requests:
  - Port `8060` (`/query/device-info`): Roku ECP identification & model extraction
  - Port `8001` (`/api/v2/`): Samsung Tizen identification & model metadata
  - Port `8008` (`/setup/eureka_info`): Google Cast device name & model

### 2.4 Device Registry (`apps/host-daemon/src/tv/discovery/registry.rs`)
- Thread-safe `RwLock` cache keyed by stable device ID.
- Seamlessly handles DHCP IP migrations without losing pairing or selection state.
- Stale device eviction after 15 minutes of inactivity.

---

## 3. Platform Vendor Adapters

| Platform | Protocol ID | Port / Transport | Pairing Required | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Samsung Smart TV (Tizen)** | `1` (`SAMSUNG_TIZEN`) | WS `8001` / WSS `8002` (SmartView) | Yes (On-screen prompt / Token) | **IMPLEMENTED** |
| **LG Smart TV (webOS)** | `2` (`LG_WEBOS`) | WS `3000` (SSAP protocol) | Yes (client-key prompt) | **IMPLEMENTED** |
| **Android TV / Google TV** | `3` (`ANDROID_GOOGLE_TV`) | HTTP `8008` (Cast) / TCP `5555` | No (Cast) / Yes (ADB) | **IMPLEMENTED** |
| **Roku TV & Streaming** | `4` (`ROKU_TV`) | HTTP `8060` (ECP REST) | No | **IMPLEMENTED** |
| **Sony Bravia Smart TV** | `5` (`SONY_BRAVIA`) | HTTP `80` (IRCC-IP / REST) | Pre-Shared Key (PSK) | **IMPLEMENTED** |
| **Apple TV (tvOS)** | `6` (`APPLE_TV`) | HTTP `7000` (AirPlay Media) | Yes (SRP/HomeKit for MRP) | **IMPLEMENTED (Media)** |
| **Generic DLNA / UPnP** | `0` (`GENERIC_TV`) | HTTP `80` / `1400` (UPnP AVTransport) | No | **IMPLEMENTED** |

---

## 4. Single Authoritative Command Dispatch

Previous iterations performed dual dispatch (sending via WebRTC DataChannel and simultaneously sending HTTP POST requests to hardcoded LAN IPs).

In the current stabilized architecture:
1. The web client delegates all commands to `TvCommandService.ts`.
2. Commands are transmitted **exclusively** across the real-time `ProtocolBridge` (WebRTC DataChannel / WebSocket).
3. The Host Daemon's `InputRouter` intercepts the binary TV command packet and routes it to `TvAdapterManager`.
4. `TvAdapterManager` delegates execution to the corresponding isolated `TvAdapter` instance.

---

## 5. API v1 Endpoints

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/tv/devices` | Returns list of discovered Smart TVs and currently selected device |
| `POST` | `/api/v1/tv/scan` | Initiates an on-demand LAN SSDP/mDNS discovery cycle |
| `POST` | `/api/v1/tv/select` | Selects the active target TV device by `device_id` |
| `POST` | `/api/v1/tv/pair` | Initiates pairing handshake with the selected TV |
| `POST` | `/api/v1/tv/command` | Direct HTTP command execution endpoint |
