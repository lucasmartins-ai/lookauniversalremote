import React, { useState, useRef } from 'react';
import { ProtocolBridge } from '../../transport/ProtocolBridge';
import {
  HidKey,
  ModifierMask,
  buildModifierMask,
  DOM_CODE_TO_HID,
  charToHid,
} from './HidKeyMapper';
import { KeyState } from '@lookaremote/protocol-types';
import { haptics } from '../../ui/haptics/hapticEngine';
import {
  CornerDownLeft,
  Delete,
  Space,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Keyboard as KeyboardIcon,
  Copy,
  ClipboardPaste,
  Undo2,
  Redo2,
  XSquare,
  Monitor,
} from 'lucide-react';

export interface KeyboardDeckProps {
  bridge: ProtocolBridge;
}

export const KeyboardDeck: React.FC<KeyboardDeckProps> = ({ bridge }) => {
  // Sticky Modifier States
  const [ctrlActive, setCtrlActive] = useState(false);
  const [shiftActive, setShiftActive] = useState(false);
  const [altActive, setAltActive] = useState(false);
  const [metaActive, setMetaActive] = useState(false);

  // Hidden text input ref for mobile native keyboard capture
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Current active modifier mask
  const activeModifiers = buildModifierMask(ctrlActive, shiftActive, altActive, metaActive);

  // Sends key tap (Down then Up)
  const sendKeyTap = (keyCode: number, additionalModifiers = 0) => {
    haptics.buttonClick();
    const finalModifiers = activeModifiers | additionalModifiers;

    // Send Key Down
    bridge.sendKeyboard({
      keyCode,
      state: KeyState.KEY_DOWN,
      modifiers: finalModifiers,
    });

    // Send Key Up after short delay
    setTimeout(() => {
      bridge.sendKeyboard({
        keyCode,
        state: KeyState.KEY_UP,
        modifiers: finalModifiers,
      });
    }, 40);
  };

  // Sends a key combination macro (e.g. Ctrl + C)
  const sendMacro = (keyCode: number, modifierBit: number) => {
    haptics.buttonClick();
    const finalModifiers = activeModifiers | modifierBit;

    bridge.sendKeyboard({
      keyCode,
      state: KeyState.KEY_DOWN,
      modifiers: finalModifiers,
    });

    setTimeout(() => {
      bridge.sendKeyboard({
        keyCode,
        state: KeyState.KEY_UP,
        modifiers: finalModifiers,
      });
    }, 50);
  };

  // Handle native typing from hidden input
  const handleKeyDownCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const hidCode = DOM_CODE_TO_HID[e.code];
    if (hidCode) {
      e.preventDefault();
      const eventModifiers = buildModifierMask(e.ctrlKey, e.shiftKey, e.altKey, e.metaKey);
      sendKeyTap(hidCode, eventModifiers);
    }
  };

  const handleInputCapture = (e: React.FormEvent<HTMLInputElement>) => {
    const inputElement = e.currentTarget;
    const value = inputElement.value;
    if (value.length > 0) {
      for (const char of value) {
        const mapping = charToHid(char);
        if (mapping) {
          const shiftModifier = mapping.shift ? ModifierMask.SHIFT : 0;
          sendKeyTap(mapping.hidCode, shiftModifier);
        }
      }
      inputElement.value = '';
    }
  };

  const toggleModifier = (
    type: 'ctrl' | 'shift' | 'alt' | 'meta',
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    current: boolean
  ) => {
    haptics.buttonClick();
    const newState = !current;
    setter(newState);

    // Send modifier key state to host
    let hidCode: number = HidKey.CONTROL_LEFT;
    let bit: number = ModifierMask.CTRL;
    if (type === 'shift') {
      hidCode = HidKey.SHIFT_LEFT;
      bit = ModifierMask.SHIFT;
    } else if (type === 'alt') {
      hidCode = HidKey.ALT_LEFT;
      bit = ModifierMask.ALT;
    } else if (type === 'meta') {
      hidCode = HidKey.META_LEFT;
      bit = ModifierMask.META;
    }

    bridge.sendKeyboard({
      keyCode: hidCode,
      state: newState ? KeyState.KEY_DOWN : KeyState.KEY_UP,
      modifiers: activeModifiers ^ bit,
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* 1. NATIVE KEYBOARD INPUT BRIDGE */}
      <div
        onClick={() => hiddenInputRef.current?.focus()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: isInputFocused ? 'rgba(0, 229, 255, 0.12)' : 'var(--color-surface-card)',
          border: `1px solid ${isInputFocused ? 'var(--color-neon-cyan)' : 'var(--color-border-accent)'}`,
          boxShadow: isInputFocused ? '0 0 16px var(--color-neon-cyan-glow)' : 'none',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <KeyboardIcon size={20} color={isInputFocused ? 'var(--color-neon-cyan)' : 'var(--color-text-secondary)'} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isInputFocused ? 'var(--color-neon-cyan)' : '#ffffff' }}>
              {isInputFocused ? 'SYSTEM KEYBOARD ACTIVE (TYPE ANYWHERE)' : 'TAP TO OPEN SYSTEM KEYBOARD'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Captures all smartphone IME typing, accents & unicode
            </div>
          </div>
        </div>

        {/* Hidden Input field for mobile soft keyboard capture */}
        <input
          ref={hiddenInputRef}
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          onKeyDown={handleKeyDownCapture}
          onInput={handleInputCapture}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: isInputFocused ? 'auto' : 'none',
            width: '1px',
            height: '1px',
          }}
        />

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            padding: '4px 8px',
            borderRadius: '6px',
            backgroundColor: isInputFocused ? 'var(--color-neon-cyan)' : 'rgba(255, 255, 255, 0.05)',
            color: isInputFocused ? '#000000' : 'var(--color-text-muted)',
            fontWeight: 700,
          }}
        >
          {isInputFocused ? 'FOCUSED' : 'TAP HERE'}
        </span>
      </div>

      {/* 2. STICKY MODIFIERS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        <button
          type="button"
          onClick={() => toggleModifier('ctrl', setCtrlActive, ctrlActive)}
          style={{
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: ctrlActive ? 'rgba(0, 229, 255, 0.2)' : 'var(--color-surface-card)',
            border: `1px solid ${ctrlActive ? 'var(--color-neon-cyan)' : 'var(--color-border-subtle)'}`,
            boxShadow: ctrlActive ? '0 0 12px var(--color-neon-cyan-glow)' : 'none',
            color: ctrlActive ? 'var(--color-neon-cyan)' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          CTRL {ctrlActive ? '●' : '○'}
        </button>

        <button
          type="button"
          onClick={() => toggleModifier('alt', setAltActive, altActive)}
          style={{
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: altActive ? 'rgba(0, 229, 255, 0.2)' : 'var(--color-surface-card)',
            border: `1px solid ${altActive ? 'var(--color-neon-cyan)' : 'var(--color-border-subtle)'}`,
            boxShadow: altActive ? '0 0 12px var(--color-neon-cyan-glow)' : 'none',
            color: altActive ? 'var(--color-neon-cyan)' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ALT {altActive ? '●' : '○'}
        </button>

        <button
          type="button"
          onClick={() => toggleModifier('shift', setShiftActive, shiftActive)}
          style={{
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: shiftActive ? 'rgba(0, 229, 255, 0.2)' : 'var(--color-surface-card)',
            border: `1px solid ${shiftActive ? 'var(--color-neon-cyan)' : 'var(--color-border-subtle)'}`,
            boxShadow: shiftActive ? '0 0 12px var(--color-neon-cyan-glow)' : 'none',
            color: shiftActive ? 'var(--color-neon-cyan)' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          SHIFT {shiftActive ? '●' : '○'}
        </button>

        <button
          type="button"
          onClick={() => toggleModifier('meta', setMetaActive, metaActive)}
          style={{
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: metaActive ? 'rgba(0, 229, 255, 0.2)' : 'var(--color-surface-card)',
            border: `1px solid ${metaActive ? 'var(--color-neon-cyan)' : 'var(--color-border-subtle)'}`,
            boxShadow: metaActive ? '0 0 12px var(--color-neon-cyan-glow)' : 'none',
            color: metaActive ? 'var(--color-neon-cyan)' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          WIN/CMD {metaActive ? '●' : '○'}
        </button>
      </div>

      {/* 3. PRODUCTIVITY MACRO SHORTCUTS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
        }}
      >
        <button
          type="button"
          onClick={() => sendMacro(HidKey.C, ModifierMask.CTRL)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Copy size={13} color="var(--color-neon-cyan)" /> COPY
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.V, ModifierMask.CTRL)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <ClipboardPaste size={13} color="var(--color-neon-cyan)" /> PASTE
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.Z, ModifierMask.CTRL)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Undo2 size={13} color="var(--color-neon-amber)" /> UNDO
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.Y, ModifierMask.CTRL)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Redo2 size={13} color="var(--color-neon-amber)" /> REDO
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.TAB, ModifierMask.ALT)}
          style={{
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ALT + TAB
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.D, ModifierMask.META)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Monitor size={13} color="var(--color-neon-green)" /> DESKTOP
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.A, ModifierMask.CTRL)}
          style={{
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          SELECT ALL
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.F4, ModifierMask.ALT)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid rgba(255, 23, 68, 0.3)',
            color: 'var(--color-neon-red)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <XSquare size={13} /> ALT + F4
        </button>
      </div>

      {/* 4. FUNCTION KEYS ROW (F1 to F12) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '6px',
        }}
      >
        {[
          { label: 'F1', code: HidKey.F1 },
          { label: 'F2', code: HidKey.F2 },
          { label: 'F3', code: HidKey.F3 },
          { label: 'F4', code: HidKey.F4 },
          { label: 'F5', code: HidKey.F5 },
          { label: 'F6', code: HidKey.F6 },
          { label: 'F7', code: HidKey.F7 },
          { label: 'F8', code: HidKey.F8 },
          { label: 'F9', code: HidKey.F9 },
          { label: 'F10', code: HidKey.F10 },
          { label: 'F11', code: HidKey.F11 },
          { label: 'F12', code: HidKey.F12 },
        ].map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => sendKeyTap(f.code)}
            style={{
              padding: '8px 2px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 5. NAVIGATION & ACTION CLUSTER */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        <button
          type="button"
          onClick={() => sendKeyTap(HidKey.ESCAPE)}
          style={{
            padding: '12px 6px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-neon-amber)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ESC
        </button>

        <button
          type="button"
          onClick={() => sendKeyTap(HidKey.TAB)}
          style={{
            padding: '12px 6px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          TAB
        </button>

        <button
          type="button"
          onClick={() => sendKeyTap(HidKey.BACKSPACE)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '12px 6px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Delete size={15} /> BKSP
        </button>

        <button
          type="button"
          onClick={() => sendKeyTap(HidKey.DELETE)}
          style={{
            padding: '12px 6px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-neon-red)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          DEL
        </button>
      </div>

      {/* 6. DIRECTIONAL ARROW PAD & SPACE / ENTER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr', gap: '8px', marginTop: 'auto' }}>
        {/* Spacebar */}
        <button
          type="button"
          onClick={() => sendKeyTap(HidKey.SPACE)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '16px 8px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Space size={16} /> SPACE
        </button>

        {/* 4-Way Arrow Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => sendKeyTap(HidKey.ARROW_UP)}
            style={{
              width: '100%',
              padding: '6px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-neon-cyan)',
              display: 'flex',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowUp size={16} />
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', width: '100%' }}>
            <button
              type="button"
              onClick={() => sendKeyTap(HidKey.ARROW_LEFT)}
              style={{
                padding: '6px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-neon-cyan)',
                display: 'flex',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => sendKeyTap(HidKey.ARROW_DOWN)}
              style={{
                padding: '6px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-neon-cyan)',
                display: 'flex',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              onClick={() => sendKeyTap(HidKey.ARROW_RIGHT)}
              style={{
                padding: '6px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-neon-cyan)',
                display: 'flex',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Enter Button */}
        <button
          type="button"
          onClick={() => sendKeyTap(HidKey.ENTER)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '16px 8px',
            borderRadius: '10px',
            backgroundColor: 'rgba(0, 229, 255, 0.15)',
            border: '1px solid var(--color-neon-cyan)',
            boxShadow: '0 0 12px var(--color-neon-cyan-glow)',
            color: 'var(--color-neon-cyan)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <CornerDownLeft size={16} /> ENTER
        </button>
      </div>
    </div>
  );
};
