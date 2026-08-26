import { describe, it, expect, beforeEach } from 'vitest';
import { MotionFilters } from '../sensors/MotionFilters';
import { ImuRawSample } from '../sensors/ImuSensorPipeline';

describe('MotionFilters', () => {
  let filters: MotionFilters;

  const createSample = (
    gyroYaw: number,
    gyroPitch: number,
    gyroRoll = 0,
    timestampUs = 1000
  ): ImuRawSample => ({
    gyroYaw,
    gyroPitch,
    gyroRoll,
    accelX: 0,
    accelY: 0,
    accelZ: 9.81,
    timestampUs,
  });

  beforeEach(() => {
    filters = new MotionFilters({
      deadzoneRad: 0.05,
      smoothing: 'none',
      sensitivityX: 1.0,
      sensitivityY: 1.0,
      invertX: false,
      invertY: false,
      rollMix: 0.0,
    });
  });

  it('eliminates sub-deadzone micro-jitter and rescales smoothly above deadzone', () => {
    // 1. Jitter below deadzone (magnitude = 0.03 < 0.05)
    const jitterSample = createSample(0.02, 0.02);
    const jitterFiltered = filters.processSample(jitterSample);
    expect(jitterFiltered.aimYaw).toBe(0);
    expect(jitterFiltered.aimPitch).toBe(0);

    // 2. Motion above deadzone (magnitude = 0.10 > 0.05)
    filters.reset();
    const activeSample = createSample(0.10, 0.0);
    const activeFiltered = filters.processSample(activeSample);
    expect(activeFiltered.aimYaw).toBeGreaterThan(0);
    expect(activeFiltered.aimPitch).toBe(0);
    // Linear scaling: (0.10 - 0.05) / (0.10 * (1 - 0.05)) * 0.10 = 0.05 / 0.95 ≈ 0.05263
    expect(activeFiltered.aimYaw).toBeCloseTo(0.0526, 3);
  });

  it('applies low-pass Exponential Moving Average (EMA) smoothing', () => {
    filters.setOptions({
      deadzoneRad: 0,
      smoothing: 0.5, // 50% smoothing
    });

    // Step input from 0 to 1.0 rad/s
    const first = filters.processSample(createSample(1.0, 0));
    expect(first.aimYaw).toBe(1.0); // first sample sets initial baseline

    const second = filters.processSample(createSample(1.0, 0));
    // 0.5 * 1.0 + 0.5 * 1.0 = 1.0
    expect(second.aimYaw).toBe(1.0);

    // Sudden drop to 0.0
    const drop = filters.processSample(createSample(0.0, 0));
    // 0.5 * 0.0 + 0.5 * 1.0 = 0.5
    expect(drop.aimYaw).toBe(0.5);
  });

  it('combines roll and yaw for horizontal aiming based on rollMix parameter', () => {
    filters.setOptions({
      deadzoneRad: 0,
      smoothing: 'none',
      rollMix: 0.5, // 50% roll contribution
    });

    // Pure roll = 1.0 rad/s, yaw = 0.5 rad/s -> horizontal aim = 0.5 + 1.0 * 0.5 = 1.0 rad/s
    const sample = createSample(0.5, 0.2, 1.0);
    const filtered = filters.processSample(sample);

    expect(filtered.aimYaw).toBeCloseTo(1.0, 4);
    expect(filtered.aimPitch).toBeCloseTo(0.2, 4);
    expect(filtered.aimRoll).toBeCloseTo(1.0, 4);
  });

  it('applies sensitivity multipliers and axis inversion correctly', () => {
    filters.setOptions({
      deadzoneRad: 0,
      smoothing: 'none',
      sensitivityX: 2.0,
      sensitivityY: 1.5,
      invertX: true,
      invertY: true,
    });

    const sample = createSample(0.5, 0.4);
    const filtered = filters.processSample(sample);

    expect(filtered.aimYaw).toBeCloseTo(-1.0, 4); // 0.5 * 2.0 * (-1)
    expect(filtered.aimPitch).toBeCloseTo(-0.6, 4); // 0.4 * 1.5 * (-1)
  });

  it('applyRadialDeadzone static helper behaves predictably', () => {
    const zero = MotionFilters.applyRadialDeadzone(0.01, 0.01, 0.05);
    expect(zero.x).toBe(0);
    expect(zero.y).toBe(0);

    const scaled = MotionFilters.applyRadialDeadzone(0.1, 0, 0.05);
    expect(scaled.x).toBeCloseTo(0.0526, 3);
    expect(scaled.y).toBe(0);
  });
});
