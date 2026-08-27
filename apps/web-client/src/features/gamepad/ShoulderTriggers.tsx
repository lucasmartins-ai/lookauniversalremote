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

  const handleTriggerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      triggerPointerIdRef.current = e.pointerId;
      triggerStartYRef.current = e.clientY;

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
      {/* 3D Bumper Button (LB / RB) */}
      <button
        onPointerDown={handleBumperDown}
        onPointerUp={handleBumperUp}
        onPointerCancel={handleBumperUp}
        className="lookaremote-btn retro-btn"
        style={{
          width: '100%',
          height: '38px',
          borderRadius: '9px',
          background: bumperPressed
            ? isLeft
              ? 'linear-gradient(180deg, #008ba3 0%, #00e5ff 100%)'
              : 'linear-gradient(180deg, #b37400 0%, #ffb703 100%)'
            : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
          border: `1.5px solid ${bumperPressed ? color : 'rgba(255, 255, 255, 0.2)'}`,
          color: bumperPressed ? '#040d1a' : 'var(--color-text-primary)',
          fontFamily: 'var(--font-display)',
          fontSize: '0.95rem',
          fontWeight: 800,
          letterSpacing: '0.06em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: bumperPressed
            ? isLeft ? 'var(--neo-shadow-button-cyan-pressed)' : 'var(--neo-shadow-button-amber-pressed)'
            : 'var(--neo-shadow-button-slate)',
        }}
      >
        {bumperLabel}
      </button>

      {/* 3D Analog Trigger Slider / Pad (LT / RT) */}
      <div
        onPointerDown={handleTriggerDown}
        onPointerMove={handleTriggerMove}
        onPointerUp={handleTriggerUp}
        onPointerCancel={handleTriggerUp}
        className="neo-sunken"
        style={{
          width: '100%',
          height: '46px',
          borderRadius: '9px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          touchAction: 'none',
          userSelect: 'none',
          border: `1.5px solid ${triggerValue > 0 ? color : 'rgba(255, 255, 255, 0.15)'}`,
          boxShadow: triggerValue > 0 ? `0 0 12px ${color}40, var(--neo-shadow-sunken)` : 'var(--neo-shadow-sunken)',
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
            background: isLeft
              ? 'linear-gradient(180deg, rgba(0, 229, 255, 0.45) 0%, rgba(0, 180, 216, 0.2) 100%)'
              : 'linear-gradient(180deg, rgba(255, 183, 3, 0.45) 0%, rgba(255, 158, 0, 0.2) 100%)',
            borderTop: triggerValue > 0 ? `2px solid ${color}` : 'none',
            pointerEvents: 'none',
            transition: 'height 0.04s linear',
          }}
        />

        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem',
            fontWeight: 900,
            color: triggerValue > 0 ? color : 'var(--color-text-secondary)',
            letterSpacing: '0.06em',
            zIndex: 2,
            pointerEvents: 'none',
            textShadow: triggerValue > 0 ? `0 0 8px ${color}` : '0 1px 2px #000',
          }}
        >
          {triggerLabel} {triggerValue > 0 && <span style={{ fontSize: '0.75rem' }}>({Math.round((triggerValue / 255) * 100)}%)</span>}
        </span>
      </div>
    </div>
  );
};
