import { describe, it, expect } from 'vitest';
import {
  HidKey,
  ModifierMask,
  DOM_CODE_TO_HID,
  charToHid,
  buildModifierMask,
} from '../features/keyboard/HidKeyMapper';

describe('HidKeyMapper', () => {
  it('correctly maps standard DOM codes to USB HID Usage IDs', () => {
    expect(DOM_CODE_TO_HID['KeyA']).toBe(HidKey.A);
    expect(DOM_CODE_TO_HID['KeyZ']).toBe(HidKey.Z);
    expect(DOM_CODE_TO_HID['Digit1']).toBe(HidKey.DIGIT_1);
    expect(DOM_CODE_TO_HID['Digit0']).toBe(HidKey.DIGIT_0);
    expect(DOM_CODE_TO_HID['Enter']).toBe(HidKey.ENTER);
    expect(DOM_CODE_TO_HID['Escape']).toBe(HidKey.ESCAPE);
    expect(DOM_CODE_TO_HID['Backspace']).toBe(HidKey.BACKSPACE);
    expect(DOM_CODE_TO_HID['Tab']).toBe(HidKey.TAB);
    expect(DOM_CODE_TO_HID['Space']).toBe(HidKey.SPACE);
    expect(DOM_CODE_TO_HID['F1']).toBe(HidKey.F1);
    expect(DOM_CODE_TO_HID['F12']).toBe(HidKey.F12);
    expect(DOM_CODE_TO_HID['ArrowUp']).toBe(HidKey.ARROW_UP);
    expect(DOM_CODE_TO_HID['ArrowDown']).toBe(HidKey.ARROW_DOWN);
    expect(DOM_CODE_TO_HID['ControlLeft']).toBe(HidKey.CONTROL_LEFT);
    expect(DOM_CODE_TO_HID['MetaLeft']).toBe(HidKey.META_LEFT);
  });

  it('translates characters to USB HID codes and shift requirements', () => {
    // Lowercase letter
    const a = charToHid('a');
    expect(a).toEqual({ hidCode: HidKey.A, shift: false });

    // Uppercase letter (requires shift)
    const capB = charToHid('B');
    expect(capB).toEqual({ hidCode: HidKey.B, shift: true });

    // Number
    const five = charToHid('5');
    expect(five).toEqual({ hidCode: HidKey.DIGIT_5, shift: false });

    // Shifted symbol (e.g. '!' is Shift + '1')
    const exclamation = charToHid('!');
    expect(exclamation).toEqual({ hidCode: HidKey.DIGIT_1, shift: true });

    // Space & Enter
    expect(charToHid(' ')).toEqual({ hidCode: HidKey.SPACE, shift: false });
    expect(charToHid('\n')).toEqual({ hidCode: HidKey.ENTER, shift: false });
  });

  it('builds accurate modifier bitmasks', () => {
    expect(buildModifierMask(false, false, false, false)).toBe(ModifierMask.NONE);
    expect(buildModifierMask(true, false, false, false)).toBe(ModifierMask.CTRL);
    expect(buildModifierMask(false, true, false, false)).toBe(ModifierMask.SHIFT);
    expect(buildModifierMask(false, false, true, false)).toBe(ModifierMask.ALT);
    expect(buildModifierMask(false, false, false, true)).toBe(ModifierMask.META);

    // Combination (Ctrl + Alt + Shift)
    const combined = buildModifierMask(true, true, true, false);
    expect(combined).toBe(ModifierMask.CTRL | ModifierMask.SHIFT | ModifierMask.ALT);
  });
});
