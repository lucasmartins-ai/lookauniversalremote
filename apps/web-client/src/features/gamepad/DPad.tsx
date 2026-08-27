import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { GamepadButtonMask } from '@lookaremote/protocol-types';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface DPadProps {
  onDirectionChange: (mask: number) => void;
  size?: number;
}

export function calculateDPadMask(dx: number, dy: number, minDistance = 14): number {
  const distance = Math.hypot(dx, dy);
  if (distance < minDistance) {
    return 0;
  }

  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  let mask = 0;

  if (angleDeg >= -67.5 && angleDeg <= 67.5) {
    mask |= GamepadButtonMask.DPAD_RIGHT;
  } else if (angleDeg >= 112.5 || angleDeg <= -112.5) {
    mask |= GamepadButtonMask.DPAD_LEFT;
  }

  if (angleDeg >= -157.5 && angleDeg <= -22.5) {
    mask |= GamepadButtonMask.DPAD_UP;
  } else if (angleDeg >= 22.5 && angleDeg <= 157.5) {
    mask |= GamepadButtonMask.DPAD_DOWN;
  }

  return mask;
}

export const DPad: React.FC<DPadProps> = ({ onDirectionChange, size = 180 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [activeMask, setActiveMask] = useState<number>(0);

  const onDirectionChangeRef = useRef(onDirectionChange);
  onDirectionChangeRef.current = onDirectionChange;

  const updateDirection = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    const mask = calculateDPadMask(dx, dy, size * 0.12);
    setActiveMask((prev) => {
      if (prev !== mask) {
        if (mask !== 0) {
          haptics.buttonClick();
        }
        onDirectionChangeRef.current(mask);
      }
      return mask;
    });
  }, [size]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointerId.current = e.pointerId;
      updateDirection(e.clientX, e.clientY);
    },
    [updateDirection]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== e.pointerId) return;
      updateDirection(e.clientX, e.clientY);
    },
    [updateDirection]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture safety
      }
      activePointerId.current = null;
      setActiveMask(0);
      onDirectionChangeRef.current(0);
    },
    []
  );

  useEffect(() => {
    return () => {
      onDirectionChangeRef.current(0);
    };
  }, []);

  const wingSize = Math.round(size * 0.36);
  const centerSize = Math.round(size * 0.30);

  const isUp = (activeMask & GamepadButtonMask.DPAD_UP) !== 0;
  const isDown = (activeMask & GamepadButtonMask.DPAD_DOWN) !== 0;
  const isLeft = (activeMask & GamepadButtonMask.DPAD_LEFT) !== 0;
  const isRight = (activeMask & GamepadButtonMask.DPAD_RIGHT) !== 0;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="neo-sunken"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
        padding: '6px',
        boxShadow: 'var(--neo-shadow-sunken)',
      }}
    >
      {/* Background 3D Cross Structure */}
      {/* Vertical Bar */}
      <div
        className="neo-raised"
        style={{
          position: 'absolute',
          width: `${centerSize}px`,
          height: `${size - 16}px`,
          borderRadius: '10px',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.8)',
          pointerEvents: 'none',
        }}
      />
      {/* Horizontal Bar */}
      <div
        className="neo-raised"
        style={{
          position: 'absolute',
          width: `${size - 16}px`,
          height: `${centerSize}px`,
          borderRadius: '10px',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.8)',
          pointerEvents: 'none',
        }}
      />

      {/* Up Wing */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          width: `${centerSize}px`,
          height: `${wingSize}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isUp
            ? 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 100%)'
            : 'transparent',
          borderTopLeftRadius: '9px',
          borderTopRightRadius: '9px',
          boxShadow: isUp ? 'var(--neo-shadow-button-cyan-pressed)' : 'none',
          transition: 'background 0.08s ease, transform 0.08s ease',
          transform: isUp ? 'translateY(2px)' : 'none',
          pointerEvents: 'none',
        }}
      >
        <ChevronUp size={24} color={isUp ? '#040d1a' : 'var(--color-neon-cyan)'} />
      </div>

      {/* Down Wing */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          width: `${centerSize}px`,
          height: `${wingSize}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDown
            ? 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 100%)'
            : 'transparent',
          borderBottomLeftRadius: '9px',
          borderBottomRightRadius: '9px',
          boxShadow: isDown ? 'var(--neo-shadow-button-cyan-pressed)' : 'none',
          transition: 'background 0.08s ease, transform 0.08s ease',
          transform: isDown ? 'translateY(2px)' : 'none',
          pointerEvents: 'none',
        }}
      >
        <ChevronDown size={24} color={isDown ? '#040d1a' : 'var(--color-neon-cyan)'} />
      </div>

      {/* Left Wing */}
      <div
        style={{
          position: 'absolute',
          left: '8px',
          width: `${wingSize}px`,
          height: `${centerSize}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isLeft
            ? 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 100%)'
            : 'transparent',
          borderTopLeftRadius: '9px',
          borderBottomLeftRadius: '9px',
          boxShadow: isLeft ? 'var(--neo-shadow-button-cyan-pressed)' : 'none',
          transition: 'background 0.08s ease, transform 0.08s ease',
          transform: isLeft ? 'translateX(2px)' : 'none',
          pointerEvents: 'none',
        }}
      >
        <ChevronLeft size={24} color={isLeft ? '#040d1a' : 'var(--color-neon-cyan)'} />
      </div>

      {/* Right Wing */}
      <div
        style={{
          position: 'absolute',
          right: '8px',
          width: `${wingSize}px`,
          height: `${centerSize}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isRight
            ? 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 100%)'
            : 'transparent',
          borderTopRightRadius: '9px',
          borderBottomRightRadius: '9px',
          boxShadow: isRight ? 'var(--neo-shadow-button-cyan-pressed)' : 'none',
          transition: 'background 0.08s ease, transform 0.08s ease',
          transform: isRight ? 'translateX(-2px)' : 'none',
          pointerEvents: 'none',
        }}
      >
        <ChevronRight size={24} color={isRight ? '#040d1a' : 'var(--color-neon-cyan)'} />
      </div>

      {/* Center Concave Pivot Dome */}
      <div
        style={{
          width: `${Math.round(centerSize * 0.75)}px`,
          height: `${Math.round(centerSize * 0.75)}px`,
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #0d121c 0%, #171f2e 100%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.8), 0 1px 2px rgba(255, 255, 255, 0.1)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
    </div>
  );
};
