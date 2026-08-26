import React from 'react';
import { Target, Sliders, RefreshCw, Zap } from 'lucide-react';
import { AppSettings } from './useSettings';

export interface GamepadSettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
}

export const GamepadSettingsTab: React.FC<GamepadSettingsTabProps> = ({
  settings,
  onUpdateSettings,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Sampling Rate */}
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
          <Zap size={18} color="var(--color-neon-cyan)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sampling Rate</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
              120Hz Ultra-Low Latency or 60Hz Battery Saver
            </div>
          </div>
        </div>
        <select
          value={settings.gamepadSampleRate}
          onChange={(e) => onUpdateSettings({ gamepadSampleRate: Number(e.target.value) })}
          style={{
            backgroundColor: '#000000',
            color: 'var(--color-neon-cyan)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
          }}
        >
          <option value={120}>120 Hz (8.3ms)</option>
          <option value={60}>60 Hz (16.6ms)</option>
        </select>
      </div>

      {/* Deadzone Left Stick */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            <Target size={16} color="var(--color-neon-cyan)" />
            <span>LS Deadzone</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-neon-cyan)' }}>
            {Math.round(settings.leftStickDeadzone * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={Math.round(settings.leftStickDeadzone * 100)}
          onChange={(e) => onUpdateSettings({ leftStickDeadzone: Number(e.target.value) / 100 })}
          style={{ width: '100%', accentColor: 'var(--color-neon-cyan)' }}
        />
      </div>

      {/* Deadzone Right Stick */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            <Target size={16} color="var(--color-neon-amber)" />
            <span>RS Deadzone</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-neon-amber)' }}>
            {Math.round(settings.rightStickDeadzone * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={Math.round(settings.rightStickDeadzone * 100)}
          onChange={(e) => onUpdateSettings({ rightStickDeadzone: Number(e.target.value) / 100 })}
          style={{ width: '100%', accentColor: 'var(--color-neon-amber)' }}
        />
      </div>

      {/* Stick Sensitivity */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            <Sliders size={16} color="var(--color-neon-green)" />
            <span>Axis Sensitivity</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-neon-green)' }}>
            {settings.stickSensitivity.toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={20}
          step={1}
          value={Math.round(settings.stickSensitivity * 10)}
          onChange={(e) => onUpdateSettings({ stickSensitivity: Number(e.target.value) / 10 })}
          style={{ width: '100%', accentColor: 'var(--color-neon-green)' }}
        />
      </div>

      {/* Invert Y Left Stick */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} color="var(--color-text-secondary)" />
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Invert LS Y-Axis</div>
        </div>
        <input
          type="checkbox"
          checked={settings.invertLeftStickY}
          onChange={(e) => onUpdateSettings({ invertLeftStickY: e.target.checked })}
          style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-cyan)' }}
        />
      </div>

      {/* Invert Y Right Stick */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} color="var(--color-text-secondary)" />
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Invert RS Y-Axis</div>
        </div>
        <input
          type="checkbox"
          checked={settings.invertRightStickY}
          onChange={(e) => onUpdateSettings({ invertRightStickY: e.target.checked })}
          style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-amber)' }}
        />
      </div>

      {/* Floating Joystick */}
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
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Floating Joysticks</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
            Re-centers stick anchor to wherever thumb touches
          </div>
        </div>
        <input
          type="checkbox"
          checked={settings.floatingJoysticks}
          onChange={(e) => onUpdateSettings({ floatingJoysticks: e.target.checked })}
          style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-green)' }}
        />
      </div>
    </div>
  );
};
