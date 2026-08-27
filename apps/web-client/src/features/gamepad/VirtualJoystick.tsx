import React, { useRef, useState, useCallback, useEffect } from 'react';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface JoystickVectorResult {
  stickX: number;
  stickY: number;
  visualX: number;
  visualY: number;
  magnitude: number;
}

export function calculateJoystickVector(
  dx: number,
  dy: number,
  maxRadius: number,
  deadzone: number = 0.15,
  sensitivity: number = 1.0,
  invertY: boolean = false
): JoystickVectorResult {
  if (maxRadius <= 0) {
    return { stickX: 0, stickY: 0, visualX: 0, visualY: 0, magnitude: 0 };
  }

  const distance = Math.hypot(dx, dy);
  if (distance < 0.0001) {
    return { stickX: 0, stickY: 0, visualX: 0, visualY: 0, magnitude: 0 };
  }

  const normalizedRadius = Math.min(1.0, distance / maxRadius);
  const angle = Math.atan2(dy, dx);

  const visualDist = Math.min(distance, maxRadius);
  const visualX = Math.cos(angle) * visualDist;
  const visualY = Math.sin(angle) * visualDist;

  if (normalizedRadius <= deadzone) {
    return {
      stickX: 0,
      stickY: 0,
      visualX,
      visualY,
      magnitude: 0,
    };
  }

  const clampedDeadzone = Math.max(0.01, Math.min(0.95, deadzone));
  const rescaledMag = Math.min(
    1.0,
    ((normalizedRadius - clampedDeadzone) / (1.0 - clampedDeadzone)) * sensitivity
  );

  let rawX = Math.cos(angle) * rescaledMag;
  let rawY = Math.sin(angle) * rescaledMag;

  if (invertY) {
    rawY = -rawY;
  }

  const stickX = Math.max(-32768, Math.min(32767, Math.round(rawX * 32767)));
  const stickY = Math.max(-32768, Math.min(32767, Math.round(rawY * 32767)));

  return {
    stickX,
    stickY,
    visualX,
    visualY,
    magnitude: rescaledMag,
  };
}

export interface VirtualJoystickProps {
  label: string;
  radius?: number;
  deadzone?: number;
  sensitivity?: number;
  invertY?: boolean;
  floating?: boolean;
  color?: string;
  onChange: (x: number, y: number) => void;
  onStickClick?: () => void;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  label,
  radius = 65,
  deadzone = 0.15,
  sensitivity = 1.0,
  invertY = false,
  floating = false,
  color = 'var(--color-neon-cyan)',
  onChange,
  onStickClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const anchorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastClickTimeRef = useRef<number>(0);

  const [puckPos, setPuckPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onStickClickRef = useRef(onStickClick);
  onStickClickRef.current = onStickClick;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== null) return;

      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      activePointerId.current = e.pointerId;
      setIsActive(true);

      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      if (floating) {
        anchorRef.current = { x: e.clientX, y: e.clientY };
      } else {
        anchorRef.current = { x: centerX, y: centerY };
      }

      const now = performance.now();
      if (now - lastClickTimeRef.current < 280) {
        haptics.heavyClick();
        onStickClickRef.current?.();
        lastClickTimeRef.current = 0;
      } else {
        lastClickTimeRef.current = now;
        haptics.lightTap();
      }

      const dx = e.clientX - anchorRef.current.x;
      const dy = e.clientY - anchorRef.current.y;

      const vector = calculateJoystickVector(dx, dy, radius, deadzone, sensitivity, invertY);
      setPuckPos({ x: vector.visualX, y: vector.visualY });
      onChangeRef.current(vector.stickX, vector.stickY);
    },
    [deadzone, floating, invertY, radius, sensitivity]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== e.pointerId) return;

      const dx = e.clientX - anchorRef.current.x;
      const dy = e.clientY - anchorRef.current.y;

      const vector = calculateJoystickVector(dx, dy, radius, deadzone, sensitivity, invertY);
      setPuckPos({ x: vector.visualX, y: vector.visualY });
      onChangeRef.current(vector.stickX, vector.stickY);
    },
    [deadzone, invertY, radius, sensitivity]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== e.pointerId) return;

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }

      activePointerId.current = null;
      setIsActive(false);
      setPuckPos({ x: 0, y: 0 });
      onChangeRef.current(0, 0);
    },
    []
  );

  useEffect(() => {
    return () => {
      onChangeRef.current(0, 0);
    };
  }, []);

  const size = radius * 2 + 24;
  const puckRadius = Math.round(radius * 0.44);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="neo-sunken-deep"
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
        cursor: 'grab',
        boxShadow: isActive
          ? `var(--neo-shadow-sunken-deep), 0 0 16px ${color}30`
          : 'var(--neo-shadow-sunken-deep)',
        border: `2px solid ${isActive ? color : 'rgba(255, 255, 255, 0.1)'}`,
      }}
    >
      {/* Outer Limit Guide Ring */}
      <div
        style={{
          position: 'absolute',
          width: `${radius * 2}px`,
          height: `${radius * 2}px`,
          borderRadius: '50%',
          border: '1.5px dashed rgba(255, 255, 255, 0.14)',
          pointerEvents: 'none',
        }}
      />

      {/* Deadzone Inner Boundary Ring */}
      <div
        style={{
          position: 'absolute',
          width: `${radius * 2 * deadzone}px`,
          height: `${radius * 2 * deadzone}px`,
          borderRadius: '50%',
          border: `1px solid ${isActive ? color + '40' : 'rgba(255, 255, 255, 0.08)'}`,
          pointerEvents: 'none',
        }}
      />

      {/* 3D Tactile Rubber Thumb Puck */}
      <div
        style={{
          width: `${puckRadius * 2}px`,
          height: `${puckRadius * 2}px`,
          borderRadius: '50%',
          background: isActive
            ? 'radial-gradient(circle at 35% 35%, #2a3852 0%, #161e2e 60%, #0c1018 100%)'
            : 'radial-gradient(circle at 35% 35%, #222d42 0%, #121824 60%, #070a0f 100%)',
          border: `2px solid ${isActive ? color : 'rgba(255, 255, 255, 0.3)'}`,
          boxShadow: isActive
            ? `0 6px 14px rgba(0, 0, 0, 0.9), 0 0 14px ${color}60, inset 0 2px 4px rgba(255, 255, 255, 0.3)`
            : '0 5px 12px rgba(0, 0, 0, 0.85), inset 0 2px 3px rgba(255, 255, 255, 0.2)',
          transform: `translate3d(${puckPos.x}px, ${puckPos.y}px, 0)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          willChange: 'transform',
          transition: isActive ? 'none' : 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        {/* Concentric Grip Ring */}
        <div
          style={{
            width: `${puckRadius * 1.3}px`,
            height: `${puckRadius * 1.3}px`,
            borderRadius: '50%',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.8rem',
              fontWeight: 900,
              color: isActive ? color : 'var(--color-text-secondary)',
              letterSpacing: '0.06em',
              textShadow: isActive ? `0 0 8px ${color}` : '0 1px 2px #000',
            }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
};
