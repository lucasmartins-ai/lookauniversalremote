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
  Palette,
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
import { LayoutStudioView } from '../studio/LayoutStudioView';
import { LayoutStorageManager } from '../studio/layoutStorage';
import { CustomLayout } from '../studio/types';

export interface GamepadViewProps {
  bridge: ProtocolBridge;
  telemetry: TelemetryData;
  settings: AppSettings;
  activeMode?: 'gamepad' | 'trackpad' | 'keyboard' | 'media';
  playerIndex?: number;
  playerColor?: string;
  batteryLevel?: number | null;
  isCharging?: boolean | null;
  onSelectMode?: (mode: 'gamepad' | 'trackpad' | 'keyboard' | 'media') => void;
  onOpenSettings: () => void;
  onDisconnect: () => void;
}

export const GamepadView: React.FC<GamepadViewProps> = ({
  bridge,
  telemetry,
  settings,
  activeMode = 'gamepad',
  playerIndex = 0,
  playerColor,
  batteryLevel,
  isCharging,
  onSelectMode,
  onOpenSettings,
  onDisconnect,
}) => {
  const gamepad = useGamepadState();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGyroAimActive, setIsGyroAimActive] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [activeLayout, setActiveLayout] = useState<CustomLayout>(() =>
    LayoutStorageManager.getActiveLayout(),
  );

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

  useEffect(() => {
    if (gamepadSamplerRef.current) {
      gamepadSamplerRef.current.setSampleRate(settings.gamepadSampleRate || 120);
    }
    if (motionSamplerRef.current) {
      motionSamplerRef.current.setSampleRate(settings.gyroSampleRate || 120);
    }
  }, [settings.gamepadSampleRate, settings.gyroSampleRate]);

  const handleTriggerChange = (side: 'left' | 'right', value: number) => {
    gamepad.setTrigger(side, value);
    if (side === 'left') {
      gyroController.updateGamepadInputs(value, false);
      setIsGyroAimActive(gyroController.isAimActive());
    }
  };

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
        backgroundColor: '#070a0f',
        color: 'var(--color-text-primary)',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Top 3D Header Controls Bar */}
      <div
        className="neo-raised"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          zIndex: 30,
        }}
      >
        {/* Left: Mode Switcher & Emergency Reset */}
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

          {/* Gyro Aim Quick Status Toggle */}
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
              className="lookaremote-btn retro-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: isGyroAimActive
                  ? '1px solid var(--color-neon-green)'
                  : '1px solid rgba(255, 255, 255, 0.15)',
                background: isGyroAimActive
                  ? 'linear-gradient(180deg, #00f59b 0%, #00a86b 100%)'
                  : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
                color: isGyroAimActive ? '#040d1a' : 'var(--color-text-secondary)',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: isGyroAimActive
                  ? 'var(--neo-shadow-button-green)'
                  : 'var(--neo-shadow-button-slate)',
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

          <LatencyHud
            telemetry={telemetry}
            defaultExpanded={settings.showTelemetryDetails}
            playerIndex={playerIndex}
            playerColor={playerColor}
            batteryLevel={batteryLevel}
            isCharging={isCharging}
          />
        </div>

        {/* Right: Studio, Fullscreen & Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              haptics.buttonClick();
              setIsStudioOpen(true);
            }}
            aria-label="Custom Layout Studio"
            style={{ padding: '6px', color: 'var(--color-neon-cyan)' }}
            title="Custom Touch Layout Studio"
          >
            <Palette size={16} />
          </Button>

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

      {/* Render Touch Layout Studio Modal */}
      {isStudioOpen && (
        <LayoutStudioView
          onClose={() => {
            setIsStudioOpen(false);
            setActiveLayout(LayoutStorageManager.getActiveLayout());
          }}
        />
      )}

      {/* Main Dual Grip Landscape Surface with 3D Neumorphic Plates */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          padding: '12px 18px',
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
              gap: '18px',
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

            <DPad size={145} onDirectionChange={gamepad.setDPad} />
          </div>
        </div>

        {/* CENTER REST ZONE / 3D HARDWARE EMBOSSED LOGO */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.25,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div
            className="retro-embossed-text"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.3rem',
              fontWeight: 900,
              letterSpacing: '0.18em',
              color: 'var(--color-neon-cyan)',
            }}
          >
            LOOKAREMOTE
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.12em',
              fontWeight: 700,
            }}
          >
            {activeLayout.name.toUpperCase()} • 120HZ GAMEPAD DECK
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
              gap: '18px',
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

            <ActionDiamond size={155} onButtonChange={gamepad.setButton} />
          </div>
        </div>
      </div>
    </div>
  );
};
