import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { GamepadButtonMask } from '@lookaremote/protocol-types';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface DPadProps {
  onDirectionChange: (mask: number) => void;
  size?: number;
}

/**
 * Maps coordinate offset to 8-way D-Pad direction bitmask.
 */
export function calculateDPadMask(dx: number, dy: number, minDistance = 14): number {
  const distance = Math.hypot(dx, dy);
  if (distance < minDistance) {
    return 0;
  }

  // Angle in degrees from -180 to 180
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  let mask = 0;

  // Horizontal evaluation
  if (angleDeg >= -67.5 && angleDeg <= 67.5) {
    mask |= GamepadButtonMask.DPAD_RIGHT;
  } else if (angleDeg >= 112.5 || angleDeg <= -112.5) {
    mask |= GamepadButtonMask.DPAD_LEFT;
  }

  // Vertical evaluation (dy < 0 is UP on screen)
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
  const centerSize = Math.round(size * 0.28);

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
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Background Cross Body */}
      {/* Vertical Bar */}
      <div
        style={{
          position: 'absolute',
          width: `${centerSize}px`,
          height: `${size}px`,
          backgroundColor: 'rgba(10, 15, 22, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '10px',
          boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.8)',
          pointerEvents: 'none',
        }}
      />
      {/* Horizontal Bar */}
      <div
        style={{
          position: 'absolute',
          width: `${size}px`,
          height: `${centerSize}px`,
          backgroundColor: 'rgba(10, 15, 22, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '10px',
          boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.8)',
          pointerEvents: 'none',
        }}
      />

      {/* Up Wing Indicator */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          width: `${centerSize}px`,
          height: `${wingSize}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isUp ? 'var(--color-neon-cyan)' : 'transparent',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          boxShadow: isUp ? '0 0 12px var(--color-neon-cyan)' : 'none',
          transition: 'background-color 0.08s ease',
          pointerEvents: 'none',
        }}
      >
        <ChevronUp size={22} color={isUp ? '#000000' : 'var(--color-text-secondary)'} />
      </div>

      {/* Down Wing Indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          width: `${centerSize}px`,
          height: `${wingSize}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDown ? 'var(--color-neon-cyan)' : 'transparent',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
          boxShadow: isDown ? '0 0 12px var(--color-neon-cyan)' : 'none',
          transition: 'background-color 0.08s ease',
          pointerEvents: 'none',
        }}
      >
        <ChevronDown size={22} color={isDown ? '#000000' : 'var(--color-text-secondary)'} />
      </div>

      {/* Left Wing Indicator */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: `${wingSize}px`,
          height: `${centerSize}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isLeft ? 'var(--color-neon-cyan)' : 'transparent',
          borderTopLeftRadius: '8px',
          borderBottomLeftRadius: '8px',
          boxShadow: isLeft ? '0 0 12px var(--color-neon-cyan)' : 'none',
          transition: 'background-color 0.08s ease',
          pointerEvents: 'none',
        }}
      >
        <ChevronLeft size={22} color={isLeft ? '#000000' : 'var(--color-text-secondary)'} />
      </div>

      {/* Right Wing Indicator */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          width: `${wingSize}px`,
          height: `${centerSize}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isRight ? 'var(--color-neon-cyan)' : 'transparent',
          borderTopRightRadius: '8px',
          borderBottomRightRadius: '8px',
          boxShadow: isRight ? '0 0 12px var(--color-neon-cyan)' : 'none',
          transition: 'background-color 0.08s ease',
          pointerEvents: 'none',
        }}
      >
        <ChevronRight size={22} color={isRight ? '#000000' : 'var(--color-text-secondary)'} />
      </div>

      {/* Center Pivot */}
      <div
        style={{
          width: `${Math.round(centerSize * 0.7)}px`,
          height: `${Math.round(centerSize * 0.7)}px`,
          borderRadius: '50%',
          backgroundColor: 'rgba(5, 8, 12, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
    </div>
  );
};
