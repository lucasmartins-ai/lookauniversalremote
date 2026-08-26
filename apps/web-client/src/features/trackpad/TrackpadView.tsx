import React, { useState, useCallback } from 'react';
import { ProtocolBridge } from '../../transport/ProtocolBridge';
import { AppSettings } from '../settings/useSettings';
import { TrackpadSurface } from './TrackpadSurface';
import { TouchpadOutput } from './GestureRecognizer';
import { LatencyHud } from '../connection/LatencyHud';
import { Button } from '../../ui/components/Button';
import { haptics } from '../../ui/haptics/hapticEngine';
import { ShieldAlert, Settings, Gamepad2, MousePointer, Keyboard, Film } from 'lucide-react';
import { TelemetryData } from '../connection/ConnectionState';

export interface TrackpadViewProps {
  bridge: ProtocolBridge;
  telemetry: TelemetryData;
  settings: AppSettings;
  activeMode: 'gamepad' | 'trackpad' | 'keyboard' | 'media';
  onSelectMode: (mode: 'gamepad' | 'trackpad' | 'keyboard' | 'media') => void;
  onOpenSettings: () => void;
  onDisconnect: () => void;
}

export const TrackpadView: React.FC<TrackpadViewProps> = ({
  bridge,
  telemetry,
  settings,
  activeMode,
  onSelectMode,
  onOpenSettings,
  onDisconnect,
}) => {
  const [activeButtonsMask, setActiveButtonsMask] = useState(0);

  const handleTrackpadOutput = useCallback(
    (output: TouchpadOutput) => {
      // Combine gesture output buttons with any held physical virtual buttons
      const combinedMask = output.buttonsMask | activeButtonsMask;
      bridge.sendTouchpad({
        dx: output.dx,
        dy: output.dy,
        scrollV: output.scrollV,
        scrollH: output.scrollH,
        buttonsMask: combinedMask,
      });
    },
    [bridge, activeButtonsMask]
  );

  const handlePhysicalButtonDown = (buttonBit: number) => {
    haptics.buttonClick();
    const newMask = activeButtonsMask | buttonBit;
    setActiveButtonsMask(newMask);
    bridge.sendTouchpad({
      dx: 0,
      dy: 0,
      scrollV: 0,
      scrollH: 0,
      buttonsMask: newMask,
    });
  };

  const handlePhysicalButtonUp = (buttonBit: number) => {
    const newMask = activeButtonsMask & ~buttonBit;
    setActiveButtonsMask(newMask);
    bridge.sendTouchpad({
      dx: 0,
      dy: 0,
      scrollV: 0,
      scrollH: 0,
      buttonsMask: newMask,
    });
  };

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

      {/* Main Trackpad Touch Surface */}
      <div style={{ flex: 1, margin: '12px 0', display: 'flex', position: 'relative' }}>
        <TrackpadSurface
          config={{
            sensitivity: settings.trackpadSensitivity ?? 1.0,
            acceleration: settings.trackpadAcceleration ?? 0.8,
            naturalScroll: settings.trackpadNaturalScroll ?? true,
            scrollSensitivity: settings.trackpadScrollSensitivity ?? 1.0,
            tapToClick: settings.trackpadTapToClick ?? true,
            doubleTapDrag: settings.trackpadDoubleTapDrag ?? true,
          }}
          onOutput={handleTrackpadOutput}
        />
      </div>

      {/* Physical Mouse Buttons Bar (Left, Middle, Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 2fr',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <button
          type="button"
          onPointerDown={() => handlePhysicalButtonDown(0x01)}
          onPointerUp={() => handlePhysicalButtonUp(0x01)}
          onPointerCancel={() => handlePhysicalButtonUp(0x01)}
          style={{
            padding: '14px 8px',
            borderRadius: '10px',
            backgroundColor: activeButtonsMask & 0x01 ? 'var(--color-surface-active)' : 'var(--color-surface-card)',
            border: `1px solid ${activeButtonsMask & 0x01 ? 'var(--color-neon-cyan)' : 'var(--color-border-subtle)'}`,
            boxShadow: activeButtonsMask & 0x01 ? '0 0 12px var(--color-neon-cyan-glow)' : 'none',
            color: activeButtonsMask & 0x01 ? 'var(--color-neon-cyan)' : 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            touchAction: 'none',
          }}
        >
          LEFT CLICK
        </button>

        <button
          type="button"
          onPointerDown={() => handlePhysicalButtonDown(0x04)}
          onPointerUp={() => handlePhysicalButtonUp(0x04)}
          onPointerCancel={() => handlePhysicalButtonUp(0x04)}
          style={{
            padding: '14px 4px',
            borderRadius: '10px',
            backgroundColor: activeButtonsMask & 0x04 ? 'var(--color-surface-active)' : 'var(--color-surface-card)',
            border: `1px solid ${activeButtonsMask & 0x04 ? 'var(--color-neon-amber)' : 'var(--color-border-subtle)'}`,
            boxShadow: activeButtonsMask & 0x04 ? '0 0 12px var(--color-neon-amber-glow)' : 'none',
            color: activeButtonsMask & 0x04 ? 'var(--color-neon-amber)' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            touchAction: 'none',
          }}
        >
          MIDDLE
        </button>

        <button
          type="button"
          onPointerDown={() => handlePhysicalButtonDown(0x02)}
          onPointerUp={() => handlePhysicalButtonUp(0x02)}
          onPointerCancel={() => handlePhysicalButtonUp(0x02)}
          style={{
            padding: '14px 8px',
            borderRadius: '10px',
            backgroundColor: activeButtonsMask & 0x02 ? 'var(--color-surface-active)' : 'var(--color-surface-card)',
            border: `1px solid ${activeButtonsMask & 0x02 ? 'var(--color-neon-cyan)' : 'var(--color-border-subtle)'}`,
            boxShadow: activeButtonsMask & 0x02 ? '0 0 12px var(--color-neon-cyan-glow)' : 'none',
            color: activeButtonsMask & 0x02 ? 'var(--color-neon-cyan)' : 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            touchAction: 'none',
          }}
        >
          RIGHT CLICK
        </button>
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
