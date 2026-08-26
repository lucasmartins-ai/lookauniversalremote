import { useRef, useCallback } from 'react';
import { GamepadButtonMask, type GamepadFullPayload } from '@lookaremote/protocol-types';

export interface GamepadStateHolder {
  setButton: (mask: number, pressed: boolean) => void;
  setDPad: (mask: number) => void;
  setLeftStick: (x: number, y: number) => void;
  setRightStick: (x: number, y: number) => void;
  setTrigger: (side: 'left' | 'right', value: number) => void;
  setBumper: (side: 'left' | 'right', pressed: boolean) => void;
  resetAll: () => void;
  getSnapshot: () => Omit<GamepadFullPayload, 'type'>;
}

const DPAD_ALL_MASK =
  GamepadButtonMask.DPAD_UP |
  GamepadButtonMask.DPAD_DOWN |
  GamepadButtonMask.DPAD_LEFT |
  GamepadButtonMask.DPAD_RIGHT;

export function useGamepadState(): GamepadStateHolder {
  const stateRef = useRef<Omit<GamepadFullPayload, 'type'>>({
    buttons: 0,
    stickLx: 0,
    stickLy: 0,
    stickRx: 0,
    stickRy: 0,
    triggerL: 0,
    triggerR: 0,
    reserved: 0,
  });

  const setButton = useCallback((mask: number, pressed: boolean) => {
    if (pressed) {
      stateRef.current.buttons |= mask;
    } else {
      stateRef.current.buttons &= ~mask;
    }
  }, []);

  const setDPad = useCallback((mask: number) => {
    // Clear existing D-Pad bits and apply new direction mask
    stateRef.current.buttons = (stateRef.current.buttons & ~DPAD_ALL_MASK) | (mask & DPAD_ALL_MASK);
  }, []);

  const setLeftStick = useCallback((x: number, y: number) => {
    stateRef.current.stickLx = x;
    stateRef.current.stickLy = y;
  }, []);

  const setRightStick = useCallback((x: number, y: number) => {
    stateRef.current.stickRx = x;
    stateRef.current.stickRy = y;
  }, []);

  const setTrigger = useCallback((side: 'left' | 'right', value: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    if (side === 'left') {
      stateRef.current.triggerL = clamped;
    } else {
      stateRef.current.triggerR = clamped;
    }
  }, []);

  const setBumper = useCallback((side: 'left' | 'right', pressed: boolean) => {
    const mask = side === 'left' ? GamepadButtonMask.BTN_L1 : GamepadButtonMask.BTN_R1;
    if (pressed) {
      stateRef.current.buttons |= mask;
    } else {
      stateRef.current.buttons &= ~mask;
    }
  }, []);

  const resetAll = useCallback(() => {
    stateRef.current.buttons = 0;
    stateRef.current.stickLx = 0;
    stateRef.current.stickLy = 0;
    stateRef.current.stickRx = 0;
    stateRef.current.stickRy = 0;
    stateRef.current.triggerL = 0;
    stateRef.current.triggerR = 0;
    stateRef.current.reserved = 0;
  }, []);

  const getSnapshot = useCallback((): Omit<GamepadFullPayload, 'type'> => {
    return {
      buttons: stateRef.current.buttons,
      stickLx: stateRef.current.stickLx,
      stickLy: stateRef.current.stickLy,
      stickRx: stateRef.current.stickRx,
      stickRy: stateRef.current.stickRy,
      triggerL: stateRef.current.triggerL,
      triggerR: stateRef.current.triggerR,
      reserved: stateRef.current.reserved,
    };
  }, []);

  return {
    setButton,
    setDPad,
    setLeftStick,
    setRightStick,
    setTrigger,
    setBumper,
    resetAll,
    getSnapshot,
  };
}
