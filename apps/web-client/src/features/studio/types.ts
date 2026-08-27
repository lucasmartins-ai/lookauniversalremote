/**
 * Types and interfaces for the Custom Touch Layout Studio.
 */

export type TouchElementType =
  | 'stick'
  | 'button'
  | 'dpad'
  | 'trigger'
  | 'macro'
  | 'turbo'
  | 'touchpad';

export interface ElementMapping {
  /** Gamepad button bitmask flag (e.g. 0x0001 for BTN_SOUTH) */
  buttonBit?: number;
  /** Axis mapping for virtual thumbsticks */
  axisX?: 'stick_lx' | 'stick_rx';
  axisY?: 'stick_ly' | 'stick_ry';
  /** Rate in Hz for Turbo auto-fire buttons (5 to 30 Hz) */
  turboRateHz?: number;
  /** Sequential button bitmasks for Macro combos executed with timed delays */
  macroSequence?: number[];
  /** Delay between macro sequence steps in milliseconds (default 50ms) */
  macroStepDelayMs?: number;
  /** Secondary trigger axis or sensitivity */
  triggerSide?: 'left' | 'right';
}

export interface StudioElement {
  id: string;
  type: TouchElementType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  mapping: ElementMapping;
}

export interface CustomLayout {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  elements: StudioElement[];
  gridSnap: number;
  isPreset?: boolean;
  createdAt: number;
  updatedAt: number;
}
