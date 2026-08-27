import React, { useRef, useState, useCallback, useEffect } from 'react';
import { GamepadButtonMask } from '@lookaremote/protocol-types';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface ActionButtonDef {
  id: 'a' | 'b' | 'x' | 'y';
  label: string;
  mask: number;
  color: string;
  bgGrad: string;
  bgPressed: string;
  shadowBase: string;
  shadowPressed: string;
  gridArea: string;
}

const ACTION_BUTTONS: ActionButtonDef[] = [
  {
    id: 'y',
    label: 'Y',
    mask: GamepadButtonMask.BTN_NORTH, // 0x0080
    color: '#1a0e00',
    bgGrad: 'linear-gradient(180deg, #ffd166 0%, #ffb703 50%, #b37400 100%)',
    bgPressed: 'linear-gradient(180deg, #b37400 0%, #ffb703 100%)',
    shadowBase: 'var(--neo-shadow-button-amber)',
    shadowPressed: 'var(--neo-shadow-button-amber-pressed)',
    gridArea: 'y',
  },
  {
    id: 'x',
    label: 'X',
    mask: GamepadButtonMask.BTN_WEST, // 0x0040
    color: '#040d1a',
    bgGrad: 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #007791 100%)',
    bgPressed: 'linear-gradient(180deg, #007791 0%, #00b4d8 100%)',
    shadowBase: 'var(--neo-shadow-button-cyan)',
    shadowPressed: 'var(--neo-shadow-button-cyan-pressed)',
    gridArea: 'x',
  },
  {
    id: 'b',
    label: 'B',
    mask: GamepadButtonMask.BTN_EAST, // 0x0020
    color: '#ffffff',
    bgGrad: 'linear-gradient(180deg, #ff3366 0%, #e60039 50%, #9e0c29 100%)',
    bgPressed: 'linear-gradient(180deg, #9e0c29 0%, #e60039 100%)',
    shadowBase: 'var(--neo-shadow-button-red)',
    shadowPressed: 'var(--neo-shadow-button-red-pressed)',
    gridArea: 'b',
  },
  {
    id: 'a',
    label: 'A',
    mask: GamepadButtonMask.BTN_SOUTH, // 0x0010
    color: '#03140a',
    bgGrad: 'linear-gradient(180deg, #00f59b 0%, #00cc7a 50%, #007a47 100%)',
    bgPressed: 'linear-gradient(180deg, #007a47 0%, #00cc7a 100%)',
    shadowBase: 'var(--neo-shadow-button-green)',
    shadowPressed: 'var(--neo-shadow-button-green-pressed)',
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
  const pointerMapRef = useRef<Map<number, number>>(new Map());
  const [activeMasks, setActiveMasks] = useState<number>(0);

  const onButtonChangeRef = useRef(onButtonChange);
  onButtonChangeRef.current = onButtonChange;

  const getButtonAtPoint = useCallback((clientX: number, clientY: number): ActionButtonDef | null => {
    if (!containerRef.current) return null;

    const buttons = containerRef.current.querySelectorAll<HTMLButtonElement>('[data-action-button]');
    for (const btn of Array.from(buttons)) {
      const rect = btn.getBoundingClientRect();
      const padding = 8;
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

  const buttonSize = Math.round(size * 0.33);

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
        padding: '6px',
        boxShadow: 'var(--neo-shadow-sunken)',
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
              background: isPressed ? btn.bgPressed : btn.bgGrad,
              color: btn.color,
              fontFamily: 'var(--font-display)',
              fontSize: '1.35rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isPressed ? btn.shadowPressed : btn.shadowBase,
              borderTop: isPressed ? 'none' : '1.5px solid rgba(255, 255, 255, 0.7)',
              borderLeft: isPressed ? 'none' : '1px solid rgba(255, 255, 255, 0.5)',
              borderBottom: isPressed ? '1px solid rgba(0, 0, 0, 0.6)' : '2px solid rgba(0, 0, 0, 0.8)',
              borderRight: isPressed ? '1px solid rgba(0, 0, 0, 0.6)' : '1px solid rgba(0, 0, 0, 0.8)',
              transform: isPressed ? 'translateY(3px) scale(0.96)' : 'translateY(0) scale(1)',
              transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.08s ease',
              touchAction: 'none',
              userSelect: 'none',
              pointerEvents: 'none',
              textShadow: isPressed ? 'none' : '0 1px 1px rgba(255, 255, 255, 0.4)',
            }}
          >
            {btn.label}
          </button>
        );
      })}
    </div>
  );
};
