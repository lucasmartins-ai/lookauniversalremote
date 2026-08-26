import React, { useRef, useState, useCallback, useEffect } from 'react';
import { GamepadButtonMask } from '@lookaremote/protocol-types';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface ActionButtonDef {
  id: 'a' | 'b' | 'x' | 'y';
  label: string;
  mask: number;
  color: string;
  gridArea: string;
}

const ACTION_BUTTONS: ActionButtonDef[] = [
  {
    id: 'y',
    label: 'Y',
    mask: GamepadButtonMask.BTN_NORTH, // 0x0080
    color: 'var(--color-neon-amber)',
    gridArea: 'y',
  },
  {
    id: 'x',
    label: 'X',
    mask: GamepadButtonMask.BTN_WEST, // 0x0040
    color: 'var(--color-neon-cyan)',
    gridArea: 'x',
  },
  {
    id: 'b',
    label: 'B',
    mask: GamepadButtonMask.BTN_EAST, // 0x0020
    color: 'var(--color-neon-red)',
    gridArea: 'b',
  },
  {
    id: 'a',
    label: 'A',
    mask: GamepadButtonMask.BTN_SOUTH, // 0x0010
    color: 'var(--color-neon-green)',
    gridArea: 'a',
  },
];

export interface ActionDiamondProps {
  onButtonChange: (mask: number, pressed: boolean) => void;
  size?: number;
}

export const ActionDiamond: React.FC<ActionDiamondProps> = ({
  onButtonChange,
  size = 180,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerMapRef = useRef<Map<number, number>>(new Map()); // pointerId -> active button mask
  const [activeMasks, setActiveMasks] = useState<number>(0);

  const onButtonChangeRef = useRef(onButtonChange);
  onButtonChangeRef.current = onButtonChange;

  // Detect which action button is under a pointer coordinate
  const getButtonAtPoint = useCallback((clientX: number, clientY: number): ActionButtonDef | null => {
    if (!containerRef.current) return null;

    const buttons = containerRef.current.querySelectorAll<HTMLButtonElement>('[data-action-button]');
    for (const btn of Array.from(buttons)) {
      const rect = btn.getBoundingClientRect();
      // Expand hit test boundary slightly for smooth thumb sliding
      const padding = 6;
      if (
        clientX >= rect.left - padding &&
        clientX <= rect.right + padding &&
        clientY >= rect.top - padding &&
        clientY <= rect.bottom + padding
      ) {
        const id = btn.getAttribute('data-action-id');
        return ACTION_BUTTONS.find((b) => b.id === id) || null;
      }
    }
    return null;
  }, []);

  const recalculateMasks = useCallback(() => {
    let combined = 0;
    pointerMapRef.current.forEach((mask) => {
      combined |= mask;
    });
    setActiveMasks(combined);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const btn = getButtonAtPoint(e.clientX, e.clientY);
      if (btn) {
        pointerMapRef.current.set(e.pointerId, btn.mask);
        haptics.buttonClick();
        onButtonChangeRef.current(btn.mask, true);
      } else {
        pointerMapRef.current.set(e.pointerId, 0);
      }
      recalculateMasks();
    },
    [getButtonAtPoint, recalculateMasks]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointerMapRef.current.has(e.pointerId)) return;

      const currentMask = pointerMapRef.current.get(e.pointerId) || 0;
      const btn = getButtonAtPoint(e.clientX, e.clientY);
      const newMask = btn ? btn.mask : 0;

      if (currentMask !== newMask) {
        if (currentMask !== 0) {
          onButtonChangeRef.current(currentMask, false);
        }
        if (newMask !== 0) {
          haptics.buttonClick();
          onButtonChangeRef.current(newMask, true);
        }
        pointerMapRef.current.set(e.pointerId, newMask);
        recalculateMasks();
      }
    },
    [getButtonAtPoint, recalculateMasks]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointerMapRef.current.has(e.pointerId)) return;

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture safety
      }

      const mask = pointerMapRef.current.get(e.pointerId) || 0;
      if (mask !== 0) {
        onButtonChangeRef.current(mask, false);
      }
      pointerMapRef.current.delete(e.pointerId);
      recalculateMasks();
    },
    [recalculateMasks]
  );

  useEffect(() => {
    return () => {
      ACTION_BUTTONS.forEach((b) => onButtonChangeRef.current(b.mask, false));
    };
  }, []);

  const buttonSize = Math.round(size * 0.32);

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
        display: 'grid',
        gridTemplateAreas: `
          ". y ."
          "x . b"
          ". a ."
        `,
        gridTemplateColumns: `repeat(3, ${buttonSize}px)`,
        gridTemplateRows: `repeat(3, ${buttonSize}px)`,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {ACTION_BUTTONS.map((btn) => {
        const isPressed = (activeMasks & btn.mask) !== 0;
        return (
          <button
            key={btn.id}
            data-action-button="true"
            data-action-id={btn.id}
            style={{
              gridArea: btn.gridArea,
              width: `${buttonSize}px`,
              height: `${buttonSize}px`,
              borderRadius: '50%',
              backgroundColor: isPressed ? btn.color : 'rgba(10, 15, 22, 0.85)',
              border: `2px solid ${btn.color}`,
              color: isPressed ? '#000000' : btn.color,
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isPressed
                ? `0 0 18px ${btn.color}, inset 0 0 12px rgba(255, 255, 255, 0.6)`
                : `0 0 8px ${btn.color}30`,
              transform: isPressed ? 'scale(0.92)' : 'scale(1)',
              transition: 'transform 0.08s ease, background-color 0.08s ease, box-shadow 0.08s ease',
              touchAction: 'none',
              userSelect: 'none',
              pointerEvents: 'none', // Touch managed by parent container for sliding
            }}
          >
            {btn.label}
          </button>
        );
      })}
    </div>
  );
};
