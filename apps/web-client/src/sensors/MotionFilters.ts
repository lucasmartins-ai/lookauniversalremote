/**
 * DSP Filters and Motion Processors for LookARemote PWA.
 * Includes Radial Angular Deadzones, Low-Pass Exponential Moving Average (EMA) smoothing,
 * Yaw-Roll combination for Splatoon/Steam Deck style aiming, and sensitivity scaling.
 */

import { ImuRawSample } from './ImuSensorPipeline';

export type SmoothingPreset = 'none' | 'light' | 'medium' | 'heavy';

export interface MotionFilterOptions {
  /** Radial deadzone in rad/s (default: 0.02 rad/s). */
  deadzoneRad: number;
  /** Smoothing preset or raw alpha factor in (0, 1]. */
  smoothing: SmoothingPreset | number;
  /** Sensitivity multiplier for horizontal aim (default: 1.0). */
  sensitivityX: number;
  /** Sensitivity multiplier for vertical aim (default: 1.0). */
  sensitivityY: number;
  /** Invert horizontal axis (default: false). */
  invertX: boolean;
  /** Invert vertical axis (default: false). */
  invertY: boolean;
  /** Yaw/Roll mix factor in [0.0, 1.0] for landscape aim (default: 0.25). */
  rollMix: number;
}

export const DEFAULT_FILTER_OPTIONS: MotionFilterOptions = {
  deadzoneRad: 0.02,
  smoothing: 'light',
  sensitivityX: 1.0,
  sensitivityY: 1.0,
  invertX: false,
  invertY: false,
  rollMix: 0.25,
};

export const SMOOTHING_ALPHA_MAP: Record<SmoothingPreset, number> = {
  none: 1.0,
  light: 0.85,
  medium: 0.65,
  heavy: 0.45,
};

export interface FilteredMotion {
  /** Processed horizontal angular velocity in rad/s. */
  aimYaw: number;
  /** Processed vertical angular velocity in rad/s. */
  aimPitch: number;
  /** Processed roll velocity in rad/s. */
  aimRoll: number;
  /** Raw acceleration X in m/s^2. */
  accelX: number;
  /** Raw acceleration Y in m/s^2. */
  accelY: number;
  /** Raw acceleration Z in m/s^2. */
  accelZ: number;
  /** Timestamp in microseconds. */
  timestampUs: number;
}

export class MotionFilters {
  private options: MotionFilterOptions;
  private prevYaw = 0;
  private prevPitch = 0;
  private prevRoll = 0;
  private hasPrev = false;

  constructor(options: Partial<MotionFilterOptions> = {}) {
    this.options = { ...DEFAULT_FILTER_OPTIONS, ...options };
  }

  public setOptions(newOptions: Partial<MotionFilterOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  public getOptions(): MotionFilterOptions {
    return { ...this.options };
  }

  public reset(): void {
    this.prevYaw = 0;
    this.prevPitch = 0;
    this.prevRoll = 0;
    this.hasPrev = false;
  }

  /**
   * Applies full DSP pipeline to a bias-corrected IMU sample.
   */
  public processSample(sample: ImuRawSample): FilteredMotion {
    const {
      deadzoneRad,
      smoothing,
      sensitivityX,
      sensitivityY,
      invertX,
      invertY,
      rollMix,
    } = this.options;

    // 1. Yaw-Roll Aim Combination
    // For mobile landscape gaming, tilting phone sideways (roll) and turning (yaw) both contribute to horizontal aim
    let rawHorizontal = sample.gyroYaw + sample.gyroRoll * rollMix;
    let rawVertical = sample.gyroPitch;
    let rawRoll = sample.gyroRoll;

    // 2. Radial Angular Deadzone Thresholding
    const magnitude = Math.hypot(rawHorizontal, rawVertical);

    if (magnitude <= deadzoneRad || magnitude === 0) {
      rawHorizontal = 0;
      rawVertical = 0;
    } else {
      // Linear rescaling above deadzone to avoid abrupt step response
      const scale = (magnitude - deadzoneRad) / (magnitude * (1 - Math.min(0.99, deadzoneRad)));
      rawHorizontal *= scale;
      rawVertical *= scale;
    }

    // 3. Low-Pass / EMA Smoothing Filter (<2ms phase delay)
    const alpha =
      typeof smoothing === 'number'
        ? Math.max(0.01, Math.min(1.0, smoothing))
        : (SMOOTHING_ALPHA_MAP[smoothing] ?? 0.85);

    let filteredYaw = rawHorizontal;
    let filteredPitch = rawVertical;
    let filteredRoll = rawRoll;

    if (this.hasPrev && alpha < 1.0) {
      filteredYaw = alpha * rawHorizontal + (1 - alpha) * this.prevYaw;
      filteredPitch = alpha * rawVertical + (1 - alpha) * this.prevPitch;
      filteredRoll = alpha * rawRoll + (1 - alpha) * this.prevRoll;
    }

    this.prevYaw = filteredYaw;
    this.prevPitch = filteredPitch;
    this.prevRoll = filteredRoll;
    this.hasPrev = true;

    // 4. Inversion & Sensitivity Scaling
    const aimYaw = filteredYaw * sensitivityX * (invertX ? -1 : 1);
    const aimPitch = filteredPitch * sensitivityY * (invertY ? -1 : 1);
    const aimRoll = filteredRoll;

    return {
      aimYaw,
      aimPitch,
      aimRoll,
      accelX: sample.accelX,
      accelY: sample.accelY,
      accelZ: sample.accelZ,
      timestampUs: sample.timestampUs,
    };
  }

  /**
   * Helper static function for pure radial deadzone computation.
   */
  public static applyRadialDeadzone(
    x: number,
    y: number,
    deadzone: number
  ): { x: number; y: number } {
    const mag = Math.hypot(x, y);
    if (mag <= deadzone || mag === 0) {
      return { x: 0, y: 0 };
    }
    const scale = (mag - deadzone) / (mag * (1 - Math.min(0.99, deadzone)));
    return { x: x * scale, y: y * scale };
  }
}
