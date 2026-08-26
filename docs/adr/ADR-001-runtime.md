# ADR-001: Host Daemon Runtime Selection — Rust

**Status:** Accepted  
**Date:** 2026-08-26  
**Context:** The host daemon must run as a background service on desktop operating systems (Windows, Linux, macOS), processing incoming high-frequency input streams (up to 120Hz), decoding binary packets with sub-millisecond latency, interacting directly with native OS virtual input drivers (ViGEm, uinput, CGEvent), and operating with minimal CPU (< 1.5%) and RAM (< 25MB) footprint.

---

## Decision
Select **Rust** (with Tokio async runtime for signaling and native OS driver bindings) as the language and runtime for the desktop host daemon.

---

## Rationale
1. **Zero-Cost Abstractions & Zero GC:** Rust guarantees deterministic sub-millisecond execution times with zero garbage collection stop-the-world pauses.
2. **Native C/OS Interoperability:** Effortless, direct FFI to Linux kernel ioctl (`/dev/uinput`), Windows C++ drivers (`ViGEmClient`), and macOS Quartz/IOKit APIs.
3. **Memory Safety & Concurrency:** Eliminates data races, buffer overflows, and memory leaks at compile time without runtime overhead.
4. **Minimal Binary & Resource Footprint:** Produces standalone static binaries with $< 20\text{ MB}$ size, $< 25\text{ MB}$ RSS memory, and $< 0.1\%$ idle CPU usage.

---

## Alternatives Considered
- **Go:** Considered for fast developer velocity and built-in concurrency. Rejected due to Go's Garbage Collector introducing unpredictable 1-5ms stop-the-world GC pauses on the input hot path, higher baseline memory consumption (~40-60MB), and clunky CGo overhead for OS driver bindings.
- **Bun / Node.js:** Considered for code sharing with the web client. Rejected due to high V8 memory overhead (>80MB RSS), garbage collection spikes, single-threaded event loop blocking on native driver calls, and complex native addon distribution across platforms.

---

## Trade-offs
- Steeper learning curve and longer compilation times compared to Go or TypeScript.
- Strict borrow checker requires explicit lifetime and buffer management for zero-copy parsing.

---

## Consequences
- The host daemon is packaged as a single self-contained native executable with zero external runtime dependencies.
- Sub-millisecond packet processing times and predictable memory bounds are achieved.

---

## Revisit When
- Revisit if WebAssembly on the desktop (e.g. WASI) matures to provide identical low-level OS driver access with native performance and superior sandboxing.
