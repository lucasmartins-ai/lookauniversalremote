import { useState, useEffect, useCallback } from 'react';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface AppSettings {
  hapticsEnabled: boolean;
  wakeLockEnabled: boolean;
  showTelemetryDetails: boolean;
  customHost: string;
  // Gamepad settings
  leftStickDeadzone: number;
  rightStickDeadzone: number;
  stickSensitivity: number;
  invertLeftStickY: boolean;
  invertRightStickY: boolean;
  floatingJoysticks: boolean;
  gamepadSampleRate: number;
  // Gyroscope settings
  gyroAimMode: 'disabled' | 'always_on' | 'hold_lt' | 'toggle';
  gyroSensitivityX: number;
  gyroSensitivityY: number;
  gyroInvertX: boolean;
  gyroInvertY: boolean;
  gyroDeadzone: number;
  gyroSmoothing: 'none' | 'light' | 'medium' | 'heavy';
  gyroRollMix: number;
  gyroSampleRate: number;
  gyroOutputMode: 'mouse' | 'right_stick';
  // Trackpad settings
  trackpadSensitivity: number;
  trackpadAcceleration: number;
  trackpadNaturalScroll: boolean;
  trackpadScrollSensitivity: number;
  trackpadTapToClick: boolean;
  trackpadDoubleTapDrag: boolean;
  // Smart Context settings
  autoSwitchEnabled: boolean;
  manualOverrideLock: boolean;
  smartContextToastEnabled: boolean;
}

const SETTINGS_KEY = 'lookaremote_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  hapticsEnabled: true,
  wakeLockEnabled: true,
  showTelemetryDetails: false,
  customHost: '',
  leftStickDeadzone: 0.15,
  rightStickDeadzone: 0.15,
  stickSensitivity: 1.0,
  invertLeftStickY: false,
  invertRightStickY: false,
  floatingJoysticks: false,
  gamepadSampleRate: 120,
  gyroAimMode: 'always_on',
  gyroSensitivityX: 1.0,
  gyroSensitivityY: 1.0,
  gyroInvertX: false,
  gyroInvertY: false,
  gyroDeadzone: 0.02,
  gyroSmoothing: 'light',
  gyroRollMix: 0.25,
  gyroSampleRate: 120,
  gyroOutputMode: 'mouse',
  trackpadSensitivity: 1.0,
  trackpadAcceleration: 0.8,
  trackpadNaturalScroll: true,
  trackpadScrollSensitivity: 1.0,
  trackpadTapToClick: true,
  trackpadDoubleTapDrag: true,
  autoSwitchEnabled: true,
  manualOverrideLock: false,
  smartContextToastEnabled: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  // Sync haptics engine state
  useEffect(() => {
    haptics.setEnabled(settings.hapticsEnabled);
  }, [settings.hapticsEnabled]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist settings:', e);
      }
      return updated;
    });
  }, []);

  return {
    settings,
    updateSettings,
  };
}
