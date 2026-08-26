import React, { useState, useRef, useEffect } from 'react';
import { ProtocolBridge } from '../../transport/ProtocolBridge';
import { AppSettings } from '../settings/useSettings';
import { LatencyHud } from '../connection/LatencyHud';
import { Button } from '../../ui/components/Button';
import { haptics } from '../../ui/haptics/hapticEngine';
import { MediaAction, MediaActionValue } from '@lookaremote/protocol-types';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  ShieldAlert,
  Settings,
  Gamepad2,
  MousePointer,
  Keyboard,
  Film,
} from 'lucide-react';
import { TelemetryData } from '../connection/ConnectionState';

export interface MediaRemoteViewProps {
  bridge: ProtocolBridge;
  telemetry: TelemetryData;
  settings: AppSettings;
  activeMode: 'gamepad' | 'trackpad' | 'keyboard' | 'media';
  onSelectMode: (mode: 'gamepad' | 'trackpad' | 'keyboard' | 'media') => void;
  onOpenSettings: () => void;
  onDisconnect: () => void;
}

export const MediaRemoteView: React.FC<MediaRemoteViewProps> = ({
  bridge,
  telemetry,
  settings,
  activeMode,
  onSelectMode,
  onOpenSettings,
  onDisconnect,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [activeAction, setActiveAction] = useState<number | null>(null);

  // Interval timer for hold-to-repeat volume
  const repeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  const sendMediaAction = (action: MediaActionValue) => {
    haptics.buttonClick();
    setActiveAction(action);
    bridge.sendMedia({ mediaAction: action });

    setTimeout(() => {
      setActiveAction(null);
    }, 150);
  };

  const startHoldRepeat = (action: MediaActionValue) => {
    sendMediaAction(action);
    if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);

    // After initial 300ms hold delay, repeat every 100ms
    const timeout = setTimeout(() => {
      repeatTimerRef.current = setInterval(() => {
        haptics.lightTap();
        bridge.sendMedia({ mediaAction: action });
      }, 100);
    }, 300);

    repeatTimerRef.current = timeout as any;
  };

  const stopHoldRepeat = () => {
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopHoldRepeat();
    };
  }, []);

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

      {/* Main OLED Media Deck Surface */}
      <div
        style={{
          flex: 1,
          margin: '12px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          padding: '16px',
          borderRadius: '16px',
          backgroundColor: '#05080c',
          border: '1px solid var(--color-border-accent)',
          boxShadow: 'inset 0 0 30px rgba(0, 229, 255, 0.05)',
        }}
      >
        {/* Playback Controls (Prev, Play/Pause, Next) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          {/* Previous Track */}
          <button
            type="button"
            onClick={() => sendMediaAction(MediaAction.PREV)}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
              transition: 'all var(--transition-fast)',
              boxShadow: activeAction === MediaAction.PREV ? '0 0 16px var(--color-neon-cyan)' : 'none',
            }}
          >
            <SkipBack size={24} />
          </button>

          {/* Large Main Play/Pause Button */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(!isPlaying);
              sendMediaAction(MediaAction.PLAY_PAUSE);
            }}
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 229, 255, 0.15)',
              border: '2px solid var(--color-neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-neon-cyan)',
              boxShadow: '0 0 24px var(--color-neon-cyan-glow)',
              transition: 'all var(--transition-fast)',
              transform: activeAction === MediaAction.PLAY_PAUSE ? 'scale(0.95)' : 'scale(1)',
            }}
          >
            {isPlaying ? <Pause size={36} /> : <Play size={36} style={{ marginLeft: '4px' }} />}
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={() => sendMediaAction(MediaAction.NEXT)}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
              transition: 'all var(--transition-fast)',
              boxShadow: activeAction === MediaAction.NEXT ? '0 0 16px var(--color-neon-cyan)' : 'none',
            }}
          >
            <SkipForward size={24} />
          </button>
        </div>

        {/* Secondary Row: Stop */}
        <div>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              sendMediaAction(MediaAction.STOP);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '20px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Square size={14} /> STOP
          </button>
        </div>

        {/* Volume & Mute Section */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            width: '100%',
            maxWidth: '340px',
          }}
        >
          {/* Volume Down */}
          <button
            type="button"
            onPointerDown={() => startHoldRepeat(MediaAction.VOL_DOWN)}
            onPointerUp={stopHoldRepeat}
            onPointerCancel={stopHoldRepeat}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '16px 8px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'none',
            }}
          >
            <Volume1 size={22} color="var(--color-neon-cyan)" />
            VOL -
          </button>

          {/* Mute Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsMuted(!isMuted);
              sendMediaAction(MediaAction.MUTE);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '16px 8px',
              borderRadius: '12px',
              backgroundColor: isMuted ? 'rgba(255, 23, 68, 0.15)' : 'var(--color-surface-card)',
              border: `1px solid ${isMuted ? 'var(--color-neon-red)' : 'var(--color-border-subtle)'}`,
              boxShadow: isMuted ? '0 0 16px var(--color-neon-red-glow)' : 'none',
              color: isMuted ? 'var(--color-neon-red)' : 'var(--color-text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
            {isMuted ? 'MUTED' : 'MUTE'}
          </button>

          {/* Volume Up */}
          <button
            type="button"
            onPointerDown={() => startHoldRepeat(MediaAction.VOL_UP)}
            onPointerUp={stopHoldRepeat}
            onPointerCancel={stopHoldRepeat}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '16px 8px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'none',
            }}
          >
            <Volume2 size={22} color="var(--color-neon-cyan)" />
            VOL +
          </button>
        </div>
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
