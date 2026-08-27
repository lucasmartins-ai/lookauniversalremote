# LookARemote Security Architecture & Audit Report

## 1. Executive Summary

LookARemote employs multi-layer security architecture designed for low-latency local network interaction without compromising device safety or user privacy.

---

## 2. Cryptographic Pairing & Authentication

### 2.1 Ephemeral Diffie-Hellman Key Exchange (X25519)
- Both the Host Daemon and connecting Smartphone generate ephemeral X25519 keypairs.
- The Host displays its public key and a single-use 256-bit cryptographic nonce encoded in a QR code / URL fragment (`#h=<hex_pubkey>&k=<hex_nonce>`).
- The mobile client performs ECDH key agreement to derive a 256-bit shared symmetric secret `K_shared`:
  $$\text{Shared Secret} = \text{X25519}(sk_{client}, pk_{host})$$

### 2.2 Replay-Resistant HMAC-SHA256 Proof Handshake
- The client constructs an authentication proof:
  $$\text{Proof} = \text{HMAC-SHA256}(K_{shared}, pk_{client} \mathbin{\Vert} \text{nonce})$$
- The Host Daemon's `NonceManager` verifies:
  1. The nonce exists in the active table and has not expired (TTL: 60 seconds).
  2. The proof matches the expected HMAC calculation.
  3. The nonce is immediately invalidated upon first use to prevent replay attacks.

---

## 3. Network Transport & Cross-Origin Security

### 3.1 WebRTC DataChannel DTLS Encryption
- All real-time binary input packets (mouse, keyboard, gamepad, gyroscope, TV commands) flow through WebRTC DataChannels encrypted end-to-end via DTLS 1.2 with SRTP key exchange.

### 3.2 CORS Boundary Hardening (`apps/host-daemon/src/transport/signaling.rs`)
- Strict origin verification via `AllowOrigin::predicate`:
  - Allowed: `localhost`, `127.0.0.1`, `[::1]`, local RFC 1918 subnets (`192.168.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`), and official Vercel edge deployment domains (`*.vercel.app`).
  - Disallowed: Arbitrary external web origins.

### 3.3 Input Bounds & Sanitization
- TV text input is hard-capped at 1,024 bytes per message to prevent memory exhaustion.
- TV pairing PINs are bounded at 64 characters.
- Binary protocol parser verifies length headers and message boundaries with zero-copy validation before dispatch.

---

## 4. Host OS Driver Safety: Dead-Man Watchdog

- **Watchdog Timeout**: 300ms (`DEFAULT_WATCHDOG_TIMEOUT_MS = 300`).
- **Heartbeat Cadence**: 80ms (~12.5 Hz, satisfying the safety ratio $\le \frac{\text{timeout}}{3}$).
- **Auto-Neutralization**: If network drops or the smartphone disconnects while keys or gamepad buttons are depressed, the watchdog triggers an emergency neutralization release across all active virtual device drivers:
  - Mouse: All buttons released.
  - Keyboard: All modifiers and depressed keycodes released.
  - Gamepads: All analog sticks centered (0.0), triggers zeroed, all buttons released.
