import { describe, it, expect, vi } from 'vitest';
import { GestureRecognizer, TouchpadOutput } from '../features/trackpad/GestureRecognizer';

describe('GestureRecognizer', () => {
  it('detects 1-finger relative cursor movement with acceleration', () => {
    const outputs: TouchpadOutput[] = [];
    const recognizer = new GestureRecognizer(
      { sensitivity: 1.0, acceleration: 0.5 },
      (out) => outputs.push(out)
    );

    const now = 1000;
    // Touch start at (100, 100)
    recognizer.onTouchStart([{ id: 1, x: 100, y: 100 }], now);

    // Touch move to (110, 105) after 20ms
    recognizer.onTouchMove([{ id: 1, x: 110, y: 105 }], now + 20);

    expect(outputs.length).toBeGreaterThan(0);
    const lastOutput = outputs[outputs.length - 1];
    expect(lastOutput.dx).toBeGreaterThanOrEqual(10);
    expect(lastOutput.dy).toBeGreaterThanOrEqual(5);
    expect(lastOutput.scrollV).toBe(0);
    expect(lastOutput.scrollH).toBe(0);
    expect(lastOutput.buttonsMask).toBe(0);
  });

  it('detects 1-finger tap-to-click on quick release', async () => {
    vi.useFakeTimers();
    const outputs: TouchpadOutput[] = [];
    const recognizer = new GestureRecognizer(
      { tapToClick: true },
      (out) => outputs.push(out)
    );

    const startTime = 1000;
    recognizer.onTouchStart([{ id: 1, x: 50, y: 50 }], startTime);
    // Minimal movement
    recognizer.onTouchMove([{ id: 1, x: 52, y: 51 }], startTime + 50);
    // Release at 80ms (< 200ms threshold)
    recognizer.onTouchEnd([], [1], startTime + 80);

    expect(outputs.length).toBeGreaterThan(0);
    const tapEvent = outputs.find((o) => (o.buttonsMask & 0x01) !== 0);
    expect(tapEvent).toBeDefined();
    expect(tapEvent!.buttonsMask & 0x08).toBe(0x08); // Tap-to-click flag

    // Fast-forward timer for auto-release
    vi.advanceTimersByTime(50);
    const releaseEvent = outputs[outputs.length - 1];
    expect(releaseEvent.buttonsMask).toBe(0x00);
    vi.useRealTimers();
  });

  it('detects 2-finger scroll with natural scroll direction', () => {
    const outputs: TouchpadOutput[] = [];
    const recognizer = new GestureRecognizer(
      { naturalScroll: true, scrollSensitivity: 1.0 },
      (out) => outputs.push(out)
    );

    const now = 2000;
    // 2 fingers touch start
    recognizer.onTouchStart(
      [
        { id: 1, x: 100, y: 200 },
        { id: 2, x: 140, y: 200 },
      ],
      now
    );

    // Both fingers drag downwards (y increases: +30px)
    recognizer.onTouchMove(
      [
        { id: 1, x: 100, y: 230 },
        { id: 2, x: 140, y: 230 },
      ],
      now + 40
    );

    expect(outputs.length).toBeGreaterThan(0);
    const scrollOut = outputs[outputs.length - 1];
    expect(scrollOut.dx).toBe(0);
    expect(scrollOut.dy).toBe(0);
    // Dragging down with natural scroll produces positive scrollV
    expect(scrollOut.scrollV).toBeGreaterThan(0);
  });

  it('detects 2-finger right-click tap', () => {
    vi.useFakeTimers();
    const outputs: TouchpadOutput[] = [];
    const recognizer = new GestureRecognizer({}, (out) => outputs.push(out));

    const now = 3000;
    recognizer.onTouchStart(
      [
        { id: 1, x: 100, y: 100 },
        { id: 2, x: 150, y: 100 },
      ],
      now
    );

    // Both fingers lifted after 100ms
    recognizer.onTouchEnd([], [1, 2], now + 100);

    const rightClick = outputs.find((o) => (o.buttonsMask & 0x02) !== 0);
    expect(rightClick).toBeDefined();

    vi.advanceTimersByTime(50);
    const releaseEvent = outputs[outputs.length - 1];
    expect(releaseEvent.buttonsMask).toBe(0x00);
    vi.useRealTimers();
  });

  it('handles double-tap-and-drag gesture', () => {
    const outputs: TouchpadOutput[] = [];
    const recognizer = new GestureRecognizer(
      { doubleTapDrag: true },
      (out) => outputs.push(out)
    );

    let t = 4000;
    // Tap 1
    recognizer.onTouchStart([{ id: 1, x: 100, y: 100 }], t);
    recognizer.onTouchEnd([], [1], t + 50);

    // Tap 2 within 150ms
    t += 150;
    recognizer.onTouchStart([{ id: 2, x: 102, y: 101 }], t);

    // Drag move
    t += 30;
    recognizer.onTouchMove([{ id: 2, x: 120, y: 110 }], t);

    const dragOutput = outputs[outputs.length - 1];
    expect(dragOutput.buttonsMask & 0x01).toBe(0x01); // Dragging with Left Button Down

    // Release drag
    recognizer.onTouchEnd([], [2], t + 100);
    const endOutput = outputs[outputs.length - 1];
    expect(endOutput.buttonsMask).toBe(0x00);
  });
});
