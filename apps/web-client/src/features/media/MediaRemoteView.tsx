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

      {/* Main 3D Hi-Fi Deck Surface */}
      <div
        className="neo-sunken-deep"
        style={{
          flex: 1,
          margin: '12px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '26px',
          padding: '20px',
          borderRadius: '20px',
          position: 'relative',
        }}
      >
        {/* Deck Header Badge */}
        <div
          className="retro-embossed-text"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.15em',
            color: 'var(--color-neon-cyan)',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}
        >
          HI-FI AUDIO/VIDEO TRANSPORT DECK
        </div>

        {/* 3D Main Playback Controls (Prev, Play/Pause Dial, Next) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '22px' }}>
          {/* Previous Track */}
          <button
            type="button"
            onClick={() => sendMediaAction(MediaAction.PREV)}
            className="lookaremote-btn retro-btn"
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
              boxShadow: activeAction === MediaAction.PREV
                ? 'var(--neo-shadow-button-slate-pressed)'
                : 'var(--neo-shadow-button-slate)',
            }}
          >
            <SkipBack size={26} />
          </button>

          {/* Large 3D Master Play/Pause Dial */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(!isPlaying);
              sendMediaAction(MediaAction.PLAY_PAUSE);
            }}
            className="lookaremote-btn retro-btn"
            style={{
              width: '92px',
              height: '92px',
              borderRadius: '50%',
              background: 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #007791 100%)',
              border: '2.5px solid #00f0ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#040d1a',
              boxShadow: activeAction === MediaAction.PLAY_PAUSE
                ? 'var(--neo-shadow-button-cyan-pressed)'
                : 'var(--neo-shadow-button-cyan)',
              transform: activeAction === MediaAction.PLAY_PAUSE ? 'translateY(4px) scale(0.96)' : 'none',
            }}
          >
            {isPlaying ? <Pause size={42} /> : <Play size={42} style={{ marginLeft: '6px' }} />}
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={() => sendMediaAction(MediaAction.NEXT)}
            className="lookaremote-btn retro-btn"
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
              boxShadow: activeAction === MediaAction.NEXT
                ? 'var(--neo-shadow-button-slate-pressed)'
                : 'var(--neo-shadow-button-slate)',
            }}
          >
            <SkipForward size={26} />
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
            className="lookaremote-btn retro-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '24px',
              background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: 'var(--neo-shadow-button-slate)',
            }}
          >
            <Square size={16} /> STOP
          </button>
        </div>

        {/* 3D Volume & Mute Section */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '14px',
            width: '100%',
            maxWidth: '360px',
          }}
        >
          {/* Volume Down */}
          <button
            type="button"
            onPointerDown={() => startHoldRepeat(MediaAction.VOL_DOWN)}
            onPointerUp={stopHoldRepeat}
            onPointerCancel={stopHoldRepeat}
            className="lookaremote-btn retro-btn"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '16px 8px',
              borderRadius: '14px',
              background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              fontWeight: 800,
              boxShadow: 'var(--neo-shadow-button-slate)',
            }}
          >
            <Volume1 size={24} color="var(--color-neon-cyan)" />
            VOL -
          </button>

          {/* Mute Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsMuted(!isMuted);
              sendMediaAction(MediaAction.MUTE);
            }}
            className="lookaremote-btn retro-btn"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '16px 8px',
              borderRadius: '14px',
              background: isMuted
                ? 'linear-gradient(180deg, #ff3366 0%, #9e0c29 100%)'
                : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: `1.5px solid ${isMuted ? '#ff3366' : 'rgba(255, 255, 255, 0.15)'}`,
              boxShadow: isMuted
                ? 'var(--neo-shadow-button-red)'
                : 'var(--neo-shadow-button-slate)',
              color: isMuted ? '#ffffff' : 'var(--color-text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              fontWeight: 800,
            }}
          >
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            {isMuted ? 'MUTED' : 'MUTE'}
          </button>

          {/* Volume Up */}
          <button
            type="button"
            onPointerDown={() => startHoldRepeat(MediaAction.VOL_UP)}
            onPointerUp={stopHoldRepeat}
            onPointerCancel={stopHoldRepeat}
            className="lookaremote-btn retro-btn"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '16px 8px',
              borderRadius: '14px',
              background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              fontWeight: 800,
              boxShadow: 'var(--neo-shadow-button-slate)',
            }}
          >
            <Volume2 size={24} color="var(--color-neon-cyan)" />
            VOL +
          </button>
        </div>
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
