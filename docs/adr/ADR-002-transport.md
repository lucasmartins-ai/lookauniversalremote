# ADR-002: Transport Layer Selection — WebRTC DataChannel

**Status:** Accepted  
**Date:** 2026-08-26  
**Context:** The system requires real-time, low-latency bidirectional communication between an unprivileged mobile web browser (iOS Safari, Android Chrome) and the desktop daemon over a Local Area Network (LAN).

---

## Decision
Select **WebRTC DataChannel** configured with `ordered: false` and `maxRetransmits: 0` (unreliable, unordered SCTP over DTLS over UDP) as the primary real-time transport, abstracting the network layer behind a generic `Transport` trait to accommodate future transport protocols (such as WebTransport/QUIC).

---

## Rationale
1. **Zero-Install Browser Support:** WebRTC DataChannel is the only universally supported browser API across all major mobile browsers (Safari, Chrome, Firefox) that provides low-latency, datagram-like UDP transport without requiring native app store installation.
2. **Head-of-Line Blocking Elimination:** Standard WebSockets suffer from TCP head-of-line blocking (where a single dropped packet stalls all subsequent input events). Unordered SCTP delivers each packet immediately upon arrival.
3. **Built-in Enterprise Encryption & NAT Traversal:** WebRTC mandates DTLS 1.3 encryption and includes ICE candidate discovery, ensuring secure LAN communication out of the box.

---

## Alternatives Considered
- **WebSockets (TCP):** Simple to implement, but vulnerable to TCP retransmission delays and head-of-line blocking on congested Wi-Fi networks (latency spikes of 50-200ms during minor packet loss).
- **WebTransport / QUIC:** Modern alternative offering datagram support. Rejected for initial release due to incomplete browser support (Safari iOS lacks mature WebTransport datagram support) and self-signed certificate complexity over private LAN IPs.
- **Raw UDP (Native Socket):** Not available inside standard web browser environments without native app packaging.

---

## Trade-offs
- WebRTC requires a local signaling phase (SDP offer/answer and ICE candidates exchange) before the DataChannel opens.
- Slightly higher CPU overhead during connection establishment due to DTLS handshake.

---

## Consequences
- Web clients can connect instantaneously via any modern smartphone browser without installing native apps.
- Input latency over 5GHz LAN consistently meets the $< 5\text{ ms}$ budget.

---

## Revisit When
- Revisit when WebTransport datagrams gain universal, frictionless support across iOS Safari and mobile Chrome on local private networks.
