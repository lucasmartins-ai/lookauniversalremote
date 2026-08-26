/**
 * LookARemote Haptics Engine
 * Provides low-latency tactile feedback via the Web Vibration API.
 */

export class HapticEngine {
  private static instance: HapticEngine;
  private enabled = true;

  private constructor() {}

  public static getInstance(): HapticEngine {
    if (!HapticEngine.instance) {
      HapticEngine.instance = new HapticEngine();
    }
    return HapticEngine.instance;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  /**
   * Triggers a vibration pattern if supported and enabled.
   */
  public vibrate(pattern: number | number[]): boolean {
    if (!this.enabled || !this.isSupported()) {
      return false;
    }
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }

  /** Ultra-subtle feedback for virtual trackpad / smooth drag. */
  public lightTap(): void {
    this.vibrate(8);
  }

  /** Standard tactile click for button presses. */
  public buttonClick(): void {
    this.vibrate(16);
  }

  /** Strong feedback for primary actions / toggles. */
  public heavyClick(): void {
    this.vibrate(30);
  }

  /** Two distinct pulses for state confirmation. */
  public doublePulse(): void {
    this.vibrate([15, 40, 15]);
  }

  /** Melodic haptic chime for successful pairing. */
  public pairSuccess(): void {
    this.vibrate([20, 60, 30, 60, 50]);
  }

  /** Harsh double pulse indicating an error or rejected handshake. */
  public errorAlert(): void {
    this.vibrate([40, 40, 40, 40, 60]);
  }

  /** Warning vibration on transport disconnection. */
  public disconnectWarning(): void {
    this.vibrate([50, 50, 50]);
  }
}

export const haptics = HapticEngine.getInstance();
