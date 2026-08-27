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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* L3 Quick Click */}
      <button
        {...createPointerHandlers(GamepadButtonMask.BTN_L3)}
        className="lookaremote-btn retro-btn"
        style={{
          padding: '6px 10px',
          borderRadius: '7px',
          background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: 'var(--neo-shadow-button-slate)',
        }}
        aria-label="L3 Stick Click"
      >
        <Crosshair size={12} />
        <span>L3</span>
      </button>

      {/* Select / Back */}
      <button
        {...createPointerHandlers(GamepadButtonMask.BTN_SELECT)}
        className="lookaremote-btn retro-btn"
        style={{
          padding: '6px 10px',
          borderRadius: '7px',
          background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: 'var(--neo-shadow-button-slate)',
        }}
        aria-label="Select Button"
      >
        <Share2 size={12} />
        <span>BACK</span>
      </button>

      {/* Guide / Home (3D Dome Jewel) */}
      <button
        {...createPointerHandlers(GamepadButtonMask.BTN_GUIDE)}
        className="lookaremote-btn retro-btn"
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #007791 100%)',
          border: '1.5px solid #00f0ff',
          color: '#040d1a',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--neo-shadow-button-cyan)',
        }}
        aria-label="Guide Home Button"
      >
        <Disc size={18} />
      </button>

      {/* Start / Menu */}
      <button
        {...createPointerHandlers(GamepadButtonMask.BTN_START)}
        className="lookaremote-btn retro-btn"
        style={{
          padding: '6px 10px',
          borderRadius: '7px',
          background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: 'var(--neo-shadow-button-slate)',
        }}
        aria-label="Start Button"
      >
        <span>START</span>
        <Menu size={12} />
      </button>

      {/* R3 Quick Click */}
      <button
        {...createPointerHandlers(GamepadButtonMask.BTN_R3)}
        className="lookaremote-btn retro-btn"
        style={{
          padding: '6px 10px',
          borderRadius: '7px',
          background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: 'var(--neo-shadow-button-slate)',
        }}
        aria-label="R3 Stick Click"
      >
        <span>R3</span>
        <Crosshair size={12} />
      </button>
    </div>
  );
};
