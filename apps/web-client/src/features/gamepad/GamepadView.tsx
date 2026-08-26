import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Maximize,
  Minimize,
  Settings as SettingsIcon,
  ShieldAlert,
  PowerOff,
  Compass,
  Gamepad2,
  MousePointer,
  Keyboard,
  Film,
} from 'lucide-react';
import { ProtocolBridge } from '../../transport/ProtocolBridge';
import { TelemetryData } from '../connection/ConnectionState';
import { AppSettings } from '../settings/useSettings';
import { LatencyHud } from '../connection/LatencyHud';
import { VirtualJoystick } from './VirtualJoystick';
import { ActionDiamond } from './ActionDiamond';
import { DPad } from './DPad';
import { ShoulderTriggers } from './ShoulderTriggers';
import { SystemButtons } from './SystemButtons';
import { useGamepadState } from './useGamepadState';
import { GamepadSampler } from './GamepadSampler';
import { Button } from '../../ui/components/Button';
import { haptics } from '../../ui/haptics/hapticEngine';
import { ImuSensorPipeline } from '../../sensors/ImuSensorPipeline';
import { BiasCalibrator } from '../../sensors/BiasCalibrator';
import { GyroAimController } from '../../sensors/GyroAimController';
import { MotionSampler } from '../../sensors/MotionSampler';

export interface GamepadViewProps {
  bridge: ProtocolBridge;
  telemetry: TelemetryData;
  settings: AppSettings;
  activeMode?: 'gamepad' | 'trackpad' | 'keyboard' | 'media';
  onSelectMode?: (mode: 'gamepad' | 'trackpad' | 'keyboard' | 'media') => void;
  onOpenSettings: () => void;
  onDisconnect: () => void;
}

export const GamepadView: React.FC<GamepadViewProps> = ({
  bridge,
  telemetry,
  settings,
  activeMode = 'gamepad',
  onSelectMode,
  onOpenSettings,
  onDisconnect,
}) => {
  const gamepad = useGamepadState();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGyroAimActive, setIsGyroAimActive] = useState(false);

  // Initialize persistent IMU pipeline, calibrator, and controller instances
  const pipeline = useMemo(() => new ImuSensorPipeline(), []);
  const calibrator = useMemo(() => new BiasCalibrator(), []);
  const gyroController = useMemo(
    () =>
      new GyroAimController(pipeline, calibrator, {
        aimMode: settings.gyroAimMode,
        ltThreshold: 25,
        filterOptions: {
          deadzoneRad: settings.gyroDeadzone,
          smoothing: settings.gyroSmoothing,
          sensitivityX: settings.gyroSensitivityX,
          sensitivityY: settings.gyroSensitivityY,
          invertX: settings.gyroInvertX,
          invertY: settings.gyroInvertY,
          rollMix: settings.gyroRollMix,
        },
      }),
    [pipeline, calibrator]
  );

  // Sync settings changes into GyroAimController
  useEffect(() => {
    gyroController.setConfig({
      aimMode: settings.gyroAimMode,
      filterOptions: {
        deadzoneRad: settings.gyroDeadzone,
        smoothing: settings.gyroSmoothing,
        sensitivityX: settings.gyroSensitivityX,
        sensitivityY: settings.gyroSensitivityY,
        invertX: settings.gyroInvertX,
        invertY: settings.gyroInvertY,
        rollMix: settings.gyroRollMix,
      },
    });
  }, [gyroController, settings]);

  // Initialize and run high-rate 120Hz input sampler loops (Gamepad + Motion)
  const gamepadSamplerRef = useRef<GamepadSampler | null>(null);
  const motionSamplerRef = useRef<MotionSampler | null>(null);

  useEffect(() => {
    // 1. Gamepad Sampler
    const gpSampler = new GamepadSampler(
      bridge,
      () => gamepad.getSnapshot(),
      settings.gamepadSampleRate || 120
    );
    gamepadSamplerRef.current = gpSampler;
    gpSampler.start();

    // 2. Motion IMU Sampler
    gyroController.start();
    const mSampler = new MotionSampler(
      bridge,
      () => gyroController.getMotionSnapshot(),
      settings.gyroSampleRate || 120
    );
    motionSamplerRef.current = mSampler;
    mSampler.start();

    // Periodic state check for UI gyro indicator
    const gyroStatusInterval = setInterval(() => {
      setIsGyroAimActive(gyroController.isAimActive());
    }, 100);

    return () => {
      clearInterval(gyroStatusInterval);
      gpSampler.stop();
      mSampler.stop();
      gyroController.stop();
      gamepadSamplerRef.current = null;
      motionSamplerRef.current = null;
      gamepad.resetAll();
    };
  }, [bridge, gamepad, gyroController, settings.gamepadSampleRate, settings.gyroSampleRate]);

  // Update sample rates dynamically if settings change
  useEffect(() => {
    if (gamepadSamplerRef.current) {
      gamepadSamplerRef.current.setSampleRate(settings.gamepadSampleRate || 120);
    }
    if (motionSamplerRef.current) {
      motionSamplerRef.current.setSampleRate(settings.gyroSampleRate || 120);
    }
  }, [settings.gamepadSampleRate, settings.gyroSampleRate]);

  // Forward Left Trigger to GyroAimController for Hold-LT aiming
  const handleTriggerChange = (side: 'left' | 'right', value: number) => {
    gamepad.setTrigger(side, value);
    if (side === 'left') {
      gyroController.updateGamepadInputs(value, false);
      setIsGyroAimActive(gyroController.isAimActive());
    }
  };

  // Fullscreen toggle handler
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn('Fullscreen request denied or not supported:', e);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#000000',
        color: 'var(--color-text-primary)',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Top Header Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: 'rgba(5, 8, 12, 0.85)',
          borderBottom: '1px solid var(--color-border-subtle)',
          zIndex: 30,
        }}
      >
        {/* Left: Mode Switcher & Quick Emergency Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onSelectMode && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <Button
                variant={activeMode === 'gamepad' ? 'primary' : 'ghost'}
                size="sm"
                leftIcon={<Gamepad2 size={14} />}
                onClick={() => onSelectMode('gamepad')}
              >
                PAD
              </Button>
              <Button
                variant={activeMode === 'trackpad' ? 'primary' : 'ghost'}
                size="sm"
                leftIcon={<MousePointer size={14} />}
                onClick={() => onSelectMode('trackpad')}
              >
                TRACK
              </Button>
              <Button
                variant={activeMode === 'keyboard' ? 'primary' : 'ghost'}
                size="sm"
                leftIcon={<Keyboard size={14} />}
                onClick={() => onSelectMode('keyboard')}
              >
                KEYS
              </Button>
              <Button
                variant={activeMode === 'media' ? 'primary' : 'ghost'}
                size="sm"
                leftIcon={<Film size={14} />}
                onClick={() => onSelectMode('media')}
              >
                MEDIA
              </Button>
            </div>
          )}

          <Button
            variant="danger"
            size="sm"
            leftIcon={<ShieldAlert size={14} />}
            onClick={() => {
              haptics.heavyClick();
              gamepad.resetAll();
              bridge.sendEmergencyReset();
            }}
          >
            RESET
          </Button>
        </div>

        {/* Center: System Buttons, Gyro Status & Latency HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SystemButtons onButtonChange={gamepad.setButton} />

          {/* Gyro Aim Quick Status & Toggle Badge */}
          {settings.gyroAimMode !== 'disabled' && (
            <button
              onClick={() => {
                if (settings.gyroAimMode === 'toggle') {
                  const newState = gyroController.toggleAim();
                  setIsGyroAimActive(newState);
                  haptics.buttonClick();
                } else {
                  onOpenSettings();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: isGyroAimActive
                  ? '1px solid var(--color-neon-green)'
                  : '1px solid var(--color-border-subtle)',
                backgroundColor: isGyroAimActive
                  ? 'rgba(0, 255, 159, 0.15)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: isGyroAimActive
                  ? 'var(--color-neon-green)'
                  : 'var(--color-text-secondary)',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title={`Gyro Aim: ${settings.gyroAimMode.toUpperCase()} (${isGyroAimActive ? 'ACTIVE' : 'IDLE'})`}
            >
              <Compass
                size={13}
                style={{
                  animation: isGyroAimActive ? 'spin 3s linear infinite' : 'none',
                }}
              />
              <span>{isGyroAimActive ? 'GYRO AIM' : 'GYRO'}</span>
            </button>
          )}

          <LatencyHud telemetry={telemetry} defaultExpanded={settings.showTelemetryDetails} />
        </div>

        {/* Right: Fullscreen & Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
            style={{ padding: '6px' }}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            aria-label="Settings"
            style={{ padding: '6px' }}
          >
            <SettingsIcon size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            aria-label="Disconnect"
            style={{ padding: '6px', color: 'var(--color-neon-red)' }}
          >
            <PowerOff size={16} />
          </Button>
        </div>
      </div>

      {/* Main Dual Grip Landscape Surface */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          padding: '12px 16px',
          alignItems: 'center',
          justifyItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* LEFT GRIP (Shoulders, Left Stick, D-Pad) */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '4px 8px',
          }}
        >
          {/* Top Left Shoulder: LB + LT */}
          <ShoulderTriggers
            side="left"
            onBumperChange={gamepad.setBumper}
            onTriggerChange={(side, value) => handleTriggerChange(side, value)}
          />

          {/* Lower Left Cluster: Left Stick and D-Pad */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '16px',
              width: '100%',
              marginTop: 'auto',
            }}
          >
            <VirtualJoystick
              label="LS"
              radius={60}
              deadzone={settings.leftStickDeadzone}
              sensitivity={settings.stickSensitivity}
              invertY={settings.invertLeftStickY}
              floating={settings.floatingJoysticks}
              color="var(--color-neon-cyan)"
              onChange={gamepad.setLeftStick}
              onStickClick={() => {
                gamepad.setButton(0x0400, true);
                setTimeout(() => gamepad.setButton(0x0400, false), 80);
              }}
            />

            <DPad size={140} onDirectionChange={gamepad.setDPad} />
          </div>
        </div>

        {/* CENTER REST ZONE / LOGO WATERMARK */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.15,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.2rem',
              fontWeight: 900,
              letterSpacing: '0.15em',
              color: 'var(--color-neon-cyan)',
            }}
          >
            LOOKAREMOTE
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.1em',
            }}
          >
            {settings.gamepadSampleRate || 120}HZ SAMPLER • OLED PRO
          </div>
        </div>

        {/* RIGHT GRIP (Shoulders, Action Diamond, Right Stick) */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            padding: '4px 8px',
          }}
        >
          {/* Top Right Shoulder: RB + RT */}
          <ShoulderTriggers
            side="right"
            onBumperChange={gamepad.setBumper}
            onTriggerChange={gamepad.setTrigger}
          />

          {/* Lower Right Cluster: Action Diamond and Right Stick */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '16px',
              width: '100%',
              marginTop: 'auto',
            }}
          >
            <VirtualJoystick
              label="RS"
              radius={60}
              deadzone={settings.rightStickDeadzone}
              sensitivity={settings.stickSensitivity}
              invertY={settings.invertRightStickY}
              floating={settings.floatingJoysticks}
              color="var(--color-neon-amber)"
              onChange={gamepad.setRightStick}
              onStickClick={() => {
                gamepad.setButton(0x0800, true);
                setTimeout(() => gamepad.setButton(0x0800, false), 80);
              }}
            />

            <ActionDiamond size={150} onButtonChange={gamepad.setButton} />
          </div>
        </div>
      </div>
    </div>
  );
};
