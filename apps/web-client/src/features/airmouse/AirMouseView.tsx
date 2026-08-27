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
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 }); // normalized percentage 0..100
  const [sensitivity] = useState(1.2);

  const imuPipelineRef = useRef<ImuSensorPipeline | null>(null);
  const filterRef = useRef<MotionFilters | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize IMU pipeline for Gyro Aiming / Air Mouse
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

      // Stream binary motion packet over WebRTC DataChannel (120Hz)
      bridge.sendMotion({
        gyroYaw: Math.round(filtered.aimYaw * 1000),
        gyroPitch: Math.round(filtered.aimPitch * 1000),
        gyroRoll: Math.round(filtered.aimRoll * 1000),
        accelX: Math.round(frame.accelX * 100),
        accelY: Math.round(frame.accelY * 100),
        accelZ: Math.round(frame.accelZ * 100),
        timestampUs: frame.timestampUs,
      });

      // Update virtual on-screen cursor position for interactive HUD feedback
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
      buttonsMask: 0x01, // Left Click down
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
        buttonsMask: 0x00, // Left Click release
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
      buttonsMask: 0x02, // Right Click
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

      {/* AIR MOUSE MAGIC POINTER CANVAS */}
      <div
        style={{
          flex: 1,
          margin: '6px 0',
          borderRadius: '16px',
          backgroundColor: '#04070b',
          border: '1.5px solid var(--color-neon-pink)',
          boxShadow: 'inset 0 0 35px rgba(255, 0, 127, 0.1), 0 0 15px rgba(255, 0, 127, 0.15)',
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
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '2px solid var(--color-neon-pink)',
              boxShadow: '0 0 16px var(--color-neon-pink)',
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
                boxShadow: '0 0 8px #ffffff',
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
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--color-neon-pink)',
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
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              backgroundColor: isPointerActive ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 23, 68, 0.15)',
              border: `1px solid ${isPointerActive ? 'var(--color-neon-cyan)' : 'var(--color-neon-red)'}`,
              color: isPointerActive ? 'var(--color-neon-cyan)' : 'var(--color-neon-red)',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: 'pointer',
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '24px',
              backgroundColor: 'rgba(255, 0, 127, 0.2)',
              border: '2px solid var(--color-neon-pink)',
              color: '#ffffff',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(255, 0, 127, 0.4)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Crosshair size={18} color="var(--color-neon-pink)" />
            CENTRALIZAR APONTADOR
          </button>
        </div>

        {/* Bottom Actions & Trigger buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          {/* Large Main Trigger (Left Click / Drag) */}
          <button
            type="button"
            onPointerDown={handleLeftDown}
            onPointerUp={handleLeftUp}
            onPointerCancel={handleLeftUp}
            style={{
              flex: 2,
              height: '80px',
              borderRadius: '16px',
              backgroundColor: isLeftPressed ? 'rgba(0, 229, 255, 0.3)' : 'var(--color-surface-card)',
              border: `2px solid ${isLeftPressed ? 'var(--color-neon-cyan)' : 'var(--color-border-subtle)'}`,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '1rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: isLeftPressed ? '0 0 20px var(--color-neon-cyan)' : 'none',
              touchAction: 'none',
            }}
          >
            <MousePointer size={22} color="var(--color-neon-cyan)" />
            GATILHO / CLIQUE
          </button>

          {/* Secondary Button (Right Click / Back) */}
          <button
            type="button"
            onClick={handleRightClick}
            style={{
              flex: 1,
              height: '80px',
              borderRadius: '16px',
              backgroundColor: isRightPressed ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={18} />
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
            style={{
              width: '60px',
              height: '80px',
              borderRadius: '16px',
              backgroundColor: isDragLocked ? 'rgba(255, 230, 0, 0.2)' : 'var(--color-surface-card)',
              border: `1px solid ${isDragLocked ? 'var(--color-neon-yellow)' : 'var(--color-border-subtle)'}`,
              color: isDragLocked ? 'var(--color-neon-yellow)' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            {isDragLocked ? <Lock size={18} /> : <Unlock size={18} />}
            TRAVA
          </button>
        </div>
      </div>
    </div>
  );
};
