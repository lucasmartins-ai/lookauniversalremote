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

      {/* 3D Physical Retro Mouse Buttons (Left, Middle, Right Clickers) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 2fr',
          gap: '10px',
          marginBottom: '12px',
        }}
      >
        {/* Left Clicker */}
        <button
          type="button"
          onPointerDown={() => handlePhysicalButtonDown(0x01)}
          onPointerUp={() => handlePhysicalButtonUp(0x01)}
          onPointerCancel={() => handlePhysicalButtonUp(0x01)}
          className="lookaremote-btn retro-btn"
          style={{
            padding: '14px 8px',
            borderRadius: '12px',
            background: activeButtonsMask & 0x01
              ? 'linear-gradient(180deg, #008ba3 0%, #00e5ff 100%)'
              : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: `1.5px solid ${activeButtonsMask & 0x01 ? '#00f0ff' : 'rgba(255, 255, 255, 0.15)'}`,
            boxShadow: activeButtonsMask & 0x01
              ? 'var(--neo-shadow-button-cyan-pressed)'
              : 'var(--neo-shadow-button-slate)',
            color: activeButtonsMask & 0x01 ? '#040d1a' : 'var(--color-text-primary)',
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem',
            fontWeight: 900,
            letterSpacing: '0.06em',
          }}
        >
          LEFT CLICK
        </button>

        {/* Middle Clicker */}
        <button
          type="button"
          onPointerDown={() => handlePhysicalButtonDown(0x04)}
          onPointerUp={() => handlePhysicalButtonUp(0x04)}
          onPointerCancel={() => handlePhysicalButtonUp(0x04)}
          className="lookaremote-btn retro-btn"
          style={{
            padding: '14px 4px',
            borderRadius: '12px',
            background: activeButtonsMask & 0x04
              ? 'linear-gradient(180deg, #b37400 0%, #ffb703 100%)'
              : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: `1.5px solid ${activeButtonsMask & 0x04 ? '#ffb703' : 'rgba(255, 255, 255, 0.15)'}`,
            boxShadow: activeButtonsMask & 0x04
              ? 'var(--neo-shadow-button-amber-pressed)'
              : 'var(--neo-shadow-button-slate)',
            color: activeButtonsMask & 0x04 ? '#1a0e00' : 'var(--color-neon-amber)',
            fontFamily: 'var(--font-display)',
            fontSize: '0.85rem',
            fontWeight: 800,
          }}
        >
          MIDDLE
        </button>

        {/* Right Clicker */}
        <button
          type="button"
          onPointerDown={() => handlePhysicalButtonDown(0x02)}
          onPointerUp={() => handlePhysicalButtonUp(0x02)}
          onPointerCancel={() => handlePhysicalButtonUp(0x02)}
          className="lookaremote-btn retro-btn"
          style={{
            padding: '14px 8px',
            borderRadius: '12px',
            background: activeButtonsMask & 0x02
              ? 'linear-gradient(180deg, #008ba3 0%, #00e5ff 100%)'
              : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: `1.5px solid ${activeButtonsMask & 0x02 ? '#00f0ff' : 'rgba(255, 255, 255, 0.15)'}`,
            boxShadow: activeButtonsMask & 0x02
              ? 'var(--neo-shadow-button-cyan-pressed)'
              : 'var(--neo-shadow-button-slate)',
            color: activeButtonsMask & 0x02 ? '#040d1a' : 'var(--color-text-primary)',
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem',
            fontWeight: 900,
            letterSpacing: '0.06em',
          }}
        >
          RIGHT CLICK
        </button>
      </div>

      {/* Bottom Safety Bar */}
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
