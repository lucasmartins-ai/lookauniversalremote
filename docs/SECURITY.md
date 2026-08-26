# Security Threat Model & Cryptographic Handshake — LookARemote

**Document ID:** SEC-2026-001  
**Status:** Approved / Security Architecture  
**Author:** Principal Security Architect  

---

## 1. Threat Model (STRIDE Assessment)

| Threat Category | Potential Attack Vector | System Vulnerability | Mitigation Strategy |
|---|---|---|---|
| **Spoofing** | Rogue device on LAN pretending to be a paired phone | Unauthenticated signaling or data channels | Ephemeral QR code containing X25519 public key + 256-bit single-use pairing nonce. DTLS certificate fingerprint verification. |
| **Tampering** | Man-in-the-Middle (MitM) altering input events on Wi-Fi | Unencrypted traffic or weak cipher suites | Mandatory DTLS 1.3 encryption on DataChannels and TLS 1.3 / WSS for local signaling. |
| **Repudiation** | Malicious input injection without traceability | Lack of session audit logging | Session ID binding and local host audit logging of connection lifecycles. |
| **Information Disclosure** | QR code interception exposing permanent secrets | Permanent API keys embedded in QR URLs | QR codes contain strictly single-use ephemeral tokens that expire after 60 seconds or immediately upon handshake. |
| **Denial of Service** | Packet flooding over LAN exhausting host CPU | Unbounded memory allocation or thread starvation | Token-bucket rate limiting (max 300 packets/sec per IP), zero-allocation binary decoder, bounded queues. |
| **Elevation of Privilege** | Malformed packet payload attempting buffer overflow or OS command injection | Parsing vulnerabilities or generic command execution APIs | Memory-safe Rust implementation; protocol explicitly defines bounded enum values and strictly prohibits shell command execution. |

---

## 2. Ephemeral Cryptographic Handshake Architecture

```text
┌──────────────────────────┐                                    ┌──────────────────────────┐
│   Mobile Client (PWA)    │                                    │    Host Daemon (Rust)    │
└────────────┬─────────────┘                                    └────────────┬─────────────┘
             │                                                               │
             │ 1. User scans QR code generated on Host Screen               │ Generates ephemeral
             │    { host_ip, port, host_pubkey, pairing_token_nonce }        │ X25519 keypair & nonce
             │                                                               │
             ▼                                                               │
     Generates ephemeral                                                     │
     X25519 keypair & Auth Token                                             │
             │                                                               │
             │ 2. HTTPS/WSS Signaling Connect (Handshake Request)            │
             │    { client_pubkey, pairing_token_nonce, hmac_proof }        │
             ├──────────────────────────────────────────────────────────────►│
             │                                                               │ Verifies nonce & HMAC
             │                                                               │ Generates Shared Secret
             │ 3. Signaling Handshake Response (SDP Offer + ICE Candidates)  │ via X25519 Diffie-Hellman
             │    { sdp_offer, host_dtls_fingerprint, session_id }           │
             │◄──────────────────────────────────────────────────────────────┤
             │                                                               │
             │ 4. SDP Answer + ICE Candidates                                │
             ├──────────────────────────────────────────────────────────────►│
             │                                                               │
             │ 5. WebRTC DTLS 1.3 Handshake (Direct UDP/SCTP)                │
             │    Mutual DTLS Certificate Fingerprint Verification           │
             │◄═════════════════════════════════════════════════════════════►│
             │                                                               │
             │ 6. Real-Time Encrypted Binary DataChannel Established         │
             │    (Ready for zero-latency input transmission)                │
             ▼                                                               ▼
```

---

## 3. Pairing Token & QR Code Construction

The pairing QR code encodes a compact URI scheme:
```text
https://remote.lookaberry.com/connect#h=192.168.1.50&p=8765&k=a8f94c...&n=e3b0c4...&v=1
```

### Parameters:
- `h`: Local host private IP address (IPv4 / IPv6).
- `p`: Local host signaling port (default `8765`).
- `k`: Hex-encoded Host Ephemeral X25519 Public Key (32 bytes).
- `n`: Hex-encoded 256-bit Single-Use Pairing Nonce.
- `v`: Protocol version integer (`1`).

### Security Invariants:
1. The pairing nonce `n` is held in host memory with an absolute Time-To-Live (TTL) of **60 seconds**.
2. Once a successful connection is negotiated, the nonce is immediately invalidated and purged from memory.
3. No permanent keys or host secrets are ever embedded in the QR code or transmitted over the wire.

---

## 4. Network Interface Binding & WAN Isolation

To prevent accidental exposure to the public internet:
1. **Interface Filtering:** The host signaling server automatically enumerates local network adapters and binds **only** to RFC 1918 private IPv4 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and link-local IPv6 (`fe80::/10`).
2. **WAN Blocking:** The daemon explicitly rejects binding to `0.0.0.0` or public WAN IP addresses unless an explicit `--allow-wan` CLI flag is provided by the user with a mandatory security warning.
3. **CORS & Origin Validation:** The HTTP signaling endpoint enforces strict Origin header verification against the official PWA origin (`https://remote.lookaberry.com` or configured local origin).

---

## 5. Input Safety Guarantees

1. **No Shell Execution:** There is no protocol message capable of launching executables, executing scripts, opening arbitrary URLs, or altering host file systems.
2. **Bounds Enforcement:** All incoming array offsets, button indices, and coordinate deltas are verified against static bounds before being passed to platform virtual HID drivers.
3. **Rust Memory Safety:** The host protocol decoder and input routing pipeline are implemented in 100% safe Rust (using `#![forbid(unsafe_code)]` for core network and parsing modules).
