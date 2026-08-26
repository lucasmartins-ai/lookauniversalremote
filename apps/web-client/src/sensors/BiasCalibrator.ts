/**
 * Static Bias Auto-Calibrator for MEMS Gyroscopes.
 * Collects 100+ resting samples to cancel zero-rate drift and detect unwanted device movement.
 */

import { ImuRawSample, ImuSensorPipeline } from './ImuSensorPipeline';

export interface GyroBias {
  biasYaw: number;
  biasPitch: number;
  biasRoll: number;
}

export interface CalibrationResult {
  bias: GyroBias;
  variance: {
    yaw: number;
    pitch: number;
    roll: number;
  };
  sampleCount: number;
}

export const GYRO_BIAS_STORAGE_KEY = 'lookaremote_gyro_bias_v1';
export const DEFAULT_CALIBRATION_SAMPLES = 120;
// Maximum allowed angular velocity variance during static calibration (~0.005 rad^2/s^2)
export const MAX_ALLOWED_STATIC_VARIANCE = 0.005;

export type CalibrationStatus = 'idle' | 'calibrating' | 'calibrated' | 'failed';

export class BiasCalibrator {
  private bias: GyroBias = { biasYaw: 0, biasPitch: 0, biasRoll: 0 };
  private status: CalibrationStatus = 'idle';
  private calibrated = false;

  // Active calibration state
  private samples: ImuRawSample[] = [];
  private targetSamples = DEFAULT_CALIBRATION_SAMPLES;
  private progressCallback: ((progressPct: number, currentNoise: number) => void) | null = null;
  private unbindPipeline: (() => void) | null = null;
  private resolveCalibration: ((res: CalibrationResult) => void) | null = null;
  private rejectCalibration: ((err: Error) => void) | null = null;

  constructor() {
    this.loadFromStorage();
  }

  public getStatus(): CalibrationStatus {
    return this.status;
  }

  public isCalibrated(): boolean {
    return this.calibrated;
  }

  public getBias(): GyroBias {
    return { ...this.bias };
  }

  public setBias(newBias: GyroBias): void {
    this.bias = { ...newBias };
    this.calibrated = true;
    this.status = 'calibrated';
    this.saveToStorage();
  }

  public clearBias(): void {
    this.bias = { biasYaw: 0, biasPitch: 0, biasRoll: 0 };
    this.calibrated = false;
    this.status = 'idle';
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(GYRO_BIAS_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  }

  /**
   * Applies bias subtraction to a live raw IMU sample.
   */
  public applyBias(sample: ImuRawSample): ImuRawSample {
    return {
      ...sample,
      gyroYaw: sample.gyroYaw - this.bias.biasYaw,
      gyroPitch: sample.gyroPitch - this.bias.biasPitch,
      gyroRoll: sample.gyroRoll - this.bias.biasRoll,
    };
  }

  /**
   * Starts an automated static calibration routine collecting resting samples from an ImuSensorPipeline.
   */
  public startCalibration(
    pipeline: ImuSensorPipeline,
    sampleCount = DEFAULT_CALIBRATION_SAMPLES,
    onProgress?: (progressPct: number, currentNoise: number) => void
  ): Promise<CalibrationResult> {
    this.cancelCalibration();

    this.samples = [];
    this.targetSamples = Math.max(20, sampleCount);
    this.progressCallback = onProgress ?? null;
    this.status = 'calibrating';

    return new Promise<CalibrationResult>((resolve, reject) => {
      this.resolveCalibration = resolve;
      this.rejectCalibration = reject;

      // Start pipeline listening if not already running
      pipeline.start();

      this.unbindPipeline = pipeline.onSample((sample) => {
        this.accumulateSample(sample);
      });
    });
  }

  /**
   * Feeds a sample into the calibration accumulator.
   */
  public accumulateSample(sample: ImuRawSample): void {
    if (this.status !== 'calibrating') return;

    this.samples.push(sample);

    const count = this.samples.length;
    const progressPct = Math.min(100, Math.round((count / this.targetSamples) * 100));

    // Calculate instantaneous noise/energy of the latest samples
    const currentNoise = Math.sqrt(
      sample.gyroYaw * sample.gyroYaw +
      sample.gyroPitch * sample.gyroPitch +
      sample.gyroRoll * sample.gyroRoll
    );

    if (this.progressCallback) {
      try {
        this.progressCallback(progressPct, currentNoise);
      } catch (e) {
        console.error('Error in calibration progress callback:', e);
      }
    }

    if (count >= this.targetSamples) {
      this.finishCalibration();
    }
  }

  /**
   * Cancels any in-flight calibration.
   */
  public cancelCalibration(): void {
    if (this.unbindPipeline) {
      this.unbindPipeline();
      this.unbindPipeline = null;
    }
    if (this.rejectCalibration) {
      this.rejectCalibration(new Error('Calibration was cancelled'));
      this.rejectCalibration = null;
      this.resolveCalibration = null;
    }
    this.samples = [];
    this.progressCallback = null;
    if (this.status === 'calibrating') {
      this.status = this.calibrated ? 'calibrated' : 'idle';
    }
  }

  private finishCalibration(): void {
    if (this.unbindPipeline) {
      this.unbindPipeline();
      this.unbindPipeline = null;
    }

    const n = this.samples.length;
    if (n === 0) {
      this.status = 'failed';
      this.rejectCalibration?.(new Error('No samples collected during calibration'));
      return;
    }

    // 1. Calculate Means
    let sumYaw = 0;
    let sumPitch = 0;
    let sumRoll = 0;

    for (const s of this.samples) {
      sumYaw += s.gyroYaw;
      sumPitch += s.gyroPitch;
      sumRoll += s.gyroRoll;
    }

    const meanYaw = sumYaw / n;
    const meanPitch = sumPitch / n;
    const meanRoll = sumRoll / n;

    // 2. Calculate Variance
    let varYaw = 0;
    let varPitch = 0;
    let varRoll = 0;

    for (const s of this.samples) {
      varYaw += (s.gyroYaw - meanYaw) ** 2;
      varPitch += (s.gyroPitch - meanPitch) ** 2;
      varRoll += (s.gyroRoll - meanRoll) ** 2;
    }

    varYaw /= n;
    varPitch /= n;
    varRoll /= n;

    const maxVariance = Math.max(varYaw, varPitch, varRoll);

    // Check if the device was disturbed during calibration
    if (maxVariance > MAX_ALLOWED_STATIC_VARIANCE) {
      this.status = 'failed';
      const err = new Error(
        `Device movement detected during calibration (variance: ${maxVariance.toFixed(5)} > ${MAX_ALLOWED_STATIC_VARIANCE}). Keep device completely still.`
      );
      this.rejectCalibration?.(err);
      return;
    }

    // 3. Save result
    this.bias = {
      biasYaw: meanYaw,
      biasPitch: meanPitch,
      biasRoll: meanRoll,
    };
    this.calibrated = true;
    this.status = 'calibrated';
    this.saveToStorage();

    const result: CalibrationResult = {
      bias: this.getBias(),
      variance: { yaw: varYaw, pitch: varPitch, roll: varRoll },
      sampleCount: n,
    };

    this.resolveCalibration?.(result);
    this.resolveCalibration = null;
    this.rejectCalibration = null;
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(GYRO_BIAS_STORAGE_KEY, JSON.stringify(this.bias));
    } catch (e) {
      console.warn('Failed to save gyro bias to localStorage:', e);
    }
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(GYRO_BIAS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          typeof parsed.biasYaw === 'number' &&
          typeof parsed.biasPitch === 'number' &&
          typeof parsed.biasRoll === 'number'
        ) {
          this.bias = parsed;
          this.calibrated = true;
          this.status = 'calibrated';
        }
      }
    } catch {
      // Fallback
    }
  }
}
