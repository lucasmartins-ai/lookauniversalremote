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
  const [ctrlActive, setCtrlActive] = useState(false);
  const [shiftActive, setShiftActive] = useState(false);
  const [altActive, setAltActive] = useState(false);
  const [metaActive, setMetaActive] = useState(false);

  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const activeModifiers = buildModifierMask(ctrlActive, shiftActive, altActive, metaActive);

  const sendKeyTap = (keyCode: number, additionalModifiers = 0) => {
    haptics.buttonClick();
    const finalModifiers = activeModifiers | additionalModifiers;

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
    }, 40);
  };

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
        gap: '12px',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* 1. NATIVE KEYBOARD INPUT BRIDGE (3D Beveled Deck) */}
      <div
        onClick={() => hiddenInputRef.current?.focus()}
        className={isInputFocused ? 'neo-raised-lg' : 'neo-raised'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: '14px',
          cursor: 'pointer',
          border: isInputFocused ? '1.5px solid var(--color-neon-cyan)' : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isInputFocused ? '0 0 16px rgba(0, 229, 255, 0.35), var(--neo-shadow-raised-lg)' : 'var(--neo-shadow-raised)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="retro-led"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: isInputFocused
                ? 'linear-gradient(180deg, #00f0ff 0%, #008ba3 100%)'
                : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isInputFocused ? '0 0 12px var(--color-neon-cyan)' : 'none',
            }}
          >
            <KeyboardIcon size={20} color={isInputFocused ? '#040d1a' : 'var(--color-neon-cyan)'} />
          </div>
          <div>
            <div
              className="retro-embossed-text"
              style={{
                fontSize: '0.9rem',
                fontWeight: 800,
                color: isInputFocused ? 'var(--color-neon-cyan)' : '#ffffff',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.06em',
              }}
            >
              {isInputFocused ? 'TECLADO DO SISTEMA ATIVO (DIGITAÇÃO DIRETA)' : 'TOQUE PARA ABRIR TECLADO DO CELULAR'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Captura acentos, emojis e digitação IME do smartphone
            </div>
          </div>
        </div>

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
            padding: '4px 10px',
            borderRadius: '8px',
            background: isInputFocused ? 'linear-gradient(180deg, #00f0ff 0%, #008ba3 100%)' : '#0a0e16',
            color: isInputFocused ? '#040d1a' : 'var(--color-text-muted)',
            fontWeight: 800,
            border: isInputFocused ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {isInputFocused ? 'ATIVO' : 'ABRIR'}
        </span>
      </div>

      {/* 2. 3D STICKY MODIFIERS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'CTRL', active: ctrlActive, type: 'ctrl' as const, setter: setCtrlActive },
          { label: 'ALT', active: altActive, type: 'alt' as const, setter: setAltActive },
          { label: 'SHIFT', active: shiftActive, type: 'shift' as const, setter: setShiftActive },
          { label: 'WIN/CMD', active: metaActive, type: 'meta' as const, setter: setMetaActive },
        ].map((mod) => (
          <button
            key={mod.label}
            type="button"
            onClick={() => toggleModifier(mod.type, mod.setter, mod.active)}
            className="lookaremote-btn retro-btn"
            style={{
              padding: '10px 4px',
              borderRadius: '9px',
              background: mod.active
                ? 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #007791 100%)'
                : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: `1.5px solid ${mod.active ? '#00f0ff' : 'rgba(255, 255, 255, 0.12)'}`,
              boxShadow: mod.active
                ? 'var(--neo-shadow-button-cyan-pressed)'
                : 'var(--neo-shadow-button-slate)',
              color: mod.active ? '#040d1a' : 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <span>{mod.label}</span>
            <span
              className="retro-led"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: mod.active ? '#040d1a' : 'rgba(255, 255, 255, 0.2)',
                boxShadow: mod.active ? '0 0 6px #040d1a' : 'none',
              }}
            />
          </button>
        ))}
      </div>

      {/* 3. PRODUCTIVITY MACRO SHORTCUTS (3D Keycaps) */}
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
          className="lookaremote-btn retro-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          <Copy size={13} color="var(--color-neon-cyan)" /> COPY
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.V, ModifierMask.CTRL)}
          className="lookaremote-btn retro-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          <ClipboardPaste size={13} color="var(--color-neon-cyan)" /> PASTE
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.Z, ModifierMask.CTRL)}
          className="lookaremote-btn retro-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          <Undo2 size={13} color="var(--color-neon-amber)" /> UNDO
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.Y, ModifierMask.CTRL)}
          className="lookaremote-btn retro-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          <Redo2 size={13} color="var(--color-neon-amber)" /> REDO
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.TAB, ModifierMask.ALT)}
          className="lookaremote-btn retro-btn"
          style={{
            padding: '10px 4px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          ALT + TAB
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.D, ModifierMask.META)}
          className="lookaremote-btn retro-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          <Monitor size={13} color="var(--color-neon-green)" /> DESKTOP
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.A, ModifierMask.CTRL)}
          className="lookaremote-btn retro-btn"
          style={{
            padding: '10px 4px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          SEL ALL
        </button>

        <button
          type="button"
          onClick={() => sendMacro(HidKey.F4, ModifierMask.ALT)}
          className="lookaremote-btn retro-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 4px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #ff3366 0%, #9e0c29 100%)',
            border: '1px solid #ff3366',
            color: '#ffffff',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-red)',
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
            className="lookaremote-btn retro-btn"
            style={{
              padding: '8px 2px',
              borderRadius: '7px',
              background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 800,
              boxShadow: 'var(--neo-shadow-button-slate)',
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
          className="lookaremote-btn retro-btn"
          style={{
            padding: '12px 6px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #ffc01e 0%, #b36b00 100%)',
            border: '1px solid #ffc01e',
            color: '#1a0e00',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            fontWeight: 900,
            boxShadow: 'var(--neo-shadow-button-amber)',
          }}
        >
          ESC
        </button>

        <button
          type="button"
          onClick={() => sendKeyTap(HidKey.TAB)}
          className="lookaremote-btn retro-btn"
          style={{
            padding: '12px 6px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          TAB
        </button>

        <button
          type="button"
          onClick={() => sendKeyTap(HidKey.BACKSPACE)}
          className="lookaremote-btn retro-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '12px 6px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          <Delete size={15} /> BKSP
        </button>

        <button
          type="button"
          onClick={() => sendKeyTap(HidKey.DELETE)}
          className="lookaremote-btn retro-btn"
          style={{
            padding: '12px 6px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #ff3366 0%, #9e0c29 100%)',
            border: '1px solid #ff3366',
            color: '#ffffff',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            fontWeight: 900,
            boxShadow: 'var(--neo-shadow-button-red)',
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
          className="lookaremote-btn retro-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '16px 8px',
            borderRadius: '12px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            fontWeight: 800,
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          <Space size={17} /> SPACE
        </button>

        {/* 4-Way Arrow Cluster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => sendKeyTap(HidKey.ARROW_UP)}
            className="lookaremote-btn retro-btn"
            style={{
              width: '100%',
              padding: '6px',
              borderRadius: '7px',
              background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--color-neon-cyan)',
              display: 'flex',
              justifyContent: 'center',
              boxShadow: 'var(--neo-shadow-button-slate)',
            }}
          >
            <ArrowUp size={16} />
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', width: '100%' }}>
            <button
              type="button"
              onClick={() => sendKeyTap(HidKey.ARROW_LEFT)}
              className="lookaremote-btn retro-btn"
              style={{
                padding: '6px',
                borderRadius: '7px',
                background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'var(--color-neon-cyan)',
                display: 'flex',
                justifyContent: 'center',
                boxShadow: 'var(--neo-shadow-button-slate)',
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => sendKeyTap(HidKey.ARROW_DOWN)}
              className="lookaremote-btn retro-btn"
              style={{
                padding: '6px',
                borderRadius: '7px',
                background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'var(--color-neon-cyan)',
                display: 'flex',
                justifyContent: 'center',
                boxShadow: 'var(--neo-shadow-button-slate)',
              }}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              onClick={() => sendKeyTap(HidKey.ARROW_RIGHT)}
              className="lookaremote-btn retro-btn"
              style={{
                padding: '6px',
                borderRadius: '7px',
                background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'var(--color-neon-cyan)',
                display: 'flex',
                justifyContent: 'center',
                boxShadow: 'var(--neo-shadow-button-slate)',
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
          className="lookaremote-btn retro-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '16px 8px',
            borderRadius: '12px',
            background: 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #007791 100%)',
            border: '1.5px solid #00f0ff',
            color: '#040d1a',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            fontWeight: 900,
            boxShadow: 'var(--neo-shadow-button-cyan)',
          }}
        >
          <CornerDownLeft size={17} /> ENTER
        </button>
      </div>
    </div>
  );
};
