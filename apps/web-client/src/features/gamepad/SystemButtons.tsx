import React, { useRef, useCallback } from 'react';
import { Menu, Share2, Disc, Crosshair } from 'lucide-react';
import { GamepadButtonMask } from '@lookaremote/protocol-types';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface SystemButtonsProps {
  onButtonChange: (mask: number, pressed: boolean) => void;
}

export const SystemButtons: React.FC<SystemButtonsProps> = ({ onButtonChange }) => {
  const onButtonChangeRef = useRef(onButtonChange);
  onButtonChangeRef.current = onButtonChange;

  const createPointerHandlers = useCallback((mask: number) => {
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        haptics.buttonClick();
        onButtonChangeRef.current(mask, true);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture safety
        }
        onButtonChangeRef.current(mask, false);
      },
      onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture safety
        }
        onButtonChangeRef.current(mask, false);
      },
    };
  }, []);

  const buttonStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: 'rgba(15, 20, 28, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
    touchAction: 'none',
    userSelect: 'none',
    transition: 'background-color 0.1s ease, color 0.1s ease, border-color 0.1s ease',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* L3 Quick Click */}
      <button
        {...createPointerHandlers(GamepadButtonMask.BTN_L3)}
        style={buttonStyle}
        aria-label="L3 Stick Click"
      >
        <Crosshair size={12} />
        <span>L3</span>
      </button>

      {/* Select / Back */}
      <button
        {...createPointerHandlers(GamepadButtonMask.BTN_SELECT)}
        style={buttonStyle}
        aria-label="Select Button"
      >
        <Share2 size={12} />
        <span>BACK</span>
      </button>

      {/* Guide / Home */}
      <button
        {...createPointerHandlers(GamepadButtonMask.BTN_GUIDE)}
        style={{
          ...buttonStyle,
          backgroundColor: 'rgba(0, 229, 255, 0.12)',
          border: '1px solid var(--color-neon-cyan)',
          color: 'var(--color-neon-cyan)',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          padding: 0,
          justifyContent: 'center',
          boxShadow: '0 0 8px rgba(0, 229, 255, 0.3)',
        }}
        aria-label="Guide Home Button"
      >
        <Disc size={16} />
      </button>

      {/* Start / Menu */}
      <button
        {...createPointerHandlers(GamepadButtonMask.BTN_START)}
        style={buttonStyle}
        aria-label="Start Button"
      >
        <span>START</span>
        <Menu size={12} />
      </button>

      {/* R3 Quick Click */}
      <button
        {...createPointerHandlers(GamepadButtonMask.BTN_R3)}
        style={buttonStyle}
        aria-label="R3 Stick Click"
      >
        <span>R3</span>
        <Crosshair size={12} />
      </button>
    </div>
  );
};
