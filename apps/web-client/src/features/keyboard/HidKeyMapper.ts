/**
 * USB HID Usage Table (Page 0x07 - Keyboard/Keypad Page) and DOM event translation.
 * Maps KeyboardEvent.code and character strings to 16-bit USB HID usage IDs and modifier bitmasks.
 */

export const HidKey = {
  // Letters A-Z (0x04 - 0x1D)
  A: 0x04,
  B: 0x05,
  C: 0x06,
  D: 0x07,
  E: 0x08,
  F: 0x09,
  G: 0x0a,
  H: 0x0b,
  I: 0x0c,
  J: 0x0d,
  K: 0x0e,
  L: 0x0f,
  M: 0x10,
  N: 0x11,
  O: 0x12,
  P: 0x13,
  Q: 0x14,
  R: 0x15,
  S: 0x16,
  T: 0x17,
  U: 0x18,
  V: 0x19,
  W: 0x1a,
  X: 0x1b,
  Y: 0x1c,
  Z: 0x1d,

  // Numbers 1-0 (0x1E - 0x27)
  DIGIT_1: 0x1e,
  DIGIT_2: 0x1f,
  DIGIT_3: 0x20,
  DIGIT_4: 0x21,
  DIGIT_5: 0x22,
  DIGIT_6: 0x23,
  DIGIT_7: 0x24,
  DIGIT_8: 0x25,
  DIGIT_9: 0x26,
  DIGIT_0: 0x27,

  // Common Control & Action Keys
  ENTER: 0x28,
  ESCAPE: 0x29,
  BACKSPACE: 0x2a,
  TAB: 0x2b,
  SPACE: 0x2c,
  MINUS: 0x2d,
  EQUAL: 0x2e,
  BRACKET_LEFT: 0x2f,
  BRACKET_RIGHT: 0x30,
  BACKSLASH: 0x31,
  SEMICOLON: 0x33,
  QUOTE: 0x34,
  GRAVE: 0x35,
  COMMA: 0x36,
  PERIOD: 0x37,
  SLASH: 0x38,
  CAPS_LOCK: 0x39,

  // Function Keys F1-F12 (0x3A - 0x45)
  F1: 0x3a,
  F2: 0x3b,
  F3: 0x3c,
  F4: 0x3d,
  F5: 0x3e,
  F6: 0x3f,
  F7: 0x40,
  F8: 0x41,
  F9: 0x42,
  F10: 0x43,
  F11: 0x44,
  F12: 0x45,

  // Navigation & Editing Keys
  PRINT_SCREEN: 0x46,
  SCROLL_LOCK: 0x47,
  PAUSE: 0x48,
  INSERT: 0x49,
  HOME: 0x4a,
  PAGE_UP: 0x4b,
  DELETE: 0x4c,
  END: 0x4d,
  PAGE_DOWN: 0x4e,
  ARROW_RIGHT: 0x4f,
  ARROW_LEFT: 0x50,
  ARROW_DOWN: 0x51,
  ARROW_UP: 0x52,

  // Modifiers (0xE0 - 0xE7)
  CONTROL_LEFT: 0xe0,
  SHIFT_LEFT: 0xe1,
  ALT_LEFT: 0xe2,
  META_LEFT: 0xe3,
  CONTROL_RIGHT: 0xe4,
  SHIFT_RIGHT: 0xe5,
  ALT_RIGHT: 0xe6,
  META_RIGHT: 0xe7,
} as const;

/**
 * Modifier Bitmask Flags
 */
export const ModifierMask = {
  NONE: 0x00,
  CTRL: 0x01,
  SHIFT: 0x02,
  ALT: 0x04,
  META: 0x08,
} as const;

/**
 * Maps DOM KeyboardEvent.code string to USB HID Usage ID.
 */
export const DOM_CODE_TO_HID: Record<string, number> = {
  KeyA: HidKey.A,
  KeyB: HidKey.B,
  KeyC: HidKey.C,
  KeyD: HidKey.D,
  KeyE: HidKey.E,
  KeyF: HidKey.F,
  KeyG: HidKey.G,
  KeyH: HidKey.H,
  KeyI: HidKey.I,
  KeyJ: HidKey.J,
  KeyK: HidKey.K,
  KeyL: HidKey.L,
  KeyM: HidKey.M,
  KeyN: HidKey.N,
  KeyO: HidKey.O,
  KeyP: HidKey.P,
  KeyQ: HidKey.Q,
  KeyR: HidKey.R,
  KeyS: HidKey.S,
  KeyT: HidKey.T,
  KeyU: HidKey.U,
  KeyV: HidKey.V,
  KeyW: HidKey.W,
  KeyX: HidKey.X,
  KeyY: HidKey.Y,
  KeyZ: HidKey.Z,

  Digit1: HidKey.DIGIT_1,
  Digit2: HidKey.DIGIT_2,
  Digit3: HidKey.DIGIT_3,
  Digit4: HidKey.DIGIT_4,
  Digit5: HidKey.DIGIT_5,
  Digit6: HidKey.DIGIT_6,
  Digit7: HidKey.DIGIT_7,
  Digit8: HidKey.DIGIT_8,
  Digit9: HidKey.DIGIT_9,
  Digit0: HidKey.DIGIT_0,

  Enter: HidKey.ENTER,
  Escape: HidKey.ESCAPE,
  Backspace: HidKey.BACKSPACE,
  Tab: HidKey.TAB,
  Space: HidKey.SPACE,
  Minus: HidKey.MINUS,
  Equal: HidKey.EQUAL,
  BracketLeft: HidKey.BRACKET_LEFT,
  BracketRight: HidKey.BRACKET_RIGHT,
  Backslash: HidKey.BACKSLASH,
  Semicolon: HidKey.SEMICOLON,
  Quote: HidKey.QUOTE,
  Backquote: HidKey.GRAVE,
  Comma: HidKey.COMMA,
  Period: HidKey.PERIOD,
  Slash: HidKey.SLASH,
  CapsLock: HidKey.CAPS_LOCK,

  F1: HidKey.F1,
  F2: HidKey.F2,
  F3: HidKey.F3,
  F4: HidKey.F4,
  F5: HidKey.F5,
  F6: HidKey.F6,
  F7: HidKey.F7,
  F8: HidKey.F8,
  F9: HidKey.F9,
  F10: HidKey.F10,
  F11: HidKey.F11,
  F12: HidKey.F12,

  PrintScreen: HidKey.PRINT_SCREEN,
  ScrollLock: HidKey.SCROLL_LOCK,
  Pause: HidKey.PAUSE,
  Insert: HidKey.INSERT,
  Home: HidKey.HOME,
  PageUp: HidKey.PAGE_UP,
  Delete: HidKey.DELETE,
  End: HidKey.END,
  PageDown: HidKey.PAGE_DOWN,
  ArrowRight: HidKey.ARROW_RIGHT,
  ArrowLeft: HidKey.ARROW_LEFT,
  ArrowDown: HidKey.ARROW_DOWN,
  ArrowUp: HidKey.ARROW_UP,

  ControlLeft: HidKey.CONTROL_LEFT,
  ShiftLeft: HidKey.SHIFT_LEFT,
  AltLeft: HidKey.ALT_LEFT,
  MetaLeft: HidKey.META_LEFT,
  ControlRight: HidKey.CONTROL_RIGHT,
  ShiftRight: HidKey.SHIFT_RIGHT,
  AltRight: HidKey.ALT_RIGHT,
  MetaRight: HidKey.META_RIGHT,
};

/**
 * Character to USB HID mapping with shifted flag.
 */
export function charToHid(char: string): { hidCode: number; shift: boolean } | null {
  if (!char || char.length === 0) return null;

  // Uppercase letters A-Z
  if (char >= 'A' && char <= 'Z') {
    const code = HidKey.A + (char.charCodeAt(0) - 65);
    return { hidCode: code, shift: true };
  }

  // Lowercase letters a-z
  if (char >= 'a' && char <= 'z') {
    const code = HidKey.A + (char.charCodeAt(0) - 97);
    return { hidCode: code, shift: false };
  }

  // Digits 1-9
  if (char >= '1' && char <= '9') {
    const code = HidKey.DIGIT_1 + (char.charCodeAt(0) - 49);
    return { hidCode: code, shift: false };
  }
  if (char === '0') {
    return { hidCode: HidKey.DIGIT_0, shift: false };
  }

  // Whitespace & basic controls
  if (char === ' ') return { hidCode: HidKey.SPACE, shift: false };
  if (char === '\n' || char === '\r') return { hidCode: HidKey.ENTER, shift: false };
  if (char === '\t') return { hidCode: HidKey.TAB, shift: false };

  // Common symbols (un-shifted and shifted on standard US layout)
  const symbolMap: Record<string, { hidCode: number; shift: boolean }> = {
    '-': { hidCode: HidKey.MINUS, shift: false },
    '_': { hidCode: HidKey.MINUS, shift: true },
    '=': { hidCode: HidKey.EQUAL, shift: false },
    '+': { hidCode: HidKey.EQUAL, shift: true },
    '[': { hidCode: HidKey.BRACKET_LEFT, shift: false },
    '{': { hidCode: HidKey.BRACKET_LEFT, shift: true },
    ']': { hidCode: HidKey.BRACKET_RIGHT, shift: false },
    '}': { hidCode: HidKey.BRACKET_RIGHT, shift: true },
    '\\': { hidCode: HidKey.BACKSLASH, shift: false },
    '|': { hidCode: HidKey.BACKSLASH, shift: true },
    ';': { hidCode: HidKey.SEMICOLON, shift: false },
    ':': { hidCode: HidKey.SEMICOLON, shift: true },
    "'": { hidCode: HidKey.QUOTE, shift: false },
    '"': { hidCode: HidKey.QUOTE, shift: true },
    '`': { hidCode: HidKey.GRAVE, shift: false },
    '~': { hidCode: HidKey.GRAVE, shift: true },
    ',': { hidCode: HidKey.COMMA, shift: false },
    '<': { hidCode: HidKey.COMMA, shift: true },
    '.': { hidCode: HidKey.PERIOD, shift: false },
    '>': { hidCode: HidKey.PERIOD, shift: true },
    '/': { hidCode: HidKey.SLASH, shift: false },
    '?': { hidCode: HidKey.SLASH, shift: true },
    '!': { hidCode: HidKey.DIGIT_1, shift: true },
    '@': { hidCode: HidKey.DIGIT_2, shift: true },
    '#': { hidCode: HidKey.DIGIT_3, shift: true },
    '$': { hidCode: HidKey.DIGIT_4, shift: true },
    '%': { hidCode: HidKey.DIGIT_5, shift: true },
    '^': { hidCode: HidKey.DIGIT_6, shift: true },
    '&': { hidCode: HidKey.DIGIT_7, shift: true },
    '*': { hidCode: HidKey.DIGIT_8, shift: true },
    '(': { hidCode: HidKey.DIGIT_9, shift: true },
    ')': { hidCode: HidKey.DIGIT_0, shift: true },
  };

  return symbolMap[char] || null;
}

/**
 * Builds an 8-bit modifier mask from boolean states.
 */
export function buildModifierMask(ctrl = false, shift = false, alt = false, meta = false): number {
  let mask = 0;
  if (ctrl) mask |= ModifierMask.CTRL;
  if (shift) mask |= ModifierMask.SHIFT;
  if (alt) mask |= ModifierMask.ALT;
  if (meta) mask |= ModifierMask.META;
  return mask;
}
