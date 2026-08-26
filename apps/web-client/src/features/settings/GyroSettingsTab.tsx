import React, { useState } from 'react';
import { Compass, Sliders, Shield, RefreshCw } from 'lucide-react';
import { AppSettings } from './useSettings';
import { Button } from '../../ui/components/Button';
import { GyroCalibrateModal } from './GyroCalibrateModal';
import { BiasCalibrator } from '../../sensors/BiasCalibrator';
import { ImuSensorPipeline } from '../../sensors/ImuSensorPipeline';

export interface GyroSettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  calibrator?: BiasCalibrator;
  pipeline?: ImuSensorPipeline;
}

export const GyroSettingsTab: React.FC<GyroSettingsTabProps> = ({
  settings,
  onUpdateSettings,
  calibrator,
  pipeline,
}) => {
  const [isCalibrateModalOpen, setIsCalibrateModalOpen] = useState(false);

  // Lazy fallback instances if not provided from parent
  const [localCalibrator] = useState(() => calibrator || new BiasCalibrator());
  const [localPipeline] = useState(() => pipeline || new ImuSensorPipeline());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Gyroscope Aiming Mode Selector */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Compass size={18} color="var(--color-neon-cyan)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Gyro Aim Mode</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              Choose how motion aiming is triggered
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '4px' }}>
          {[
            { id: 'disabled', label: 'OFF' },
            { id: 'always_on', label: 'ALWAYS' },
            { id: 'hold_lt', label: 'HOLD LT' },
            { id: 'toggle', label: 'TOGGLE' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => onUpdateSettings({ gyroAimMode: mode.id as any })}
              style={{
                padding: '6px 4px',
                borderRadius: '6px',
                border:
                  settings.gyroAimMode === mode.id
                    ? '1px solid var(--color-neon-cyan)'
                    : '1px solid var(--color-border-subtle)',
                backgroundColor:
                  settings.gyroAimMode === mode.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                color:
                  settings.gyroAimMode === mode.id
                    ? 'var(--color-neon-cyan)'
                    : 'var(--color-text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Sensitivity X / Y Sliders */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sliders size={18} color="var(--color-neon-magenta)" />
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Aim Sensitivity</div>
        </div>

        {/* Horizontal Sensitivity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span>Horizontal (Yaw)</span>
            <span style={{ color: 'var(--color-neon-cyan)', fontFamily: 'var(--font-mono)' }}>
              {settings.gyroSensitivityX.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="4.0"
            step="0.05"
            value={settings.gyroSensitivityX}
            onChange={(e) => onUpdateSettings({ gyroSensitivityX: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--color-neon-cyan)' }}
          />
        </div>

        {/* Vertical Sensitivity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span>Vertical (Pitch)</span>
            <span style={{ color: 'var(--color-neon-magenta)', fontFamily: 'var(--font-mono)' }}>
              {settings.gyroSensitivityY.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="4.0"
            step="0.05"
            value={settings.gyroSensitivityY}
            onChange={(e) => onUpdateSettings({ gyroSensitivityY: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--color-neon-magenta)' }}
          />
        </div>
      </div>

      {/* 3. Inversion Toggles & Roll Mix */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Aiming Axes & Roll Blend</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem' }}>Invert Horizontal (Yaw)</span>
          <input
            type="checkbox"
            checked={settings.gyroInvertX}
            onChange={(e) => onUpdateSettings({ gyroInvertX: e.target.checked })}
            style={{ width: '16px', height: '16px', accentColor: 'var(--color-neon-cyan)' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem' }}>Invert Vertical (Pitch)</span>
          <input
            type="checkbox"
            checked={settings.gyroInvertY}
            onChange={(e) => onUpdateSettings({ gyroInvertY: e.target.checked })}
            style={{ width: '16px', height: '16px', accentColor: 'var(--color-neon-magenta)' }}
          />
        </div>

        {/* Roll Mix Slider (Splatoon / Steam Deck style) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span>Roll-to-Yaw Contribution</span>
            <span style={{ color: 'var(--color-neon-green)', fontFamily: 'var(--font-mono)' }}>
              {Math.round(settings.gyroRollMix * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={settings.gyroRollMix}
            onChange={(e) => onUpdateSettings({ gyroRollMix: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--color-neon-green)' }}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            Combines device tilting (roll) with turning (yaw) for natural landscape aiming
          </span>
        </div>
      </div>

      {/* 4. Deadzone & Smoothing Filter */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={18} color="var(--color-neon-amber)" />
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>DSP & Noise Filtering</div>
        </div>

        {/* Radial Angular Deadzone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span>Angular Deadzone</span>
            <span style={{ color: 'var(--color-neon-amber)', fontFamily: 'var(--font-mono)' }}>
              {(settings.gyroDeadzone * 1000).toFixed(0)} mrad/s
            </span>
          </div>
          <input
            type="range"
            min="0.00"
            max="0.10"
            step="0.005"
            value={settings.gyroDeadzone}
            onChange={(e) => onUpdateSettings({ gyroDeadzone: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--color-neon-amber)' }}
          />
        </div>

        {/* Smoothing Preset */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Low-Pass Smoothing
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {['none', 'light', 'medium', 'heavy'].map((preset) => (
              <button
                key={preset}
                onClick={() => onUpdateSettings({ gyroSmoothing: preset as any })}
                style={{
                  padding: '6px 2px',
                  borderRadius: '6px',
                  border:
                    settings.gyroSmoothing === preset
                      ? '1px solid var(--color-neon-amber)'
                      : '1px solid var(--color-border-subtle)',
                  backgroundColor:
                    settings.gyroSmoothing === preset ? 'rgba(255, 184, 0, 0.15)' : 'transparent',
                  color:
                    settings.gyroSmoothing === preset
                      ? 'var(--color-neon-amber)'
                      : 'var(--color-text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Output Mode (Mouse Delta vs Additive Right Stick) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Host Injection Target
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              { id: 'mouse', label: 'MOUSE CURSOR' },
              { id: 'right_stick', label: 'RIGHT STICK (RS)' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => onUpdateSettings({ gyroOutputMode: mode.id as any })}
                style={{
                  padding: '6px 4px',
                  borderRadius: '6px',
                  border:
                    settings.gyroOutputMode === mode.id
                      ? '1px solid var(--color-neon-cyan)'
                      : '1px solid var(--color-border-subtle)',
                  backgroundColor:
                    settings.gyroOutputMode === mode.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                  color:
                    settings.gyroOutputMode === mode.id
                      ? 'var(--color-neon-cyan)'
                      : 'var(--color-text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gyro Sample Rate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Sampling Rate
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              { id: 60, label: '60 HZ (BALANCED)' },
              { id: 120, label: '120 HZ (ULTRA)' },
            ].map((rate) => (
              <button
                key={rate.id}
                onClick={() => onUpdateSettings({ gyroSampleRate: rate.id })}
                style={{
                  padding: '6px 4px',
                  borderRadius: '6px',
                  border:
                    settings.gyroSampleRate === rate.id
                      ? '1px solid var(--color-neon-cyan)'
                      : '1px solid var(--color-border-subtle)',
                  backgroundColor:
                    settings.gyroSampleRate === rate.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                  color:
                    settings.gyroSampleRate === rate.id
                      ? 'var(--color-neon-cyan)'
                      : 'var(--color-text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {rate.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Calibration & Reset Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          leftIcon={<Compass size={14} />}
          onClick={() => setIsCalibrateModalOpen(true)}
        >
          CALIBRATE GYROSCOPE
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RefreshCw size={14} />}
          onClick={() => {
            localCalibrator.clearBias();
            onUpdateSettings({
              gyroAimMode: 'always_on',
              gyroSensitivityX: 1.0,
              gyroSensitivityY: 1.0,
              gyroInvertX: false,
              gyroInvertY: false,
              gyroDeadzone: 0.02,
              gyroSmoothing: 'light',
              gyroRollMix: 0.25,
              gyroSampleRate: 120,
              gyroOutputMode: 'mouse',
            });
          }}
        >
          RESET
        </Button>
      </div>

      {/* Calibration Modal */}
      <GyroCalibrateModal
        isOpen={isCalibrateModalOpen}
        onClose={() => setIsCalibrateModalOpen(false)}
        calibrator={localCalibrator}
        pipeline={localPipeline}
      />
    </div>
  );
};
