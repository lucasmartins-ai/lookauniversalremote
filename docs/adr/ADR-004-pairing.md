# ADR-004: Pairing & Authentication — Ephemeral Cryptographic QR Handshake

**Status:** Accepted  
**Date:** 2026-08-26  
**Context:** Pairing a mobile browser with the desktop host daemon must be frictionless (scan-and-go) yet robustly protected against local network eavesdropping, replay attacks, and unauthorized control.

---

## Decision
Implement an **Ephemeral Cryptographic QR Handshake** using short-lived (60s TTL) single-use nonces and ephemeral X25519 public keys, strictly rejecting permanent tokens or long-lived shared secrets in QR URLs.

---

## Rationale
1. **Frictionless Zero-Typing UX:** Users scan the QR code displayed on the desktop terminal/window with their smartphone camera; the PWA launches and automatically completes the cryptographic handshake.
2. **Replay & Snooping Protection:** Intercepted QR URLs or network logs cannot be reused to hijack control sessions once the 60s TTL expires or after initial connection establishment.
3. **LAN Isolation:** Signaling and pairing listeners bind strictly to RFC 1918 private subnets, preventing WAN attack vectors.

---

## Alternatives Considered
- **Permanent Secret Token in QR URL:** Simple to implement, but vulnerable to session hijacking if the QR code is photographed, stored in browser history, or leaked in network proxy logs.
- **Manual PIN / Passcode Entry:** Secure, but introduces annoying friction, manual typing errors on mobile keyboards, and slower connection setup.
- **Unauthenticated Open LAN Binding:** Allows instant connection, but leaves the desktop completely vulnerable to malicious devices on shared Wi-Fi networks (dormitories, cafes, offices).

---

## Trade-offs
- QR codes expire after 60 seconds, requiring regeneration if pairing is delayed.
- Mobile client must have access to Web Crypto API (`crypto.subtle` / X25519) in secure contexts (HTTPS/localhost).

---

## Consequences
- High security guarantees with minimal user friction.
- Sessions are strictly bounded and audited.

---

## Revisit When
- Revisit if WebAuthn / Passkeys or proximity-based Web Bluetooth APIs become universally standard for zero-friction local device pairing.
