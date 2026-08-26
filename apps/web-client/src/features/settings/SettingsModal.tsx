import React, { useState } from 'react';
import { Vibrate, Smartphone, Activity, PowerOff, Gamepad2, Compass, MousePointer, Zap, Settings as SettingsIcon } from 'lucide-react';
import { Modal } from '../../ui/components/Modal';
import { Button } from '../../ui/components/Button';
import { AppSettings } from './useSettings';
import { GamepadSettingsTab } from './GamepadSettingsTab';
import { GyroSettingsTab } from './GyroSettingsTab';
import { TrackpadSettingsTab } from '../trackpad/TrackpadSettingsTab';
import { ContextSettingsTab } from '../context/ContextSettingsTab';
import { BiasCalibrator } from '../../sensors/BiasCalibrator';
import { ImuSensorPipeline } from '../../sensors/ImuSensorPipeline';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onDisconnect?: () => void;
  isConnected: boolean;
  calibrator?: BiasCalibrator;
  pipeline?: ImuSensorPipeline;
  activeMode?: 'gamepad' | 'trackpad' | 'keyboard' | 'media';
  onSelectMode?: (mode: 'gamepad' | 'trackpad' | 'keyboard' | 'media') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onDisconnect,
  isConnected,
  calibrator,
  pipeline,
  activeMode,
  onSelectMode,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'gamepad' | 'gyro' | 'trackpad' | 'context'>('general');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings & Calibration"
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          DONE
        </Button>
      }
    >
      {/* Sub-tab navigation */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '8px',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant={activeTab === 'general' ? 'primary' : 'ghost'}
          size="sm"
          leftIcon={<SettingsIcon size={14} />}
          onClick={() => setActiveTab('general')}
        >
          GENERAL
        </Button>
        <Button
          variant={activeTab === 'context' ? 'primary' : 'ghost'}
          size="sm"
          leftIcon={<Zap size={14} />}
          onClick={() => setActiveTab('context')}
        >
          CONTEXT
        </Button>
        <Button
          variant={activeTab === 'gamepad' ? 'primary' : 'ghost'}
          size="sm"
          leftIcon={<Gamepad2 size={14} />}
          onClick={() => setActiveTab('gamepad')}
        >
          GAMEPAD
        </Button>
        <Button
          variant={activeTab === 'gyro' ? 'primary' : 'ghost'}
          size="sm"
          leftIcon={<Compass size={14} />}
          onClick={() => setActiveTab('gyro')}
        >
          GYROSCOPE
        </Button>
        <Button
          variant={activeTab === 'trackpad' ? 'primary' : 'ghost'}
          size="sm"
          leftIcon={<MousePointer size={14} />}
          onClick={() => setActiveTab('trackpad')}
        >
          TRACKPAD
        </Button>
      </div>

      {activeTab === 'context' ? (
        <ContextSettingsTab
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          activeMode={activeMode}
          onSelectMode={onSelectMode}
        />
      ) : activeTab === 'gamepad' ? (
        <GamepadSettingsTab settings={settings} onUpdateSettings={onUpdateSettings} />
      ) : activeTab === 'gyro' ? (
        <GyroSettingsTab
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          calibrator={calibrator}
          pipeline={pipeline}
        />
      ) : activeTab === 'trackpad' ? (
        <TrackpadSettingsTab settings={settings} onUpdateSettings={onUpdateSettings} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Haptics Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Vibrate size={18} color="var(--color-neon-cyan)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Haptic Feedback</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Vibrate on button taps and triggers
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.hapticsEnabled}
            onChange={(e) => onUpdateSettings({ hapticsEnabled: e.target.checked })}
            style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-cyan)' }}
          />
        </div>

        {/* Screen Wake Lock Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Smartphone size={18} color="var(--color-neon-green)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Screen Wake Lock</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Prevent phone display from dimming
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.wakeLockEnabled}
            onChange={(e) => onUpdateSettings({ wakeLockEnabled: e.target.checked })}
            style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-green)' }}
          />
        </div>

        {/* Telemetry Detail Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={18} color="var(--color-neon-amber)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Telemetry Overlay</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Always display real-time latency HUD
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.showTelemetryDetails}
            onChange={(e) => onUpdateSettings({ showTelemetryDetails: e.target.checked })}
            style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-amber)' }}
          />
        </div>

        {/* Disconnect Action */}
        {isConnected && onDisconnect && (
          <div style={{ marginTop: '8px' }}>
            <Button
              variant="danger"
              fullWidth
              leftIcon={<PowerOff size={16} />}
              onClick={() => {
                onDisconnect();
                onClose();
              }}
            >
              DISCONNECT SESSION
            </Button>
          </div>
        )}
      </div>
      )}
    </Modal>
  );
};
