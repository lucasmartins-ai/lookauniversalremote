# Controller UI/UX Design System — LookARemote

**Document ID:** DES-2026-001  
**Status:** Approved / Design System  
**Author:** Principal Product Designer & Frontend Architect  

---

## 1. Design Philosophy: "Physical Hardware in Glass"

LookARemote is designed not as a generic website, but as a high-precision physical controller rendered in software.

### Core Principles
1. **Muscle Memory Ergonomics:** Fixed, predictable touch zones positioned where thumbs naturally rest during one-handed (portrait) and two-handed (landscape) grip.
2. **Zero Distraction:** Dark, OLED-optimized backgrounds ($#0D1117$ / pure black), high-contrast neon accents, and zero cluttered text during active gameplay.
3. **Instant Tactile Haptics:** Short, crisp haptic vibrations ($10 - 25\text{ ms}$) on button down, trigger threshold crossing, and mode switching.
4. **Touch-Action Isolation:** All control surfaces strictly enforce `touch-action: none` and `user-select: none` to eliminate browser pinch-zoom, pull-to-refresh, or context menus.

---

## 2. Layouts & Orientations

### 2.1 Landscape Gamepad Mode
```text
┌────────────────────────────────────────────────────────────────────────────┐
│ [L1] [L2]                     [STATUS: 2ms]                     [R2] [R1]  │
│                                                                            │
│      ▲                                                                     │
│   ◄  ●  ►                  [SELECT]   [START]                   (Y)        │
│      ▼                                                       (X)   (B)     │
│                                                                 (A)        │
│    ( L-STICK )                                                             │
│   [Thumb Zone]                                             ( R-STICK )     │
│                                                           [Thumb Zone]     │
│                                                                            │
│ [GYRO AIM ON]                                               [MODE: GAME]   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Portrait Desktop / Trackpad Mode
```text
┌────────────────────────────────────────┐
│ [⚙ Settings]   [LookARemote]   [● 3ms] │
├────────────────────────────────────────┤
│                                        │
│                                        │
│                                        │
│          MULTI-TOUCH TRACKPAD          │
│                SURFACE                 │
│                                        │
│         - 1 Finger: Move / Tap         │
│         - 2 Fingers: Scroll / R-Click  │
│                                        │
│                                        │
├───────────────────┬────────────────────┤
│    LEFT CLICK     │    RIGHT CLICK     │
│    (Large Zone)   │    (Large Zone)    │
├───────────────────┴────────────────────┤
│ [⌨ Keyboard]   [⏯ Media]   [🎮 Game]   │
└────────────────────────────────────────┘
```

---

## 3. Color Tokens & Typography

### Palette (Dark Futuristic Theme)
```css
:root {
  /* Surface colors */
  --bg-primary: #0a0e17;
  --bg-surface: #121824;
  --bg-surface-active: #1f293d;
  --border-subtle: #232d42;

  /* Accent & Action colors */
  --accent-cyan: #00f0ff;
  --accent-cyan-glow: rgba(0, 240, 255, 0.25);
  --accent-magenta: #ff0055;
  --accent-amber: #ffb800;
  --accent-green: #00ff66;

  /* Controller Action Buttons */
  --btn-a: #00e676; /* Green */
  --btn-b: #ff1744; /* Red */
  --btn-x: #2979ff; /* Blue */
  --btn-y: #ffd600; /* Yellow */

  /* Text colors */
  --text-primary: #ffffff;
  --text-secondary: #8b9bb4;
  --text-muted: #4a5568;

  /* Metrics & Status */
  --status-connected: #00ff66;
  --status-degraded: #ffb800;
  --status-disconnected: #ff1744;
}
```

### Typography
- **Primary Font:** System-native geometric sans-serif: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- **Monospace Metrics:** `JetBrains Mono, SF Mono, Menlo, monospace` for latency timers, sequence debuggers, and IP readouts.

---

## 4. Touch Target & Accessibility Guidelines

1. **Minimum Target Size:** All interactive buttons have a minimum physical bounding box of $48\text{px} \times 48\text{px}$ (exceeding WCAG 2.1 AAA target size criteria).
2. **Dynamic Stick Scaling:** Virtual thumbsticks auto-center on touch-down position within their designated bounding quadrant, accommodating varied hand sizes.
3. **Color-Blind Accessibility:** All status badges pair color indicators with distinct geometric icons (e.g. ● Connected, ▲ Warning/Degraded, ✖ Disconnected).
4. **Reduced Motion Support:** `@media (prefers-reduced-motion: reduce)` disables ambient particle glows and transitions without affecting input response.

---

## 5. Haptic Feedback Vibration Profiles

```typescript
export const HapticProfiles = {
  ButtonPress: [12],               // Crisp 12ms tick
  ButtonRelease: [6],              // Subtle 6ms release
  TriggerClick: [25],              // Firm 25ms trigger actuation
  StickDeadzoneExit: [8],          // Micro-tick on leaving deadzone
  ModeSwitch: [15, 30, 15],        // Double pulse on mode change
  WatchdogWarning: [50, 100, 50],  // Alert pulse on connection drop
};
```
