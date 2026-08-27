/**
 * Battery Status API hook with automatic 30s telemetry dispatch over WebRTC DataChannel.
 */

import { useState, useEffect } from 'react';
import { ProtocolBridge } from '../../transport/ProtocolBridge';

export interface BatteryState {
  batteryLevel: number | null;
  isCharging: boolean | null;
  isSupported: boolean;
}

export function useBatteryTelemetry(
  protocolBridge: ProtocolBridge | null,
  playerIndex = 0,
  playerColorRgb565 = 0x073f,
): BatteryState {
  const [state, setState] = useState<BatteryState>({
    batteryLevel: null,
    isCharging: null,
    isSupported: typeof navigator !== 'undefined' && 'getBattery' in navigator,
  });

  useEffect(() => {
    let isMounted = true;
    let batteryManager: any = null;

    const updateBattery = (battery: any) => {
      if (!isMounted) return;
      const level = Math.round(battery.level * 100);
      const charging = battery.charging;
      setState({
        batteryLevel: level,
        isCharging: charging,
        isSupported: true,
      });

      // Send telemetry packet if bridge is active
      if (protocolBridge) {
        protocolBridge.sendSlotAssignment({
          playerIndex,
          playerColorRgb565,
          batteryLevel: level,
          hostName: '',
        });
      }
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          if (!isMounted) return;
          batteryManager = battery;
          updateBattery(battery);

          battery.addEventListener('levelchange', () => updateBattery(battery));
          battery.addEventListener('chargingchange', () => updateBattery(battery));
        })
        .catch(() => {
          if (isMounted) {
            setState((prev) => ({ ...prev, isSupported: false }));
          }
        });
    }

    // Periodic 30s background telemetry pulse
    const interval = setInterval(() => {
      if (batteryManager && protocolBridge) {
        updateBattery(batteryManager);
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [protocolBridge, playerIndex, playerColorRgb565]);

  return state;
}
