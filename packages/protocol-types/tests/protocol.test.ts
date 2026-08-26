import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  decodePacket,
  ProtocolEncoder,
  ProtocolDecoder,
  ProtocolError,
  SequenceTracker,
  SequenceGenerator,
  isValidSequenceAdvance,
  GamepadButtonMask,
  TouchpadButtonMask,
  KeyboardModifierMask,
  TargetMode,
  ModeSwitchFlags,
  MessageSize,
  MessageType,
  HEADER_SIZE,
} from '../src/index.js';

interface GoldenVector {
  name: string;
  hex: string;
  header: {
    version: number;
    type: number;
    flags: number;
    sequence: number;
  };
  payload: Record<string, any>;
}

interface GoldenFile {
  vectors: GoldenVector[];
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Protocol v1 Codec & Types', () => {
  const goldenPath = path.resolve(__dirname, '../../protocol/tests/golden_vectors.json');
  const goldenContent = fs.readFileSync(goldenPath, 'utf8');
  const golden: GoldenFile = JSON.parse(goldenContent);
  const encoder = new ProtocolEncoder();
  const decoder = new ProtocolDecoder();

  describe('Golden Vectors Parity & Cross-Language Validation', () => {
    it.each(golden.vectors)('validates vector "$name"', (vec) => {
      const rawBytes = hexToBytes(vec.hex);

      // 1. Decode raw bytes
      const packet = decoder.decode(rawBytes);

      // 2. Validate header
      expect(packet.header.version).toBe(vec.header.version);
      expect(packet.header.type).toBe(vec.header.type);
      expect(packet.header.flags).toBe(vec.header.flags);
      expect(packet.header.sequence).toBe(vec.header.sequence);

      // 3. Validate payload fields
      const p = packet.payload;
      expect(p.type).toBe(vec.payload.type);

      switch (p.type) {
        case 'motion':
          expect(p.gyroYaw).toBe(vec.payload.gyro_yaw);
          expect(p.gyroPitch).toBe(vec.payload.gyro_pitch);
          expect(p.gyroRoll).toBe(vec.payload.gyro_roll);
          expect(p.accelX).toBe(vec.payload.accel_x);
          expect(p.accelY).toBe(vec.payload.accel_y);
          expect(p.accelZ).toBe(vec.payload.accel_z);
          expect(p.timestampUs).toBe(vec.payload.timestamp_us);
          break;

        case 'gamepad_full':
          expect(p.buttons).toBe(vec.payload.buttons);
          expect(p.stickLx).toBe(vec.payload.stick_lx);
          expect(p.stickLy).toBe(vec.payload.stick_ly);
          expect(p.stickRx).toBe(vec.payload.stick_rx);
          expect(p.stickRy).toBe(vec.payload.stick_ry);
          expect(p.triggerL).toBe(vec.payload.trigger_l);
          expect(p.triggerR).toBe(vec.payload.trigger_r);
          expect(p.reserved).toBe(vec.payload.reserved);
          break;

        case 'touchpad':
          expect(p.dx).toBe(vec.payload.dx);
          expect(p.dy).toBe(vec.payload.dy);
          expect(p.scrollV).toBe(vec.payload.scroll_v);
          expect(p.scrollH).toBe(vec.payload.scroll_h);
          expect(p.buttonsMask).toBe(vec.payload.buttons_mask);
          break;

        case 'keyboard':
          expect(p.keyCode).toBe(vec.payload.key_code);
          expect(p.state).toBe(vec.payload.state);
          expect(p.modifiers).toBe(vec.payload.modifiers);
          break;

        case 'media':
          expect(p.mediaAction).toBe(vec.payload.media_action);
          expect(p.reserved).toBe(vec.payload.reserved);
          break;

        case 'heartbeat':
          expect(p.clientEpochMs).toBe(vec.payload.client_epoch_ms);
          expect(p.echoToken).toBe(vec.payload.echo_token);
          break;

        case 'haptic':
          expect(p.motorIndex).toBe(vec.payload.motor_index);
          expect(p.intensity).toBe(vec.payload.intensity);
          expect(p.durationMs).toBe(vec.payload.duration_ms);
          break;
      }

      // 4. Re-encode and verify 100% byte parity with golden hex
      const encoded = encoder.encode(packet);
      const encodedHex = bytesToHex(encoded);
      expect(encodedHex).toBe(vec.hex);
    });
  });

  describe('Error Handling & Boundary Validation', () => {
    it('throws on buffer shorter than header size', () => {
      expect(() => decodePacket(new Uint8Array([]))).toThrowError(ProtocolError);
      expect(() => decodePacket(new Uint8Array([0x01, 0x01, 0x00]))).toThrowError(
        /Buffer too short/
      );
    });

    it('throws on invalid protocol version', () => {
      const badVersion = new Uint8Array([0x02, 0x01, 0x00, 0x01, 0x00, 0x00]);
      expect(() => decodePacket(badVersion)).toThrowError(/Invalid protocol version/);
    });

    it('throws on unknown message type', () => {
      const badType = new Uint8Array([0x01, 0xff, 0x00, 0x01, 0x00]);
      expect(() => decodePacket(badType)).toThrowError(/Unknown or unsupported/);
    });

    it('throws on invalid payload length or trailing garbage', () => {
      // MSG_MEDIA requires exactly 7 bytes
      const truncatedMedia = new Uint8Array([0x01, 0x06, 0x00, 0x01, 0x00]);
      expect(() => decodePacket(truncatedMedia)).toThrowError(/Invalid frame size for MSG_MEDIA/);

      const oversizedMedia = new Uint8Array([0x01, 0x06, 0x00, 0x01, 0x00, 0x01, 0x00, 0x99]);
      expect(() => decodePacket(oversizedMedia)).toThrowError(/Invalid frame size for MSG_MEDIA/);
    });
  });

  describe('Sequence Tracking & Wraparound', () => {
    it('validates modular sequence arithmetic', () => {
      expect(isValidSequenceAdvance(10, 11)).toBe(true);
      expect(isValidSequenceAdvance(10, 10)).toBe(false);
      expect(isValidSequenceAdvance(10, 9)).toBe(false);

      // Wraparound 65535 -> 0, 1
      expect(isValidSequenceAdvance(65535, 0)).toBe(true);
      expect(isValidSequenceAdvance(65535, 1)).toBe(true);
      expect(isValidSequenceAdvance(0, 65535)).toBe(false);

      // Boundary condition: exactly 32768 jump is rejected
      expect(isValidSequenceAdvance(20000, 20000 + 32768)).toBe(false);
      expect(isValidSequenceAdvance(20000, 20000 + 32767)).toBe(true);
    });

    it('SequenceTracker filters out-of-order and duplicates correctly', () => {
      const tracker = new SequenceTracker();
      expect(tracker.latest).toBeNull();

      // Initial packet
      expect(tracker.checkAndUpdate(100)).toBe(true);
      expect(tracker.latest).toBe(100);

      // In order
      expect(tracker.checkAndUpdate(101)).toBe(true);
      expect(tracker.checkAndUpdate(150)).toBe(true);
      expect(tracker.latest).toBe(150);

      // Duplicate
      expect(tracker.checkAndUpdate(150)).toBe(false);

      // Late / out-of-order
      expect(tracker.checkAndUpdate(149)).toBe(false);
      expect(tracker.checkAndUpdate(50)).toBe(false);

      // Valid forward jumps
      expect(tracker.checkAndUpdate(20000)).toBe(true);
      expect(tracker.checkAndUpdate(50000)).toBe(true);
      expect(tracker.checkAndUpdate(65535)).toBe(true);

      // Wraparound to 0
      expect(tracker.checkAndUpdate(0)).toBe(true);
      expect(tracker.latest).toBe(0);

      // Advance past wrap
      expect(tracker.checkAndUpdate(5)).toBe(true);
      expect(tracker.latest).toBe(5);

      // Old sequence before rollover is rejected
      expect(tracker.checkAndUpdate(65535)).toBe(false);

      // Reset
      tracker.reset();
      expect(tracker.latest).toBeNull();
      expect(tracker.checkAndUpdate(42)).toBe(true);
      expect(tracker.latest).toBe(42);
    });

    it('SequenceGenerator increments monotonically and wraps at 65535', () => {
      const gen = new SequenceGenerator();
      expect(gen.current).toBe(1);
      expect(gen.next()).toBe(1);
      expect(gen.next()).toBe(2);
      expect(gen.current).toBe(3);

      const wrapGen = new SequenceGenerator(65535);
      expect(wrapGen.next()).toBe(65535);
      expect(wrapGen.next()).toBe(0);
      expect(wrapGen.next()).toBe(1);
    });
  });

  describe('Bitmasks & Constants', () => {
    it('verifies gamepad and modifier bitmasks', () => {
      const btnSouthAndUp = GamepadButtonMask.BTN_SOUTH | GamepadButtonMask.DPAD_UP;
      expect((btnSouthAndUp & GamepadButtonMask.BTN_SOUTH) !== 0).toBe(true);
      expect((btnSouthAndUp & GamepadButtonMask.DPAD_UP) !== 0).toBe(true);
      expect((btnSouthAndUp & GamepadButtonMask.BTN_NORTH) !== 0).toBe(false);

      const tapAndLeft = TouchpadButtonMask.BTN_LEFT | TouchpadButtonMask.TAP_CLICK;
      expect((tapAndLeft & TouchpadButtonMask.BTN_LEFT) !== 0).toBe(true);
      expect((tapAndLeft & TouchpadButtonMask.TAP_CLICK) !== 0).toBe(true);
      expect((tapAndLeft & TouchpadButtonMask.BTN_RIGHT) !== 0).toBe(false);

      const ctrlAlt = KeyboardModifierMask.CTRL | KeyboardModifierMask.ALT;
      expect((ctrlAlt & KeyboardModifierMask.CTRL) !== 0).toBe(true);
      expect((ctrlAlt & KeyboardModifierMask.ALT) !== 0).toBe(true);
      expect((ctrlAlt & KeyboardModifierMask.SHIFT) !== 0).toBe(false);
    });

    it('verifies TargetMode and ModeSwitchFlags constants', () => {
      expect(TargetMode.GAMEPAD).toBe(0);
      expect(TargetMode.TRACKPAD).toBe(1);
      expect(TargetMode.KEYBOARD).toBe(2);
      expect(TargetMode.MEDIA_REMOTE).toBe(3);

      expect(ModeSwitchFlags.NONE).toBe(0x00);
      expect(ModeSwitchFlags.IS_MANUAL_OVERRIDE).toBe(0x01);
      expect(ModeSwitchFlags.IS_ENFORCED_BY_HOST).toBe(0x02);
    });

    it('encodes and decodes MSG_MODE_SWITCH correctly', () => {
      const flags = ModeSwitchFlags.IS_MANUAL_OVERRIDE | ModeSwitchFlags.IS_ENFORCED_BY_HOST;
      const encoded = encoder.encodeModeSwitch(77, 0, {
        targetMode: TargetMode.KEYBOARD,
        flags,
      });

      expect(encoded.byteLength).toBe(MessageSize.MODE_SWITCH.TOTAL);
      expect(encoded.byteLength).toBe(7);

      const decoded = decoder.decode(encoded);
      expect(decoded.header.type).toBe(MessageType.MODE_SWITCH);
      expect(decoded.header.sequence).toBe(77);
      expect(decoded.payload.type).toBe('mode_switch');
      if (decoded.payload.type === 'mode_switch') {
        expect(decoded.payload.targetMode).toBe(TargetMode.KEYBOARD);
        expect(decoded.payload.flags).toBe(0x03);
      }
    });
  });
});
