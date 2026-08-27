import React, { useState, useEffect, useRef } from 'react';
import { ProtocolBridge } from '../../transport/ProtocolBridge';
import { AppSettings } from '../settings/useSettings';
import { LatencyHud } from '../connection/LatencyHud';
import { Button } from '../../ui/components/Button';
import { haptics } from '../../ui/haptics/hapticEngine';
import { ImuSensorPipeline } from '../../sensors/ImuSensorPipeline';
import { MotionFilters } from '../../sensors/MotionFilters';
import {
  MousePointer,
  Sparkles,
  Settings,
  Crosshair,
  RotateCcw,
  Lock,
  Unlock,
  Tv,
  Gamepad2,
  Keyboard as KeyboardIcon,
} from 'lucide-react';
import { TelemetryData } from '../connection/ConnectionState';

export interface AirMouseViewProps {
  bridge: ProtocolBridge;
  telemetry: TelemetryData;
  settings: AppSettings;
  activeMode?: string;
  onSelectMode: (mode: string) => void;
  onOpenSettings: () => void;
  onDisconnect?: () => void;
}

export const AirMouseView: React.FC<AirMouseViewProps> = ({
  bridge,
  telemetry,
  settings,
  activeMode = 'airmouse',
  onSelectMode,
  onOpenSettings,
}) => {
  const [isPointerActive, setIsPointerActive] = useState(true);
  const [isDragLocked, setIsDragLocked] = useState(false);
  const [isLeftPressed, setIsLeftPressed] = useState(false);
  const [isRightPressed, setIsRightPressed] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [sensitivity] = useState(1.2);

  const imuPipelineRef = useRef<ImuSensorPipeline | null>(null);
  const filterRef = useRef<MotionFilters | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const pipeline = new ImuSensorPipeline();
    const filter = new MotionFilters({
      sensitivityX: sensitivity * 1.5,
      sensitivityY: sensitivity * 1.5,
      deadzoneRad: 0.015,
      smoothing: 0.75,
      rollMix: 0,
    });

    imuPipelineRef.current = pipeline;
    filterRef.current = filter;

    const unsub = pipeline.onSample((frame) => {
      if (!isPointerActive) return;

      const filtered = filter.processSample(frame);

      bridge.sendMotion({
        gyroYaw: Math.round(filtered.aimYaw * 1000),
        gyroPitch: Math.round(filtered.aimPitch * 1000),
        gyroRoll: Math.round(filtered.aimRoll * 1000),
        accelX: Math.round(frame.accelX * 100),
        accelY: Math.round(frame.accelY * 100),
        accelZ: Math.round(frame.accelZ * 100),
        timestampUs: frame.timestampUs,
      });

      setCursorPos((prev) => ({
        x: Math.max(5, Math.min(95, prev.x - filtered.aimYaw * sensitivity * 12)),
        y: Math.max(5, Math.min(95, prev.y - filtered.aimPitch * sensitivity * 12)),
      }));
    });

    pipeline.start();

    return () => {
      unsub();
      pipeline.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [bridge, isPointerActive, sensitivity]);

  const handleCenter = () => {
    haptics.buttonClick();
    setCursorPos({ x: 50, y: 50 });
  };

  const handleLeftDown = () => {
    haptics.buttonClick();
    setIsLeftPressed(true);
    bridge.sendTouchpad({
      dx: 0,
      dy: 0,
      scrollV: 0,
      scrollH: 0,
      buttonsMask: 0x01,
    });
  };

  const handleLeftUp = () => {
    if (!isDragLocked) {
      setIsLeftPressed(false);
      bridge.sendTouchpad({
        dx: 0,
        dy: 0,
        scrollV: 0,
        scrollH: 0,
        buttonsMask: 0x00,
      });
    }
  };

  const handleRightClick = () => {
    haptics.lightTap();
    setIsRightPressed(true);
    bridge.sendTouchpad({
      dx: 0,
      dy: 0,
      scrollV: 0,
      scrollH: 0,
      buttonsMask: 0x02,
    });

    setTimeout(() => {
      setIsRightPressed(false);
      bridge.sendTouchpad({
        dx: 0,
        dy: 0,
        scrollV: 0,
        scrollH: 0,
        buttonsMask: 0x00,
      });
    }, 100);
  };

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 14px',
        justifyContent: 'space-between',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Top Mode Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <Button
            variant={activeMode === 'tv' ? 'primary' : 'ghost'}
            size="sm"
            leftIcon={<Tv size={15} />}
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('tv');
            }}
          >
            TV
          </Button>
          <Button
            variant={activeMode === 'airmouse' ? 'primary' : 'ghost'}
            size="sm"
            leftIcon={<MousePointer size={15} />}
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('airmouse');
            }}
          >
            AIR MOUSE
          </Button>
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
            PAD
          </Button>
          <Button
            variant={activeMode === 'keyboard' ? 'primary' : 'ghost'}
            size="sm"
            leftIcon={<KeyboardIcon size={15} />}
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('keyboard');
            }}
          >
            KEYS
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

      {/* 3D AIR MOUSE RADAR SCOPE CANVAS */}
      <div
        className="neo-sunken-deep"
        style={{
          flex: 1,
          margin: '6px 0',
          borderRadius: '20px',
          border: '2px solid rgba(255, 0, 127, 0.4)',
          boxShadow: 'inset 0 0 40px rgba(255, 0, 127, 0.12), 0 0 20px rgba(255, 0, 127, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          justifyContent: 'space-between',
          padding: '16px',
        }}
      >
        {/* Pointer Target Reticle HUD */}
        <div
          style={{
            position: 'absolute',
            top: `${cursorPos.y}%`,
            left: `${cursorPos.x}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'top 0.05s linear, left 0.05s linear',
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: '2.5px solid var(--color-neon-pink)',
              boxShadow: '0 0 20px var(--color-neon-pink), inset 0 0 10px var(--color-neon-pink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: '0 0 10px #ffffff',
              }}
            />
          </div>
        </div>

        {/* Top Info Banner */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--color-neon-pink)" />
            <span
              className="retro-embossed-text"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                fontWeight: 800,
                color: 'var(--color-neon-pink)',
                letterSpacing: '0.08em',
              }}
            >
              MAGIC POINTER (GIROSCÓPIO 120HZ)
            </span>
          </div>

          {/* Toggle Pause/Resume Pointer */}
          <button
            type="button"
            onClick={() => {
              haptics.buttonClick();
              setIsPointerActive(!isPointerActive);
            }}
            className="lookaremote-btn retro-btn"
            style={{
              padding: '6px 14px',
              borderRadius: '12px',
              background: isPointerActive
                ? 'linear-gradient(180deg, #00f0ff 0%, #008ba3 100%)'
                : 'linear-gradient(180deg, #ff3366 0%, #9e0c29 100%)',
              border: `1px solid ${isPointerActive ? '#00f0ff' : '#ff3366'}`,
              color: isPointerActive ? '#040d1a' : '#ffffff',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              boxShadow: isPointerActive ? 'var(--neo-shadow-button-cyan)' : 'var(--neo-shadow-button-red)',
            }}
          >
            {isPointerActive ? 'ATIVO' : 'PAUSADO'}
          </button>
        </div>

        {/* Center Recalibrate Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={handleCenter}
            className="lookaremote-btn retro-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 26px',
              borderRadius: '26px',
              background: 'linear-gradient(180deg, #ff007f 0%, #a60053 100%)',
              border: '2px solid #ff007f',
              color: '#ffffff',
              fontFamily: 'var(--font-display)',
              fontSize: '0.95rem',
              fontWeight: 900,
              boxShadow: '0 4px 0 #59002c, 0 8px 20px rgba(255, 0, 127, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
            }}
          >
            <Crosshair size={20} color="#ffffff" />
            CENTRALIZAR APONTADOR
          </button>
        </div>

        {/* Bottom Actions & 3D Click Trigger */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          {/* Large 3D Main Trigger (Left Click / Drag) */}
          <button
            type="button"
            onPointerDown={handleLeftDown}
            onPointerUp={handleLeftUp}
            onPointerCancel={handleLeftUp}
            className="lookaremote-btn retro-btn"
            style={{
              flex: 2,
              height: '76px',
              borderRadius: '16px',
              background: isLeftPressed
                ? 'linear-gradient(180deg, #008ba3 0%, #00e5ff 100%)'
                : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: `2px solid ${isLeftPressed ? '#00f0ff' : 'rgba(255, 255, 255, 0.15)'}`,
              color: isLeftPressed ? '#040d1a' : 'var(--color-text-primary)',
              fontFamily: 'var(--font-display)',
              fontSize: '1.05rem',
              fontWeight: 900,
              letterSpacing: '0.06em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: isLeftPressed
                ? 'var(--neo-shadow-button-cyan-pressed)'
                : 'var(--neo-shadow-button-slate)',
            }}
          >
            <MousePointer size={24} color={isLeftPressed ? '#040d1a' : 'var(--color-neon-cyan)'} />
            GATILHO / CLIQUE
          </button>

          {/* Secondary Button (Right Click / Back) */}
          <button
            type="button"
            onClick={handleRightClick}
            className="lookaremote-btn retro-btn"
            style={{
              flex: 1,
              height: '76px',
              borderRadius: '16px',
              background: isRightPressed
                ? 'linear-gradient(180deg, #111722 0%, #161e2e 100%)'
                : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              boxShadow: isRightPressed
                ? 'var(--neo-shadow-button-slate-pressed)'
                : 'var(--neo-shadow-button-slate)',
            }}
          >
            <RotateCcw size={20} />
            VOLTAR
          </button>

          {/* Drag Lock Toggle */}
          <button
            type="button"
            onClick={() => {
              haptics.buttonClick();
              setIsDragLocked(!isDragLocked);
              if (isDragLocked) {
                setIsLeftPressed(false);
                bridge.sendTouchpad({ dx: 0, dy: 0, scrollV: 0, scrollH: 0, buttonsMask: 0 });
              } else {
                setIsLeftPressed(true);
                bridge.sendTouchpad({ dx: 0, dy: 0, scrollV: 0, scrollH: 0, buttonsMask: 0x01 });
              }
            }}
            className="lookaremote-btn retro-btn"
            style={{
              width: '68px',
              height: '76px',
              borderRadius: '16px',
              background: isDragLocked
                ? 'linear-gradient(180deg, #ffc01e 0%, #b36b00 100%)'
                : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: `1.5px solid ${isDragLocked ? '#ffc01e' : 'rgba(255, 255, 255, 0.15)'}`,
              color: isDragLocked ? '#1a0e00' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-display)',
              fontSize: '0.75rem',
              fontWeight: 800,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              boxShadow: isDragLocked
                ? 'var(--neo-shadow-button-amber-pressed)'
                : 'var(--neo-shadow-button-slate)',
            }}
          >
            {isDragLocked ? <Lock size={20} /> : <Unlock size={20} />}
            TRAVA
          </button>
        </div>
      </div>
    </div>
  );
};
