import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageType,
  TargetMode,
  ModeSwitchFlags,
  type Packet,
  type ModeSwitchPayload,
} from '@lookaremote/protocol-types';
import { ProtocolBridge } from '../../transport/ProtocolBridge';
import { AppSettings } from '../settings/useSettings';
import { haptics } from '../../ui/haptics/hapticEngine';

export type InputMode = 'tv' | 'airmouse' | 'gamepad' | 'trackpad' | 'keyboard' | 'media';

export interface ContextToastData {
  id: number;
  mode: InputMode;
  title: string;
  subtitle: string;
  isEnforced: boolean;
  timestamp: number;
}

export interface UseSmartContextProps {
  bridge: ProtocolBridge | null;
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  activeInputMode: InputMode;
  setActiveInputMode: (mode: InputMode) => void;
}

/**
 * Maps numeric TargetMode values to client string identifiers.
 */
export function targetModeToInputMode(targetMode: number): InputMode {
  switch (targetMode) {
    case TargetMode.TV_REMOTE:
      return 'tv';
    case TargetMode.AIR_MOUSE:
      return 'airmouse';
    case TargetMode.GAMEPAD:
      return 'gamepad';
    case TargetMode.TRACKPAD:
      return 'trackpad';
    case TargetMode.KEYBOARD:
      return 'keyboard';
    case TargetMode.MEDIA_REMOTE:
      return 'media';
    default:
      return 'tv';
  }
}

/**
 * Maps client string identifiers to numeric TargetMode protocol values.
 */
export function inputModeToTargetMode(mode: InputMode): number {
  switch (mode) {
    case 'tv':
      return TargetMode.TV_REMOTE;
    case 'airmouse':
      return TargetMode.AIR_MOUSE;
    case 'gamepad':
      return TargetMode.GAMEPAD;
    case 'trackpad':
      return TargetMode.TRACKPAD;
    case 'keyboard':
      return TargetMode.KEYBOARD;
    case 'media':
      return TargetMode.MEDIA_REMOTE;
  }
}

/**
 * Generates user-friendly title and descriptions for mode switch toasts.
 */
function getModeDisplayMeta(mode: InputMode): { title: string; subtitle: string } {
  switch (mode) {
    case 'tv':
      return {
        title: 'UNIVERSAL SMART TV REMOTE',
        subtitle: 'Auto-switched for Smart TV, Channel & Navigation controls',
      };
    case 'airmouse':
      return {
        title: 'AIR MOUSE MAGIC POINTER',
        subtitle: 'Gyroscope pointing enabled for Smart TV & Desktop',
      };
    case 'gamepad':
      return {
        title: 'GAMEPAD MODE DETECTED',
        subtitle: 'Auto-switched for gaming & emulator controls',
      };
    case 'media':
      return {
        title: 'MEDIA REMOTE DETECTED',
        subtitle: 'Auto-switched for audio/video media player',
      };
    case 'keyboard':
      return {
        title: 'KEYBOARD DECK DETECTED',
        subtitle: 'Auto-switched for editor & terminal typing',
      };
    case 'trackpad':
      return {
        title: 'TRACKPAD SURFACE DETECTED',
        subtitle: 'Auto-switched for general desktop navigation',
      };
  }
}

export function useSmartContext({
  bridge,
  settings,
  onUpdateSettings,
  activeInputMode,
  setActiveInputMode,
}: UseSmartContextProps) {
  const [toast, setToast] = useState<ContextToastData | null>(null);
  const [lastDetectedMode, setLastDetectedMode] = useState<InputMode>(activeInputMode);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast(null);
  }, []);

  const triggerToast = useCallback(
    (mode: InputMode, isEnforced: boolean) => {
      if (!settings.smartContextToastEnabled) return;

      const meta = getModeDisplayMeta(mode);
      const newToast: ContextToastData = {
        id: Date.now(),
        mode,
        title: meta.title,
        subtitle: meta.subtitle,
        isEnforced,
        timestamp: Date.now(),
      };

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      setToast(newToast);

      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 3500);
    },
    [settings.smartContextToastEnabled]
  );

  // Listen to incoming binary MSG_MODE_SWITCH packets from host
  useEffect(() => {
    if (!bridge) return;

    const unbind = bridge.onPacket((packet: Packet) => {
      if (packet.header.type === MessageType.MODE_SWITCH) {
        const payload = packet.payload as ModeSwitchPayload;
        const newMode = targetModeToInputMode(payload.targetMode);
        const isEnforced = (payload.flags & ModeSwitchFlags.IS_ENFORCED_BY_HOST) !== 0;

        setLastDetectedMode(newMode);

        // Apply auto-switching if enforced by host OR (autoSwitchEnabled is on and manual lock is off)
        const canAutoSwitch = isEnforced || (settings.autoSwitchEnabled && !settings.manualOverrideLock);

        if (canAutoSwitch) {
          if (newMode !== activeInputMode) {
            setActiveInputMode(newMode);
            triggerToast(newMode, isEnforced);
            haptics.buttonClick();
          }
        }
      }
    });

    return () => {
      unbind();
    };
  }, [bridge, settings.autoSwitchEnabled, settings.manualOverrideLock, activeInputMode, setActiveInputMode, triggerToast]);

  // Request mode change (client-initiated)
  const selectMode = useCallback(
    (mode: InputMode, isManual = true) => {
      setActiveInputMode(mode);

      if (bridge) {
        const targetModeNum = inputModeToTargetMode(mode);
        const flags = isManual ? ModeSwitchFlags.IS_MANUAL_OVERRIDE : ModeSwitchFlags.NONE;
        bridge.sendModeSwitch({
          targetMode: targetModeNum as any,
          flags,
        });
      }
    },
    [bridge, setActiveInputMode]
  );

  const toggleManualLock = useCallback(() => {
    const newLockState = !settings.manualOverrideLock;
    onUpdateSettings({ manualOverrideLock: newLockState });
    haptics.buttonClick();
  }, [settings.manualOverrideLock, onUpdateSettings]);

  return {
    activeInputMode,
    selectMode,
    lastDetectedMode,
    toast,
    dismissToast,
    isManualLocked: settings.manualOverrideLock,
    toggleManualLock,
  };
}
