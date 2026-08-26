# Developer Guide & Build Toolchain — LookARemote

**Document ID:** DEV-2026-001  
**Status:** Approved / Developer Guide  

---

## 1. Monorepo Structure

```text
universal-remote/
├── apps/
│   ├── web-client/             # React + Vite + TypeScript PWA
│   └── host-daemon/            # Rust Native Desktop Daemon
├── packages/
│   ├── protocol/               # Rust Crate: Binary protocol v1 codec & tests
│   ├── protocol-types/         # TypeScript: Protocol codec & serialization
│   └── shared-config/          # Shared type definitions and default profiles
├── docs/                       # Specifications, Architecture, ADRs, Threat Models
├── tests/                      # Multi-tier test suites (e2e, integration, fuzz)
├── package.json                # NPM workspaces root
├── Cargo.toml                  # Cargo workspace root
├── rust-toolchain.toml         # Pinned Rust stable compiler
└── tsconfig.base.json          # Shared TypeScript compiler config
```

---

## 2. Prerequisites & Toolchain Setup

### Required Tools:
- **Rust Toolchain:** Stable Rust (1.75+) with `cargo` and `clippy`.
- **Node.js:** Node v20+ LTS with `npm` or `pnpm`.
- **Platform Dependencies:**
  - *Linux:* `libudev-dev`, `pkg-config`, `libasound2-dev` (optional for audio).
  - *Windows:* Windows 10/11 SDK, Visual Studio C++ Build Tools, ViGEmBus driver.
  - *macOS:* Xcode Command Line Tools.

---

## 3. Build & Development Workflows

### 3.1 Install Dependencies
```bash
# Install root Node workspaces dependencies
npm install

# Verify Rust workspace compilation
cargo check --workspace
```

### 3.2 Running the Development Environment
```bash
# Terminal 1: Run Host Daemon in debug mode
cargo run --bin host-daemon -- --debug

# Terminal 2: Run Web Client PWA dev server
npm run dev --workspace=@lookaremote/web-client
```

### 3.3 Running Automated Tests
```bash
# Run Rust unit, integration & protocol tests
cargo test --workspace

# Run TypeScript client & protocol tests
npm test --workspaces

# Run Protocol cross-language validation harness
cargo test --test protocol_interop
```

### 3.4 Production Builds
```bash
# Build optimized release binary of the desktop daemon
cargo build --release --bin host-daemon

# Build production bundle for the PWA client
npm run build --workspace=@lookaremote/web-client
```
