/**
 * IMU Sensor Pipeline for LookARemote PWA.
 * Captures smartphone gyroscope & accelerometer via DeviceMotionEvent / Sensors API,
 * manages iOS Safari permissions, and normalizes angular velocity to rad/s and acceleration to m/s^2.
 */

export const DEG_TO_RAD = Math.PI / 180;

export interface ImuRawSample {
  /** Yaw rate in rad/s (rotation around Z axis). */
  gyroYaw: number;
  /** Pitch rate in rad/s (rotation around X axis). */
  gyroPitch: number;
  /** Roll rate in rad/s (rotation around Y axis). */
  gyroRoll: number;
  /** Linear acceleration X in m/s^2. */
  accelX: number;
  /** Linear acceleration Y in m/s^2. */
  accelY: number;
  /** Linear acceleration Z in m/s^2. */
  accelZ: number;
  /** Client microsecond timestamp. */
  timestampUs: number;
}

export type ImuPermissionStatus =
  | 'unsupported'
  | 'needs_permission'
  | 'granted'
  | 'denied'
  | 'listening'
  | 'error';

export type ImuSampleListener = (sample: ImuRawSample) => void;
export type ImuStatusListener = (status: ImuPermissionStatus) => void;

export class ImuSensorPipeline {
  private status: ImuPermissionStatus = 'unsupported';
  private listeners: Set<ImuSampleListener> = new Set();
  private statusListeners: Set<ImuStatusListener> = new Set();
  private lastSample: ImuRawSample | null = null;
  private isRunning = false;

  private boundHandleDeviceMotion = this.handleDeviceMotion.bind(this);

  constructor() {
    this.checkInitialStatus();
  }

  /**
   * Evaluates if DeviceMotionEvent is available in the current environment
   * and whether explicit permission is required (iOS 13+).
   */
  public checkInitialStatus(): ImuPermissionStatus {
    if (typeof window === 'undefined') {
      this.setStatus('unsupported');
      return this.status;
    }

    const hasDeviceMotion = 'DeviceMotionEvent' in window;
    if (!hasDeviceMotion) {
      this.setStatus('unsupported');
      return this.status;
    }

    const deviceMotionEvent = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof deviceMotionEvent?.requestPermission === 'function') {
      this.setStatus('needs_permission');
    } else {
      this.setStatus('granted');
    }

    return this.status;
  }

  public getStatus(): ImuPermissionStatus {
    return this.status;
  }

  public getLastSample(): ImuRawSample | null {
    return this.lastSample;
  }

  public onSample(listener: ImuSampleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onStatusChange(listener: ImuStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(newStatus: ImuPermissionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const listener of this.statusListeners) {
        try {
          listener(newStatus);
        } catch (e) {
          console.error('Error in ImuStatusListener:', e);
        }
      }
    }
  }

  /**
   * Requests device motion permission (required on iOS Safari via user interaction gesture).
   */
  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') {
      this.setStatus('unsupported');
      return false;
    }

    const deviceMotionEvent = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof deviceMotionEvent?.requestPermission === 'function') {
      try {
        const response = await deviceMotionEvent.requestPermission();
        if (response === 'granted') {
          this.setStatus('granted');
          return true;
        } else {
          this.setStatus('denied');
          return false;
        }
      } catch (err) {
        console.warn('DeviceMotionEvent permission request failed:', err);
        this.setStatus('error');
        return false;
      }
    }

    this.setStatus('granted');
    return true;
  }

  /**
   * Starts listening to DeviceMotionEvent stream.
   */
  public start(): boolean {
    if (this.isRunning) return true;
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      this.setStatus('unsupported');
      return false;
    }

    if (this.status === 'denied' || this.status === 'unsupported') {
      return false;
    }

    try {
      window.addEventListener('devicemotion', this.boundHandleDeviceMotion, {
        passive: true,
      });
      this.isRunning = true;
      this.setStatus('listening');
      return true;
    } catch (e) {
      console.error('Failed to attach devicemotion listener:', e);
      this.setStatus('error');
      return false;
    }
  }

  /**
   * Stops listening to DeviceMotionEvent stream.
   */
  public stop(): void {
    if (!this.isRunning) return;

    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.boundHandleDeviceMotion);
    }
    this.isRunning = false;
    if (this.status === 'listening') {
      this.setStatus('granted');
    }
  }

  /**
   * Internal handler converting browser event data into normalized ImuRawSample.
   */
  private handleDeviceMotion(event: DeviceMotionEvent): void {
    const rot = event.rotationRate;
    const acc = event.acceleration || event.accelerationIncludingGravity;

    // Convert rotation rates from degrees/sec to radians/sec
    // Standard W3C DeviceMotionEvent mapping:
    // alpha: rate of rotation around Z axis (yaw)
    // beta: rate of rotation around X axis (pitch)
    // gamma: rate of rotation around Y axis (roll)
    const rawYawDeg = rot?.alpha ?? 0;
    const rawPitchDeg = rot?.beta ?? 0;
    const rawRollDeg = rot?.gamma ?? 0;

    const gyroYaw = rawYawDeg * DEG_TO_RAD;
    const gyroPitch = rawPitchDeg * DEG_TO_RAD;
    const gyroRoll = rawRollDeg * DEG_TO_RAD;

    const accelX = acc?.x ?? 0;
    const accelY = acc?.y ?? 0;
    const accelZ = acc?.z ?? 0;

    // Microsecond timestamp
    const timestampUs = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 1000
    ) & 0xffffffff;

    const sample: ImuRawSample = {
      gyroYaw,
      gyroPitch,
      gyroRoll,
      accelX,
      accelY,
      accelZ,
      timestampUs,
    };

    this.lastSample = sample;

    for (const listener of this.listeners) {
      try {
        listener(sample);
      } catch (e) {
        console.error('Error in ImuSampleListener:', e);
      }
    }
  }
}
