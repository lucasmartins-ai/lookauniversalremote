# ADR-006: Mobile Client Architecture — React + Vite + TypeScript PWA

**Status:** Accepted  
**Date:** 2026-08-26  
**Context:** The mobile client must be immediately accessible to any smartphone without app store installation friction, support offline asset caching, handle high-frequency touch and sensor events, and render responsive controller interfaces.

---

## Decision
Build the mobile client as a **Progressive Web Application (PWA)** using **React, Vite, and TypeScript**, isolating real-time sensor processing and WebRTC data transfer from UI rendering cycles.

---

## Rationale
1. **Zero-Install Instant Access:** Users scan a QR code and immediately have a working controller in mobile Safari or Chrome without downloading a 50MB app store binary.
2. **Offline-First Resilience:** Service Worker caches all HTML, CSS, JavaScript, and asset bundles with a Cache-First strategy, ensuring the remote works indefinitely on local Wi-Fi even without internet access.
3. **Ecosystem & UI Component Velocity:** React's vast ecosystem facilitates modular controller layouts, accessibility hooks, and state management, while Vite provides sub-second HMR and optimized production bundling.
4. **Sensor & Hot-Path Isolation:** Sensor loops and WebRTC encoding use pre-allocated buffers and direct pointer handlers, completely bypassing React's virtual DOM reconciliation loop during active gameplay.

---

## Alternatives Considered
- **Svelte + Vite:** Smaller runtime bundle and reactive compiler. Considered closely, but React with TypeScript provides broader ecosystem alignment, battle-tested UI primitives, and easier community contributions.
- **Native iOS/Android Apps (Swift/Kotlin or React Native):** Native apps offer slightly deeper low-level hardware access, but impose massive installation friction (App Store/Play Store downloads, review delays, signing certificates), defeating the instant scan-and-play user experience.
- **Vanilla JavaScript (No Framework):** Minimal bundle size, but leads to spaghetti state management when building complex custom layouts, macro engines, and settings dialogs.

---

## Trade-offs
- Mobile Safari requires explicit user gestures to request gyroscope/accelerometer sensor permissions (`DeviceOrientationEvent.requestPermission`).
- Background tab throttling requires aggressive wake-lock management (`navigator.wakeLock`).

---

## Consequences
- Single unified codebase serves all mobile operating systems (iOS, Android).
- Zero-friction onboarding for new users.

---

## Revisit When
- Revisit native wrapper packaging (Capacitor/Tauri Mobile) as an optional secondary distribution channel for users who prefer dedicated home-screen apps with haptic rumble extensions.
