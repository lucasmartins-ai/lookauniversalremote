/**
 * Multi-touch Gesture Recognizer for LookARemote Trackpad Surface.
 * Supports 1-finger ballistic cursor movement, tap-to-click, 2-finger scroll,
 * 2-finger right click tap, and 1-finger double-tap-and-drag.
 */

export interface GestureConfig {
  sensitivity: number; // 0.2 to 3.0 (default 1.0)
  acceleration: number; // 0.0 (linear) to 2.0 (default 0.8)
  naturalScroll: boolean; // default true
  scrollSensitivity: number; // 0.5 to 3.0 (default 1.0)
  tapToClick: boolean; // default true
  doubleTapDrag: boolean; // default true
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  sensitivity: 1.0,
  acceleration: 0.8,
  naturalScroll: true,
  scrollSensitivity: 1.0,
  tapToClick: true,
  doubleTapDrag: true,
};

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface TouchpadOutput {
  dx: number;
  dy: number;
  scrollV: number;
  scrollH: number;
  buttonsMask: number;
}

export type TouchpadCallback = (output: TouchpadOutput) => void;

interface TouchState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  lastTime: number;
  totalDistance: number;
}

export class GestureRecognizer {
  private config: GestureConfig;
  private touches: Map<number, TouchState> = new Map();
  private callback: TouchpadCallback | null = null;

  // Tap & double-tap tracking
  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private isDragging = false;

  // Sub-pixel accumulators for smooth movement & scrolling
  private subpixelDx = 0;
  private subpixelDy = 0;
  private subpixelScrollV = 0;
  private subpixelScrollH = 0;

  constructor(config: Partial<GestureConfig> = {}, callback?: TouchpadCallback) {
    this.config = { ...DEFAULT_GESTURE_CONFIG, ...config };
    if (callback) {
      this.callback = callback;
    }
  }

  public setConfig(partial: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  public setCallback(callback: TouchpadCallback): void {
    this.callback = callback;
  }

  /**
   * Called when one or more touches begin on the trackpad surface.
   */
  public onTouchStart(activeTouches: TouchPoint[], now: number = Date.now()): void {
    for (const t of activeTouches) {
      this.touches.set(t.id, {
        id: t.id,
        startX: t.x,
        startY: t.y,
        lastX: t.x,
        lastY: t.y,
        startTime: now,
        lastTime: now,
        totalDistance: 0,
      });
    }

    // Check for double-tap-to-drag initiation (1 finger)
    if (this.touches.size === 1 && this.config.doubleTapDrag) {
      const touch = activeTouches[0];
      const timeSinceLastTap = now - this.lastTapTime;
      const distFromLastTap = Math.hypot(touch.x - this.lastTapX, touch.y - this.lastTapY);

      if (timeSinceLastTap < 300 && distFromLastTap < 30) {
        this.isDragging = true;
        // Emit button down for drag
        this.emit({
          dx: 0,
          dy: 0,
          scrollV: 0,
          scrollH: 0,
          buttonsMask: 0x01, // Left button down
        });
      }
    }
  }

  /**
   * Called when active touches move across the trackpad surface.
   */
  public onTouchMove(activeTouches: TouchPoint[], now: number = Date.now()): void {
    const touchCount = activeTouches.length;

    if (touchCount === 1) {
      // --- 1 FINGER: CURSOR MOVEMENT ---
      const t = activeTouches[0];
      const state = this.touches.get(t.id);
      if (!state) return;

      const rawDx = t.x - state.lastX;
      const rawDy = t.y - state.lastY;
      const dt = Math.max(1, now - state.lastTime);

      state.totalDistance += Math.hypot(rawDx, rawDy);
      state.lastX = t.x;
      state.lastY = t.y;
      state.lastTime = now;

      // Ballistic acceleration calculation
      // Speed in px/ms
      const speed = Math.hypot(rawDx, rawDy) / dt;
      const v0 = 0.5; // reference speed threshold (0.5 px/ms = 500 px/s)
      const accelFactor = 1.0 + this.config.acceleration * Math.min(speed / v0, 3.0);
      const scale = this.config.sensitivity * accelFactor;

      const targetDx = rawDx * scale + this.subpixelDx;
      const targetDy = rawDy * scale + this.subpixelDy;

      const intDx = Math.trunc(targetDx);
      const intDy = Math.trunc(targetDy);

      this.subpixelDx = targetDx - intDx;
      this.subpixelDy = targetDy - intDy;

      if (intDx !== 0 || intDy !== 0) {
        this.emit({
          dx: Math.max(-32768, Math.min(32767, intDx)),
          dy: Math.max(-32768, Math.min(32767, intDy)),
          scrollV: 0,
          scrollH: 0,
          buttonsMask: this.isDragging ? 0x01 : 0x00,
        });
      }
    } else if (touchCount === 2) {
      // --- 2 FINGERS: SCROLL WHEEL ---
      const t1 = activeTouches[0];
      const t2 = activeTouches[1];
      const s1 = this.touches.get(t1.id);
      const s2 = this.touches.get(t2.id);

      if (!s1 || !s2) return;

      const rawDx1 = t1.x - s1.lastX;
      const rawDy1 = t1.y - s1.lastY;
      const rawDx2 = t2.x - s2.lastX;
      const rawDy2 = t2.y - s2.lastY;

      s1.totalDistance += Math.hypot(rawDx1, rawDy1);
      s2.totalDistance += Math.hypot(rawDx2, rawDy2);
      s1.lastX = t1.x;
      s1.lastY = t1.y;
      s2.lastX = t2.x;
      s2.lastY = t2.y;
      s1.lastTime = now;
      s2.lastTime = now;

      // Average displacement of both fingers
      const avgDx = (rawDx1 + rawDx2) / 2.0;
      const avgDy = (rawDy1 + rawDy2) / 2.0;

      // Natural scroll: dragging down (dy > 0) scrolls down (positive delta)
      const scrollDirection = this.config.naturalScroll ? 1.0 : -1.0;
      const scrollScale = this.config.scrollSensitivity * 0.5 * scrollDirection;

      const targetV = avgDy * scrollScale + this.subpixelScrollV;
      const targetH = avgDx * scrollScale + this.subpixelScrollH;

      const intScrollV = Math.trunc(targetV);
      const intScrollH = Math.trunc(targetH);

      this.subpixelScrollV = targetV - intScrollV;
      this.subpixelScrollH = targetH - intScrollH;

      if (intScrollV !== 0 || intScrollH !== 0) {
        this.emit({
          dx: 0,
          dy: 0,
          scrollV: Math.max(-128, Math.min(127, intScrollV)),
          scrollH: Math.max(-128, Math.min(127, intScrollH)),
          buttonsMask: 0x00,
        });
      }
    }
  }

  /**
   * Called when touches end or are lifted from the surface.
   */
  public onTouchEnd(_activeTouches: TouchPoint[], removedTouchIds: number[], now: number = Date.now()): void {
    const previousTouchCount = this.touches.size;

    // Process removed touches for tap detection
    for (const id of removedTouchIds) {
      const state = this.touches.get(id);
      if (state) {
        const duration = now - state.startTime;

        // 1-Finger Tap Check (< 200ms and < 12px travel)
        if (previousTouchCount === 1 && !this.isDragging) {
          if (duration < 200 && state.totalDistance < 12 && this.config.tapToClick) {
            this.handleTap(state.startX, state.startY, now);
          }
        }
        // 2-Finger Right Click Tap (< 250ms and < 15px travel)
        else if (previousTouchCount === 2) {
          if (duration < 250 && state.totalDistance < 15) {
            this.handleTwoFingerTap();
          }
        }

        this.touches.delete(id);
      }
    }

    // End drag mode if all touches are gone
    if (this.isDragging && this.touches.size === 0) {
      this.isDragging = false;
      this.emit({
        dx: 0,
        dy: 0,
        scrollV: 0,
        scrollH: 0,
        buttonsMask: 0x00, // Release button
      });
    }

    // Reset sub-pixels when all fingers lifted
    if (this.touches.size === 0) {
      this.subpixelDx = 0;
      this.subpixelDy = 0;
      this.subpixelScrollV = 0;
      this.subpixelScrollH = 0;
    }
  }

  private handleTap(x: number, y: number, now: number): void {
    this.lastTapTime = now;
    this.lastTapX = x;
    this.lastTapY = y;

    // Emit Left Click (Button 1 + Tap flag)
    this.emit({
      dx: 0,
      dy: 0,
      scrollV: 0,
      scrollH: 0,
      buttonsMask: 0x01 | 0x08,
    });

    // Schedule instant release after 35ms
    setTimeout(() => {
      if (!this.isDragging) {
        this.emit({
          dx: 0,
          dy: 0,
          scrollV: 0,
          scrollH: 0,
          buttonsMask: 0x00,
        });
      }
    }, 35);
  }

  private handleTwoFingerTap(): void {
    // Emit Right Click (Button 2)
    this.emit({
      dx: 0,
      dy: 0,
      scrollV: 0,
      scrollH: 0,
      buttonsMask: 0x02,
    });

    // Schedule instant release after 35ms
    setTimeout(() => {
      this.emit({
        dx: 0,
        dy: 0,
        scrollV: 0,
        scrollH: 0,
        buttonsMask: 0x00,
      });
    }, 35);
  }

  private emit(output: TouchpadOutput): void {
    if (this.callback) {
      this.callback(output);
    }
  }

  public reset(): void {
    this.touches.clear();
    this.isDragging = false;
    this.subpixelDx = 0;
    this.subpixelDy = 0;
    this.subpixelScrollV = 0;
    this.subpixelScrollH = 0;
  }
}
