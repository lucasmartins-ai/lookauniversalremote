/**
 * Canonical protocol constants, offsets, and bitmasks for LookARemote Binary Protocol v1.
 */

/** Fixed protocol version byte. */
export const PROTOCOL_VERSION = 0x01;

/** Fixed base header size in bytes. */
export const HEADER_SIZE = 5;

/** Maximum stack/pre-allocated buffer size for any single protocol frame. */
export const MAX_PACKET_SIZE = 48;

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
  SLOT_ASSIGNMENT: 0x0B,
  TV_COMMAND: 0x0C,
  TV_TEXT_INPUT: 0x0D,
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
  SLOT_ASSIGNMENT: {
    PAYLOAD: 20,
    TOTAL: 25,
  },
  TV_COMMAND: {
    PAYLOAD: 4,
    TOTAL: 9,
  },
  TV_TEXT_INPUT: {
    PAYLOAD: 32,
    TOTAL: 37,
  },
} as const;

/**
 * Player color definitions for Multi-Controller Party Mode.
 */
export const PlayerColor = {
  P1_CYAN: '#00E5FF',
  P2_MAGENTA: '#FF007F',
  P3_YELLOW: '#FFE600',
  P4_GREEN: '#00FF66',
} as const;

export const PLAYER_COLORS = [
  PlayerColor.P1_CYAN,
  PlayerColor.P2_MAGENTA,
  PlayerColor.P3_YELLOW,
  PlayerColor.P4_GREEN,
] as const;

export const PLAYER_RGB565 = {
  P1_CYAN: 0x073F,
  P2_MAGENTA: 0xF80F,
  P3_YELLOW: 0xFFE0,
  P4_GREEN: 0x07EC,
} as const;

/**
 * Target control mode identifiers for MSG_MODE_SWITCH (0x07).
 */
export const TargetMode = {
  GAMEPAD: 0,
  TRACKPAD: 1,
  KEYBOARD: 2,
  MEDIA_REMOTE: 3,
  TV_REMOTE: 4,
  AIR_MOUSE: 5,
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
 * Universal Smart TV Command Codes for MSG_TV_COMMAND (0x0C).
 */
export const TvCommand = {
  POWER: 1,
  HOME: 2,
  MENU_SETTINGS: 3,
  SOURCE_INPUT: 4,
  VOLUME_UP: 5,
  VOLUME_DOWN: 6,
  MUTE: 7,
  CHANNEL_UP: 8,
  CHANNEL_DOWN: 9,
  PREV_CHANNEL: 10,
  GUIDE_EPG: 11,
  INFO: 12,
  DPAD_UP: 13,
  DPAD_DOWN: 14,
  DPAD_LEFT: 15,
  DPAD_RIGHT: 16,
  OK_ENTER: 17,
  BACK: 18,
  EXIT: 19,
  DIGIT_0: 20,
  DIGIT_1: 21,
  DIGIT_2: 22,
  DIGIT_3: 23,
  DIGIT_4: 24,
  DIGIT_5: 25,
  DIGIT_6: 26,
  DIGIT_7: 27,
  DIGIT_8: 28,
  DIGIT_9: 29,
  COLOR_RED: 30,
  COLOR_GREEN: 31,
  COLOR_YELLOW: 32,
  COLOR_BLUE: 33,
  APP_NETFLIX: 34,
  APP_YOUTUBE: 35,
  APP_PRIME: 36,
  APP_DISNEY: 37,
  APP_SPOTIFY: 38,
  APP_BROWSER: 39,
  MEDIA_PLAY_PAUSE: 40,
  MEDIA_REWIND: 41,
  MEDIA_FAST_FORWARD: 42,
  MEDIA_STOP: 43,
} as const;

export type TvCommandValue = (typeof TvCommand)[keyof typeof TvCommand];

/**
 * Target device types for smart routing.
 */
export const TargetDeviceType = {
  GENERIC_TV: 0,
  SAMSUNG_TIZEN: 1,
  LG_WEBOS: 2,
  ANDROID_GOOGLE_TV: 3,
  ROKU_TV: 4,
  SONY_BRAVIA: 5,
  APPLE_TV: 6,
  DESKTOP_PC_MAC: 7,
  CONSOLE: 8,
} as const;

export type TargetDeviceTypeValue = (typeof TargetDeviceType)[keyof typeof TargetDeviceType];

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
  SOUTH: 1 << 4,
  EAST: 1 << 5,
  WEST: 1 << 6,
  NORTH: 1 << 7,
  SHOULDER_L: 1 << 8,
  SHOULDER_R: 1 << 9,
  THUMB_L: 1 << 10,
  THUMB_R: 1 << 11,
  START: 1 << 12,
  SELECT: 1 << 13,
} as const;

export const GamepadButtonBit = GamepadButtonMask;

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
