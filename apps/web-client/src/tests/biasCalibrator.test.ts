import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BiasCalibrator, GYRO_BIAS_STORAGE_KEY } from '../sensors/BiasCalibrator';
import { ImuRawSample, ImuSensorPipeline } from '../sensors/ImuSensorPipeline';

describe('BiasCalibrator', () => {
  let calibrator: BiasCalibrator;
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };

    (globalThis as any).localStorage = mockLocalStorage;
    calibrator = new BiasCalibrator();
  });

  it('calculates mean offset and cancels drift on resting samples', async () => {
    const pipeline = new ImuSensorPipeline();
    const progressSpy = vi.fn();

    // Constant drift of 0.05 rad/s yaw, -0.02 rad/s pitch, 0.01 rad/s roll with tiny noise
    const calibrationPromise = calibrator.startCalibration(pipeline, 50, progressSpy);

    for (let i = 0; i < 50; i++) {
      const noise = (Math.random() - 0.5) * 0.0001;
      calibrator.accumulateSample({
        gyroYaw: 0.05 + noise,
        gyroPitch: -0.02 + noise,
        gyroRoll: 0.01 + noise,
        accelX: 0,
        accelY: 0,
        accelZ: 9.81,
        timestampUs: 1000 * i,
      });
    }

    const result = await calibrationPromise;

    expect(result.bias.biasYaw).toBeCloseTo(0.05, 3);
    expect(result.bias.biasPitch).toBeCloseTo(-0.02, 3);
    expect(result.bias.biasRoll).toBeCloseTo(0.01, 3);
    expect(result.sampleCount).toBe(50);
    expect(calibrator.isCalibrated()).toBe(true);
    expect(progressSpy).toHaveBeenCalled();

    // Verify applyBias subtracts calculated offset
    const sample: ImuRawSample = {
      gyroYaw: 0.05,
      gyroPitch: -0.02,
      gyroRoll: 0.01,
      accelX: 0,
      accelY: 0,
      accelZ: 9.81,
      timestampUs: 50000,
    };

    const corrected = calibrator.applyBias(sample);
    expect(corrected.gyroYaw).toBeCloseTo(0.0, 3);
    expect(corrected.gyroPitch).toBeCloseTo(0.0, 3);
    expect(corrected.gyroRoll).toBeCloseTo(0.0, 3);
  });

  it('rejects calibration if device movement / high variance is detected', async () => {
    const pipeline = new ImuSensorPipeline();
    const calibrationPromise = calibrator.startCalibration(pipeline, 50);

    // Feed erratic samples with high variance
    for (let i = 0; i < 50; i++) {
      calibrator.accumulateSample({
        gyroYaw: i % 2 === 0 ? 0.8 : -0.8, // Shaking device
        gyroPitch: 0,
        gyroRoll: 0,
        accelX: 0,
        accelY: 0,
        accelZ: 9.81,
        timestampUs: 1000 * i,
      });
    }

    await expect(calibrationPromise).rejects.toThrow(/Device movement detected/i);
    expect(calibrator.getStatus()).toBe('failed');
  });

  it('persists and restores bias from localStorage', () => {
    const bias = { biasYaw: 0.035, biasPitch: -0.012, biasRoll: 0.008 };
    calibrator.setBias(bias);

    expect(globalThis.localStorage.getItem(GYRO_BIAS_STORAGE_KEY)).toBe(JSON.stringify(bias));

    // Create a new instance and check auto-restore
    const newCalibrator = new BiasCalibrator();
    expect(newCalibrator.isCalibrated()).toBe(true);
    expect(newCalibrator.getBias()).toEqual(bias);

    // Clear bias
    newCalibrator.clearBias();
    expect(newCalibrator.isCalibrated()).toBe(false);
    expect(globalThis.localStorage.getItem(GYRO_BIAS_STORAGE_KEY)).toBeNull();
  });

  it('handles cancellation properly', async () => {
    const pipeline = new ImuSensorPipeline();
    const promise = calibrator.startCalibration(pipeline, 100);

    calibrator.cancelCalibration();

    await expect(promise).rejects.toThrow(/cancelled/i);
    expect(calibrator.getStatus()).toBe('idle');
  });
});
