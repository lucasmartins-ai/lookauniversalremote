import React, { useRef, useState, useCallback, useEffect } from 'react';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface ShoulderTriggersProps {
  side: 'left' | 'right';
  onBumperChange: (side: 'left' | 'right', pressed: boolean) => void;
  onTriggerChange: (side: 'left' | 'right', value: number) => void;
}

export const ShoulderTriggers: React.FC<ShoulderTriggersProps> = ({
  side,
  onBumperChange,
  onTriggerChange,
}) => {
  const isLeft = side === 'left';
  const bumperLabel = isLeft ? 'LB' : 'RB';
  const triggerLabel = isLeft ? 'LT' : 'RT';
  const color = isLeft ? 'var(--color-neon-cyan)' : 'var(--color-neon-amber)';

  const [bumperPressed, setBumperPressed] = useState(false);
  const [triggerValue, setTriggerValue] = useState(0); // 0 to 255

  const triggerStartYRef = useRef<number | null>(null);
  const triggerPointerIdRef = useRef<number | null>(null);

  const onBumperChangeRef = useRef(onBumperChange);
  onBumperChangeRef.current = onBumperChange;

  const onTriggerChangeRef = useRef(onTriggerChange);
  onTriggerChangeRef.current = onTriggerChange;

  // Bumper Touch Handlers
  const handleBumperDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setBumperPressed(true);
      haptics.buttonClick();
      onBumperChangeRef.current(side, true);
    },
    [side]
  );

  const handleBumperUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture safety
      }
      setBumperPressed(false);
      onBumperChangeRef.current(side, false);
    },
    [side]
  );

  // Trigger Touch & Slide Handlers
  const handleTriggerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      triggerPointerIdRef.current = e.pointerId;
      triggerStartYRef.current = e.clientY;

      // Start at half or full tap value
      const initialVal = 255;
      setTriggerValue(initialVal);
      haptics.lightTap();
      onTriggerChangeRef.current(side, initialVal);
    },
    [side]
  );

  const handleTriggerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (triggerPointerIdRef.current !== e.pointerId || triggerStartYRef.current === null) return;

      const deltaY = e.clientY - triggerStartYRef.current;
      // Moving finger downwards slides trigger depth
      const maxDragPx = 40;
      const normalized = Math.max(0.1, Math.min(1.0, 1.0 - deltaY / maxDragPx));
      const val = Math.round(normalized * 255);

      setTriggerValue(val);
      onTriggerChangeRef.current(side, val);
    },
    [side]
  );

  const handleTriggerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (triggerPointerIdRef.current !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture safety
      }
      triggerPointerIdRef.current = null;
      triggerStartYRef.current = null;
      setTriggerValue(0);
      onTriggerChangeRef.current(side, 0);
    },
    [side]
  );

  useEffect(() => {
    return () => {
      onBumperChangeRef.current(side, false);
      onTriggerChangeRef.current(side, 0);
    };
  }, [side]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        maxWidth: '120px',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Bumper Button (LB / RB) */}
      <button
        onPointerDown={handleBumperDown}
        onPointerUp={handleBumperUp}
        onPointerCancel={handleBumperUp}
        style={{
          width: '100%',
          height: '38px',
          borderRadius: '8px',
          backgroundColor: bumperPressed ? color : 'rgba(15, 20, 28, 0.85)',
          border: `1.5px solid ${bumperPressed ? color : 'rgba(255, 255, 255, 0.2)'}`,
          color: bumperPressed ? '#000000' : 'var(--color-text-primary)',
          fontFamily: 'var(--font-display)',
          fontSize: '0.9rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: bumperPressed
            ? `0 0 12px ${color}`
            : '0 2px 4px rgba(0, 0, 0, 0.5)',
          cursor: 'pointer',
          touchAction: 'none',
          userSelect: 'none',
          transition: 'background-color 0.08s ease, color 0.08s ease, box-shadow 0.08s ease',
        }}
      >
        {bumperLabel}
      </button>

      {/* Analog Trigger Slider / Pad (LT / RT) */}
      <div
        onPointerDown={handleTriggerDown}
        onPointerMove={handleTriggerMove}
        onPointerUp={handleTriggerUp}
        onPointerCancel={handleTriggerUp}
        style={{
          width: '100%',
          height: '46px',
          borderRadius: '8px',
          backgroundColor: 'rgba(10, 14, 20, 0.9)',
          border: `1.5px solid ${triggerValue > 0 ? color : 'rgba(255, 255, 255, 0.15)'}`,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          touchAction: 'none',
          userSelect: 'none',
          boxShadow: triggerValue > 0 ? `0 0 10px ${color}40` : 'none',
        }}
      >
        {/* Dynamic Progress Fill Level */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${(triggerValue / 255) * 100}%`,
            backgroundColor: `${color}35`,
            borderTop: triggerValue > 0 ? `2px solid ${color}` : 'none',
            pointerEvents: 'none',
            transition: 'height 0.04s linear',
          }}
        />

        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem',
            fontWeight: 800,
            color: triggerValue > 0 ? color : 'var(--color-text-secondary)',
            letterSpacing: '0.05em',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          {triggerLabel} {triggerValue > 0 && <span style={{ fontSize: '0.75rem' }}>({Math.round((triggerValue / 255) * 100)}%)</span>}
        </span>
      </div>
    </div>
  );
};
