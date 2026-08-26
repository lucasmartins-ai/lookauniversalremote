/**
 * Decoupled high-rate Motion Sampler loop for LookARemote PWA.
 * Periodically queries motion state, quantizes to binary protocol fixed-point format,
 * and transmits MSG_MOTION (0x01) frames via ProtocolBridge.
 */

import { ProtocolBridge } from '../transport/ProtocolBridge';
import { FilteredMotion } from './MotionFilters';

export type MotionStateProvider = () => FilteredMotion | null;

export class MotionSampler {
  private timerId: number | null = null;
  private isSampling = false;
  private intervalMs: number;
  private packetCount = 0;

  constructor(
    private readonly bridge: ProtocolBridge,
    private readonly provider: MotionStateProvider,
    private sampleRateHz: number = 120
  ) {
    this.intervalMs = 1000 / Math.max(1, sampleRateHz);
  }

  public setSampleRate(sampleRateHz: number): void {
    this.sampleRateHz = Math.max(1, sampleRateHz);
    this.intervalMs = 1000 / this.sampleRateHz;

    if (this.isSampling) {
      this.stop();
      this.start();
    }
  }

  public getSampleRate(): number {
    return this.sampleRateHz;
  }

  public getPacketCount(): number {
    return this.packetCount;
  }

  public isRunning(): boolean {
    return this.isSampling;
  }

  public start(): void {
    if (this.isSampling) return;
    this.isSampling = true;

    const tick = () => {
      this.sampleAndSend();
    };

    this.timerId = window.setInterval(tick, this.intervalMs);
  }

  public stop(): void {
    if (!this.isSampling) return;
    this.isSampling = false;

    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public sampleAndSend(): boolean {
    const motion = this.provider();
    if (!motion) return false;

    // Convert rad/s to protocol fixed point (rad/s * 1000 in i16)
    // Convert m/s^2 to protocol fixed point (m/s^2 * 100 in i16)
    const clampI16 = (val: number) => Math.max(-32768, Math.min(32767, Math.round(val)));

    const gyroYaw = clampI16(motion.aimYaw * 1000);
    const gyroPitch = clampI16(motion.aimPitch * 1000);
    const gyroRoll = clampI16(motion.aimRoll * 1000);

    const accelX = clampI16(motion.accelX * 100);
    const accelY = clampI16(motion.accelY * 100);
    const accelZ = clampI16(motion.accelZ * 100);

    const timestampUs =
      motion.timestampUs ||
      (Math.round(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 1000
      ) & 0xffffffff);

    const sent = this.bridge.sendMotion({
      gyroYaw,
      gyroPitch,
      gyroRoll,
      accelX,
      accelY,
      accelZ,
      timestampUs,
    });

    if (sent) {
      this.packetCount++;
    }

    return sent;
  }
}
