/**
 * Gyroscope Aiming Controller.
 * Manages activation modes (Always On, Hold LT, Toggle Aim, Disabled),
 * gates motion streaming, and coordinates ImuSensorPipeline, BiasCalibrator, and MotionFilters.
 */

import { BiasCalibrator } from './BiasCalibrator';
import { FilteredMotion, MotionFilters, MotionFilterOptions } from './MotionFilters';
import { ImuRawSample, ImuSensorPipeline } from './ImuSensorPipeline';

export type GyroAimMode = 'disabled' | 'always_on' | 'hold_lt' | 'toggle';

export interface GyroAimControllerConfig {
  aimMode: GyroAimMode;
  ltThreshold: number; // 0 to 255 (default: 25)
  filterOptions: Partial<MotionFilterOptions>;
}

export const DEFAULT_AIM_CONFIG: GyroAimControllerConfig = {
  aimMode: 'always_on',
  ltThreshold: 25,
  filterOptions: {},
};

export class GyroAimController {
  private config: GyroAimControllerConfig;
  private readonly pipeline: ImuSensorPipeline;
  private readonly calibrator: BiasCalibrator;
  private readonly filters: MotionFilters;

  private isToggleActive = false;
  private isLtHeld = false;
  private isAimButtonHeld = false;
  private isRunning = false;

  private unbindPipeline: (() => void) | null = null;
  private latestRawSample: ImuRawSample | null = null;

  constructor(
    pipeline: ImuSensorPipeline,
    calibrator: BiasCalibrator,
    config: Partial<GyroAimControllerConfig> = {}
  ) {
    this.pipeline = pipeline;
    this.calibrator = calibrator;
    this.config = { ...DEFAULT_AIM_CONFIG, ...config };
    this.filters = new MotionFilters(this.config.filterOptions);
  }

  public getPipeline(): ImuSensorPipeline {
    return this.pipeline;
  }

  public getCalibrator(): BiasCalibrator {
    return this.calibrator;
  }

  public getFilters(): MotionFilters {
    return this.filters;
  }

  public setConfig(newConfig: Partial<GyroAimControllerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.filterOptions) {
      this.filters.setOptions(newConfig.filterOptions);
    }
  }

  public getConfig(): GyroAimControllerConfig {
    return { ...this.config };
  }

  public setAimMode(mode: GyroAimMode): void {
    this.config.aimMode = mode;
  }

  public toggleAim(): boolean {
    this.isToggleActive = !this.isToggleActive;
    return this.isToggleActive;
  }

  public setToggleActive(active: boolean): void {
    this.isToggleActive = active;
  }

  /**
   * Updates current gamepad input state to evaluate Hold-to-Aim triggers.
   */
  public updateGamepadInputs(triggerL: number, isAimButtonPressed = false): void {
    this.isLtHeld = triggerL >= this.config.ltThreshold;
    this.isAimButtonHeld = isAimButtonPressed;
  }

  /**
   * Evaluates if gyro aiming is currently active based on configured trigger mode.
   */
  public isAimActive(): boolean {
    if (this.config.aimMode === 'disabled') return false;
    if (this.calibrator.getStatus() === 'calibrating') return false;

    switch (this.config.aimMode) {
      case 'always_on':
        return true;
      case 'hold_lt':
        return this.isLtHeld || this.isAimButtonHeld;
      case 'toggle':
        return this.isToggleActive;
      default:
        return false;
    }
  }

  public start(): boolean {
    if (this.isRunning) return true;

    this.isRunning = true;
    this.pipeline.start();

    this.unbindPipeline = this.pipeline.onSample((sample) => {
      this.latestRawSample = sample;
    });

    return true;
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.unbindPipeline) {
      this.unbindPipeline();
      this.unbindPipeline = null;
    }
    this.pipeline.stop();
    this.filters.reset();
  }

  /**
   * Returns processed and filtered motion snapshot if aiming is active.
   * If inactive or resting, returns neutral zero motion or null.
   */
  public getMotionSnapshot(): FilteredMotion | null {
    if (!this.isRunning || !this.isAimActive()) {
      return null;
    }

    const raw = this.latestRawSample || this.pipeline.getLastSample();
    if (!raw) return null;

    // 1. Subtract static bias offset
    const biasCorrected = this.calibrator.applyBias(raw);

    // 2. Apply DSP filters (deadzone, smoothing, yaw-roll combination, sensitivity)
    return this.filters.processSample(biasCorrected);
  }
}
