# Sprint 1 Specification — Monorepo Foundation & Protocol Core

**Sprint ID:** SPRINT-01  
**Phase:** Phase 1 (Core Monorepo Setup, Protocol Crates & Shared Types)  
**Status:** Ready for Execution  
**Goal:** Initialize the LookARemote monorepo workspace and implement the zero-allocation Binary Protocol v1 in both Rust (`packages/protocol`) and TypeScript (`packages/protocol-types`), verified by cross-language binary compatibility tests.

---

## 1. Scope & Deliverables

### 1.1 Root Monorepo Configuration
- `package.json`: Configured with npm/pnpm workspaces for `apps/*` and `packages/*`.
- `Cargo.toml`: Cargo workspace managing `packages/protocol` and future `apps/host-daemon`.
- `rust-toolchain.toml`: Pinned stable Rust version.
- `tsconfig.base.json`: Shared strict TypeScript configuration.

### 1.2 Rust Protocol Crate (`packages/protocol`)
- `Cargo.toml`: Crate metadata, dependencies (`byteorder` or standard byte conversion, `criterion` for benchmarks, `proptest` for property testing).
- `src/lib.rs`: Public API exports.
- `src/header.rs`: 5-byte base header representation (`Version`, `MessageType`, `Flags`, `Sequence`).
- `src/messages/`:
  - `motion.rs`: `MSG_MOTION` (21 bytes total) — Yaw, Pitch, Roll, Accelerations, Timestamp.
  - `gamepad.rs`: `MSG_GAMEPAD_FULL` (19 bytes total) — Button bitfield, sticks, triggers.
  - `touchpad.rs`: `MSG_TOUCHPAD` (12 bytes total) — $dX, dY$, scroll, mouse buttons.
  - `keyboard.rs`: `MSG_KEYBOARD` (9 bytes total) — HID Usage ID, state, modifiers.
  - `media.rs`: `MSG_MEDIA` (7 bytes total) — Consumer media actions.
  - `heartbeat.rs`: `MSG_HEARTBEAT` (13 bytes total) — Epoch timestamp, echo token.
  - `haptic.rs`: `MSG_HAPTIC_EVENT` (9 bytes total) — Motor index, intensity, duration.
- `src/decoder.rs`: Zero-allocation binary frame parser directly from `&[u8]`.
- `src/encoder.rs`: Fixed-size stack-allocated frame builder (`[u8; N]`).
- `src/sequence.rs`: Modular 16-bit sequence number comparator and out-of-order filter.
- `benches/protocol_bench.rs`: Criterion benchmark asserting sub-microsecond encode/decode.

### 1.3 TypeScript Protocol Package (`packages/protocol-types`)
- `package.json`: ESM/CJS build configs, test scripts (`vitest`).
- `tsconfig.json`: TypeScript compiler options extending base.
- `src/constants.ts`: Message type constants, button bitmasks, header offsets.
- `src/types.ts`: TypeScript interfaces for all input payloads and header.
- `src/encoder.ts`: Zero-allocation `ArrayBuffer` / `DataView` serializing methods.
- `src/decoder.ts`: Matching client-side deserializer for incoming host frames (e.g. `MSG_HAPTIC_EVENT`, `MSG_HEARTBEAT`).
- `src/sequence.ts`: 16-bit sequence generator and validator.
- `tests/protocol.test.ts`: Vitest suite verifying byte-level parity against protocol spec.

### 1.4 Cross-Language Verification Test Vectors
- `packages/protocol/tests/golden_vectors.json`: Canonical binary test vectors (hex dumps and corresponding decoded fields).
- Shared automated test runner in Rust and TS verifying identical serialization and deserialization of the golden test vectors.

---

## 2. Acceptance Criteria & Definition of Done

1. `cargo test -p lookaremote-protocol` passes with 100% code coverage on all message types.
2. `npm test --workspace=@lookaremote/protocol-types` passes all serialization/deserialization test suites.
3. Cross-language test vectors produce identical byte representations between Rust and TypeScript.
4. Sequence number wraparound ($65535 \to 0$) correctly filters out-of-order packets.
5. Zero heap allocations in Rust hot path parsing.
6. `cargo clippy --workspace` passes with zero warnings.
