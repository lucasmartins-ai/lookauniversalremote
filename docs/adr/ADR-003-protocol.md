# ADR-003: Real-Time Input Serialization Protocol — Binary Protocol v1

**Status:** Accepted  
**Date:** 2026-08-26  
**Context:** High-rate input streams (60-120Hz) must be serialized in TypeScript and decoded in Rust with minimal CPU, zero heap allocations in the hot loop, and minimal packet size to prevent network saturation.

---

## Decision
Implement a custom, versioned **Binary Protocol v1** using little-endian fixed-offset packing with pre-allocated `ArrayBuffer` in TypeScript and zero-copy slice dereferencing in Rust.

---

## Rationale
1. **Zero-Allocation Hot Path:** Binary frames are parsed directly from network receive slices without string allocation or intermediate object creation.
2. **Minimal Wire Overhead:** Full gamepad state fits into 19 bytes; motion updates fit into 21 bytes (compared to >150 bytes in JSON).
3. **Deterministic Endianness:** Little-endian byte order matches the native architecture of modern mobile and desktop CPUs (x86_64, ARM64), enabling direct byte reinterpretation without byte-swapping overhead.

---

## Alternatives Considered
- **JSON:** Simple and debuggable, but introduces severe performance penalties: string serialization overhead, JSON parsing CPU load, and garbage collection churn in mobile browsers (10-15x wire size).
- **Protocol Buffers (Protobuf):** Good cross-language tooling, but adds unnecessary protobuf runtime overhead, varint decoding cost, and dynamic allocation during deserialization.
- **FlatBuffers:** Supports zero-copy reads, but introduces complex schema compilation toolchains and larger memory layouts for tiny 10-20 byte payloads.

---

## Trade-offs
- Schema changes require manual byte-offset management and careful versioning.
- Requires maintaining matching encoding/decoding test suites in both Rust and TypeScript.

---

## Consequences
- Ultra-compact packet sizes (< 25 bytes).
- Sub-microsecond encode and decode times on both mobile and host CPU.

---

## Revisit When
- Revisit if payload complexity grows to include deeply nested dynamic telemetry or rich multimedia data streams.
