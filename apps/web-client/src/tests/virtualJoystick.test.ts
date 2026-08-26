import { describe, it, expect } from 'vitest';
import { calculateJoystickVector } from '../features/gamepad/VirtualJoystick';
import { calculateDPadMask } from '../features/gamepad/DPad';
import { GamepadButtonMask } from '@lookaremote/protocol-types';

describe('VirtualJoystick & D-Pad Math Unit Tests', () => {
  const MAX_RADIUS = 60;
  const DEADZONE = 0.15;

  describe('calculateJoystickVector', () => {
    it('returns zero vector when within deadzone radius', () => {
      // 5px distance is 5/60 = ~0.083 < 0.15 deadzone
      const result = calculateJoystickVector(3, 4, MAX_RADIUS, DEADZONE);
      expect(result.stickX).toBe(0);
      expect(result.stickY).toBe(0);
      expect(result.magnitude).toBe(0);
      expect(result.visualX).toBeCloseTo(3);
      expect(result.visualY).toBeCloseTo(4);
    });

    it('smoothly rescales above deadzone boundary', () => {
      // Half-way between deadzone and max radius
      const midRadius = (0.15 + (1.0 - 0.15) * 0.5) * MAX_RADIUS;
      const result = calculateJoystickVector(midRadius, 0, MAX_RADIUS, DEADZONE);

      expect(result.magnitude).toBeCloseTo(0.5, 1);
      expect(result.stickX).toBeGreaterThan(15000);
      expect(result.stickX).toBeLessThan(18000);
      expect(result.stickY).toBe(0);
    });

    it('reaches maximum clamped i16 limit (32767) at full deflection', () => {
      // Fully deflected right (dx = MAX_RADIUS, dy = 0)
      const right = calculateJoystickVector(MAX_RADIUS + 20, 0, MAX_RADIUS, DEADZONE);
      expect(right.stickX).toBe(32767);
      expect(right.stickY).toBe(0);
      expect(right.magnitude).toBe(1.0);
      expect(right.visualX).toBe(MAX_RADIUS);

      // Fully deflected left (dx = -MAX_RADIUS, dy = 0)
      const left = calculateJoystickVector(-MAX_RADIUS - 20, 0, MAX_RADIUS, DEADZONE);
      expect(left.stickX).toBe(-32767);
      expect(left.stickY).toBe(0);

      // Fully deflected down (dy = MAX_RADIUS)
      const down = calculateJoystickVector(0, MAX_RADIUS + 10, MAX_RADIUS, DEADZONE);
      expect(down.stickX).toBe(0);
      expect(down.stickY).toBe(32767);
    });

    it('inverts Y axis when invertY flag is set', () => {
      const normal = calculateJoystickVector(0, MAX_RADIUS, MAX_RADIUS, DEADZONE, 1.0, false);
      const inverted = calculateJoystickVector(0, MAX_RADIUS, MAX_RADIUS, DEADZONE, 1.0, true);

      expect(normal.stickY).toBe(32767);
      expect(inverted.stickY).toBe(-32767);
    });

    it('handles zero distance cleanly', () => {
      const result = calculateJoystickVector(0, 0, MAX_RADIUS, DEADZONE);
      expect(result.stickX).toBe(0);
      expect(result.stickY).toBe(0);
      expect(result.magnitude).toBe(0);
      expect(result.visualX).toBe(0);
      expect(result.visualY).toBe(0);
    });
  });

  describe('calculateDPadMask', () => {
    it('returns 0 when within central deadzone', () => {
      expect(calculateDPadMask(2, 2, 10)).toBe(0);
    });

    it('correctly identifies cardinal directions', () => {
      expect(calculateDPadMask(0, -30, 10)).toBe(GamepadButtonMask.DPAD_UP);
      expect(calculateDPadMask(0, 30, 10)).toBe(GamepadButtonMask.DPAD_DOWN);
      expect(calculateDPadMask(-30, 0, 10)).toBe(GamepadButtonMask.DPAD_LEFT);
      expect(calculateDPadMask(30, 0, 10)).toBe(GamepadButtonMask.DPAD_RIGHT);
    });

    it('correctly identifies diagonal 8-way directions', () => {
      // Up-Right
      expect(calculateDPadMask(25, -25, 10)).toBe(
        GamepadButtonMask.DPAD_UP | GamepadButtonMask.DPAD_RIGHT
      );
      // Down-Right
      expect(calculateDPadMask(25, 25, 10)).toBe(
        GamepadButtonMask.DPAD_DOWN | GamepadButtonMask.DPAD_RIGHT
      );
      // Down-Left
      expect(calculateDPadMask(-25, 25, 10)).toBe(
        GamepadButtonMask.DPAD_DOWN | GamepadButtonMask.DPAD_LEFT
      );
      // Up-Left
      expect(calculateDPadMask(-25, -25, 10)).toBe(
        GamepadButtonMask.DPAD_UP | GamepadButtonMask.DPAD_LEFT
      );
    });
  });
});
