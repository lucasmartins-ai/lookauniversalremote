/**
 * Strong TypeScript types and interfaces for LookARemote Binary Protocol v1.
 */

import type {
  MessageTypeValue,
  KeyStateValue,
  MediaActionValue,
  HapticMotorValue,
  TargetModeValue,
} from './constants.js';

/**
 * 5-byte base header representation.
 */
export interface Header {
  /** Protocol version (must be 0x01). */
  version: number;
  /** Message type identifier. */
  type: MessageTypeValue;
  /** Flags bitfield (Bit 0: Needs ACK, Bit 1: Emergency Reset). */
  flags: number;
  /** Monotonically increasing sequence number (0 to 65535). */
  sequence: number;
}

/**
 * MSG_MOTION (0x01) — 16 bytes payload.
 */
export interface MotionPayload {
  type: 'motion';
  /** Yaw rate in rad/s * 1000 (-32768 to 32767). */
  gyroYaw: number;
  /** Pitch rate in rad/s * 1000 (-32768 to 32767). */
  gyroPitch: number;
  /** Roll rate in rad/s * 1000 (-32768 to 32767). */
  gyroRoll: number;
  /** Linear acceleration X in m/s^2 * 100 (-32768 to 32767). */
  accelX: number;
  /** Linear acceleration Y in m/s^2 * 100 (-32768 to 32767). */
  accelY: number;
  /** Linear acceleration Z in m/s^2 * 100 (-32768 to 32767). */
  accelZ: number;
  /** Client microsecond timestamp (32-bit unsigned). */
  timestampUs: number;
}

/**
 * MSG_GAMEPAD_FULL (0x02) — 14 bytes payload.
 */
export interface GamepadFullPayload {
  type: 'gamepad_full';
  /** 16-bit button bitmask. */
  buttons: number;
  /** Left stick X axis (-32768 to 32767). */
  stickLx: number;
  /** Left stick Y axis (-32768 to 32767). */
  stickLy: number;
  /** Right stick X axis (-32768 to 32767). */
  stickRx: number;
  /** Right stick Y axis (-32768 to 32767). */
  stickRy: number;
  /** Left analog trigger (0 to 255). */
  triggerL: number;
  /** Right analog trigger (0 to 255). */
  triggerR: number;
  /** Reserved alignment field (0x0000). */
  reserved?: number;
}

/**
 * MSG_TOUCHPAD (0x04) — 7 bytes payload.
 */
export interface TouchpadPayload {
  type: 'touchpad';
  /** Relative horizontal cursor delta in pixels (-32768 to 32767). */
  dx: number;
  /** Relative vertical cursor delta in pixels (-32768 to 32767). */
  dy: number;
  /** Vertical scroll wheel delta (-128 to 127). */
  scrollV: number;
  /** Horizontal scroll wheel delta (-128 to 127). */
  scrollH: number;
  /** Mouse buttons bitmask (Bit 0: Left, Bit 1: Right, Bit 2: Middle, Bit 3: Tap). */
  buttonsMask: number;
}

/**
 * MSG_KEYBOARD (0x05) — 4 bytes payload.
 */
export interface KeyboardPayload {
  type: 'keyboard';
  /** Standard USB HID Usage ID (16-bit unsigned). */
  keyCode: number;
  /** Key state (0 = Up, 1 = Down, 2 = Repeat). */
  state: KeyStateValue;
  /** Active modifiers bitmask (Ctrl, Shift, Alt, Meta). */
  modifiers: number;
}

/**
 * MSG_MEDIA (0x06) — 2 bytes payload.
 */
export interface MediaPayload {
  type: 'media';
  /** Consumer media action code. */
  mediaAction: MediaActionValue;
  /** Reserved alignment byte (0x00). */
  reserved?: number;
}

/**
 * MSG_MODE_SWITCH (0x07) — 2 bytes payload.
 */
export interface ModeSwitchPayload {
  type: 'mode_switch';
  /** Target control mode (0: Gamepad, 1: Trackpad, 2: Keyboard, 3: MediaRemote). */
  targetMode: TargetModeValue;
  /** Mode switch flags (Bit 0: IsManualOverride, Bit 1: IsEnforcedByHost). */
  flags: number;
}

/**
 * MSG_HEARTBEAT (0x08) — 8 bytes payload.
 */
export interface HeartbeatPayload {
  type: 'heartbeat';
  /** Client millisecond epoch timestamp. */
  clientEpochMs: number;
  /** Echo token echoed back for RTT measurement. */
  echoToken: number;
}

/**
 * MSG_HAPTIC_EVENT (0x0A) — 4 bytes payload.
 */
export interface HapticEventPayload {
  type: 'haptic';
  /** Motor index (0: Left, 1: Right, 2: Both). */
  motorIndex: HapticMotorValue;
  /** Intensity (0 to 255). */
  intensity: number;
  /** Vibration duration in milliseconds (16-bit unsigned). */
  durationMs: number;
}

/**
 * Union of all decoded payload types.
 */
export type MessagePayload =
  | MotionPayload
  | GamepadFullPayload
  | TouchpadPayload
  | KeyboardPayload
  | MediaPayload
  | ModeSwitchPayload
  | HeartbeatPayload
  | HapticEventPayload;

/**
 * Complete decoded packet structure.
 */
export interface Packet<T extends MessagePayload = MessagePayload> {
  header: Header;
  payload: T;
}
