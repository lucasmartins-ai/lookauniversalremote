/**
 * Canonical protocol constants, offsets, and bitmasks for LookARemote Binary Protocol v1.
 */

/** Fixed protocol version byte. */
export const PROTOCOL_VERSION = 0x01;

/** Fixed base header size in bytes. */
export const HEADER_SIZE = 5;

/** Maximum stack/pre-allocated buffer size for any single protocol frame. */
export const MAX_PACKET_SIZE = 32;

/**
 * Message Type identifiers.
 */
export const MessageType = {
  MOTION: 0x01,
  GAMEPAD_FULL: 0x02,
  GAMEPAD_DELTA: 0x03,
  TOUCHPAD: 0x04,
  KEYBOARD: 0x05,
  MEDIA: 0x06,
  MODE_SWITCH: 0x07,
  HEARTBEAT: 0x08,
  ACK: 0x09,
  HAPTIC_EVENT: 0x0A,
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

/**
 * Header flag bitmask constants.
 */
export const HeaderFlags = {
  NONE: 0x00,
  NEEDS_ACK: 0x01,
  EMERGENCY_RESET: 0x02,
} as const;

/**
 * Exact payload and total frame sizes in bytes for each message type.
 */
export const MessageSize = {
  MOTION: {
    PAYLOAD: 16,
    TOTAL: 21,
  },
  GAMEPAD_FULL: {
    PAYLOAD: 14,
    TOTAL: 19,
  },
  TOUCHPAD: {
    PAYLOAD: 7,
    TOTAL: 12,
  },
  KEYBOARD: {
    PAYLOAD: 4,
    TOTAL: 9,
  },
  MEDIA: {
    PAYLOAD: 2,
    TOTAL: 7,
  },
  MODE_SWITCH: {
    PAYLOAD: 2,
    TOTAL: 7,
  },
  HEARTBEAT: {
    PAYLOAD: 8,
    TOTAL: 13,
  },
  HAPTIC_EVENT: {
    PAYLOAD: 4,
    TOTAL: 9,
  },
} as const;

/**
 * Target control mode identifiers for MSG_MODE_SWITCH (0x07).
 */
export const TargetMode = {
  GAMEPAD: 0,
  TRACKPAD: 1,
  KEYBOARD: 2,
  MEDIA_REMOTE: 3,
} as const;

export type TargetModeValue = (typeof TargetMode)[keyof typeof TargetMode];

/**
 * Mode switch bitmask flags for MSG_MODE_SWITCH (0x07).
 */
export const ModeSwitchFlags = {
  NONE: 0x00,
  IS_MANUAL_OVERRIDE: 0x01,
  IS_ENFORCED_BY_HOST: 0x02,
} as const;

export type ModeSwitchFlagsValue = (typeof ModeSwitchFlags)[keyof typeof ModeSwitchFlags];

/**
 * Standard Gamepad button bitmask flags (16-bit unsigned).
 */
export const GamepadButtonMask = {
  DPAD_UP: 1 << 0,     // 0x0001
  DPAD_DOWN: 1 << 1,   // 0x0002
  DPAD_LEFT: 1 << 2,   // 0x0004
  DPAD_RIGHT: 1 << 3,  // 0x0008
  BTN_SOUTH: 1 << 4,   // 0x0010 (A / Cross)
  BTN_EAST: 1 << 5,    // 0x0020 (B / Circle)
  BTN_WEST: 1 << 6,    // 0x0040 (X / Square)
  BTN_NORTH: 1 << 7,   // 0x0080 (Y / Triangle)
  BTN_L1: 1 << 8,      // 0x0100 (Left Bumper)
  BTN_R1: 1 << 9,      // 0x0200 (Right Bumper)
  BTN_L3: 1 << 10,     // 0x0400 (Left Stick Click)
  BTN_R3: 1 << 11,     // 0x0800 (Right Stick Click)
  BTN_START: 1 << 12,  // 0x1000
  BTN_SELECT: 1 << 13, // 0x2000
  BTN_GUIDE: 1 << 14,  // 0x4000 (Home / Guide)
  RESERVED: 1 << 15,   // 0x8000
} as const;

/**
 * Touchpad mouse buttons bitmask flags (8-bit unsigned).
 */
export const TouchpadButtonMask = {
  BTN_LEFT: 1 << 0,   // 0x01
  BTN_RIGHT: 1 << 1,  // 0x02
  BTN_MIDDLE: 1 << 2, // 0x04
  TAP_CLICK: 1 << 3,  // 0x08
} as const;

/**
 * Keyboard modifier bitmask flags (8-bit unsigned).
 */
export const KeyboardModifierMask = {
  CTRL: 1 << 0,  // 0x01
  SHIFT: 1 << 1, // 0x02
  ALT: 1 << 2,   // 0x04
  META: 1 << 3,  // 0x08 (Super/Command/Windows)
} as const;

/**
 * Key press state constants.
 */
export const KeyState = {
  KEY_UP: 0,
  KEY_DOWN: 1,
  KEY_REPEAT: 2,
} as const;

export type KeyStateValue = (typeof KeyState)[keyof typeof KeyState];

/**
 * Consumer media action codes.
 */
export const MediaAction = {
  PLAY_PAUSE: 1,
  STOP: 2,
  NEXT: 3,
  PREV: 4,
  VOL_UP: 5,
  VOL_DOWN: 6,
  MUTE: 7,
} as const;

export type MediaActionValue = (typeof MediaAction)[keyof typeof MediaAction];

/**
 * Haptic motor selection constants.
 */
export const HapticMotor = {
  LEFT: 0,
  RIGHT: 1,
  BOTH: 2,
} as const;

export type HapticMotorValue = (typeof HapticMotor)[keyof typeof HapticMotor];
