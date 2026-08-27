/**
 * LookARemote Multi-Motor Haptics Engine
 * Provides low-latency tactile feedback, custom vibration patterns, and host-triggered rumble effects.
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

  /** Custom variable intensity rumble emulation via timed pulse modulation. */
  public rumble(intensity: number, durationMs: number): void {
    if (!this.enabled || !this.isSupported() || durationMs <= 0) return;
    const clampedIntensity = Math.max(0, Math.min(255, intensity));
    if (clampedIntensity === 0) return;

    if (clampedIntensity >= 200 || durationMs < 50) {
      this.vibrate(durationMs);
    } else {
      // Pulse width modulation for lower intensity
      const pulseOn = Math.max(5, Math.round((clampedIntensity / 255) * 20));
      const pulseOff = Math.max(5, 20 - pulseOn);
      const pattern: number[] = [];
      let elapsed = 0;
      while (elapsed < durationMs) {
        pattern.push(pulseOn);
        pattern.push(pulseOff);
        elapsed += pulseOn + pulseOff;
      }
      this.vibrate(pattern);
    }
  }

  /** Directional / Motor-specific feedback handler (Left heavy / Right light). */
  public motorFeedback(motor: 'left' | 'right' | 'both', intensity: number, durationMs: number): void {
    if (motor === 'left') {
      // Heavy / low frequency feel
      this.rumble(Math.min(255, intensity * 1.2), durationMs);
    } else if (motor === 'right') {
      // High frequency light tap feel
      this.rumble(Math.round(intensity * 0.7), Math.min(60, durationMs));
    } else {
      this.rumble(intensity, durationMs);
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

  /** Strong feedback for primary actions / toggles / turbo fires. */
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
