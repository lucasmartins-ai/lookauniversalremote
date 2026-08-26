import React from 'react';
import { ProtocolBridge } from '../../transport/ProtocolBridge';
import { AppSettings } from '../settings/useSettings';
import { KeyboardDeck } from './KeyboardDeck';
import { LatencyHud } from '../connection/LatencyHud';
import { Button } from '../../ui/components/Button';
import { haptics } from '../../ui/haptics/hapticEngine';
import { ShieldAlert, Settings, Gamepad2, MousePointer, Keyboard, Film } from 'lucide-react';
import { TelemetryData } from '../connection/ConnectionState';

export interface KeyboardViewProps {
  bridge: ProtocolBridge;
  telemetry: TelemetryData;
  settings: AppSettings;
  activeMode: 'gamepad' | 'trackpad' | 'keyboard' | 'media';
  onSelectMode: (mode: 'gamepad' | 'trackpad' | 'keyboard' | 'media') => void;
  onOpenSettings: () => void;
  onDisconnect: () => void;
}

export const KeyboardView: React.FC<KeyboardViewProps> = ({
  bridge,
  telemetry,
  settings,
  activeMode,
  onSelectMode,
  onOpenSettings,
  onDisconnect,
}) => {
  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 16px',
        justifyContent: 'space-between',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Top Mode Bar & Telemetry HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Button
            variant={activeMode === 'gamepad' ? 'primary' : 'ghost'}
            size="sm"
            leftIcon={<Gamepad2 size={15} />}
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('gamepad');
            }}
          >
            GAMEPAD
          </Button>
          <Button
            variant={activeMode === 'trackpad' ? 'primary' : 'ghost'}
            size="sm"
            leftIcon={<MousePointer size={15} />}
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('trackpad');
            }}
          >
            TRACKPAD
          </Button>
          <Button
            variant={activeMode === 'keyboard' ? 'primary' : 'ghost'}
            size="sm"
            leftIcon={<Keyboard size={15} />}
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('keyboard');
            }}
          >
            KEYS
          </Button>
          <Button
            variant={activeMode === 'media' ? 'primary' : 'ghost'}
            size="sm"
            leftIcon={<Film size={15} />}
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('media');
            }}
          >
            MEDIA
          </Button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <LatencyHud telemetry={telemetry} defaultExpanded={settings.showTelemetryDetails} />
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            aria-label="Settings"
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            <Settings size={18} color="var(--color-text-secondary)" />
          </Button>
        </div>
      </div>

      {/* Main Keyboard Deck */}
      <div style={{ flex: 1, margin: '12px 0', display: 'flex', overflow: 'hidden' }}>
        <KeyboardDeck bridge={bridge} />
      </div>

      {/* Bottom Safety & Disconnect Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <Button
          variant="danger"
          size="sm"
          leftIcon={<ShieldAlert size={14} />}
          onClick={() => {
            haptics.heavyClick();
            bridge.sendEmergencyReset();
          }}
        >
          KILL INPUT
        </Button>

        <Button variant="ghost" size="sm" onClick={onDisconnect}>
          DISCONNECT
        </Button>
      </div>
    </div>
  );
};
