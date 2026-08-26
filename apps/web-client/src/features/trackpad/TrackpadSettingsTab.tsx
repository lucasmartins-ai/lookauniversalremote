import React from 'react';
import { MousePointer, ArrowUpDown, Touchpad, Move } from 'lucide-react';
import { AppSettings } from '../settings/useSettings';

export interface TrackpadSettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
}

export const TrackpadSettingsTab: React.FC<TrackpadSettingsTabProps> = ({
  settings,
  onUpdateSettings,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Pointer Sensitivity */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MousePointer size={16} color="var(--color-neon-cyan)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pointer Sensitivity</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-neon-cyan)' }}>
            {(settings.trackpadSensitivity ?? 1.0).toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min="0.2"
          max="3.0"
          step="0.1"
          value={settings.trackpadSensitivity ?? 1.0}
          onChange={(e) => onUpdateSettings({ trackpadSensitivity: parseFloat(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--color-neon-cyan)' }}
        />
      </div>

      {/* Ballistic Acceleration */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Move size={16} color="var(--color-neon-cyan)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Ballistic Acceleration</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-neon-cyan)' }}>
            {(settings.trackpadAcceleration ?? 0.8).toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min="0.0"
          max="2.0"
          step="0.1"
          value={settings.trackpadAcceleration ?? 0.8}
          onChange={(e) => onUpdateSettings({ trackpadAcceleration: parseFloat(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--color-neon-cyan)' }}
        />
      </div>

      {/* Scroll Sensitivity */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpDown size={16} color="var(--color-neon-green)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Scroll Sensitivity</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-neon-green)' }}>
            {(settings.trackpadScrollSensitivity ?? 1.0).toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min="0.5"
          max="3.0"
          step="0.1"
          value={settings.trackpadScrollSensitivity ?? 1.0}
          onChange={(e) => onUpdateSettings({ trackpadScrollSensitivity: parseFloat(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--color-neon-green)' }}
        />
      </div>

      {/* Toggles Group */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {/* Natural Scrolling */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Natural Scrolling</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Content follows finger direction
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.trackpadNaturalScroll ?? true}
            onChange={(e) => onUpdateSettings({ trackpadNaturalScroll: e.target.checked })}
            style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-cyan)' }}
          />
        </div>

        {/* Tap-to-Click */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Touchpad size={16} color="var(--color-neon-cyan)" />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tap to Click</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                1-finger quick tap triggers left click
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.trackpadTapToClick ?? true}
            onChange={(e) => onUpdateSettings({ trackpadTapToClick: e.target.checked })}
            style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-cyan)' }}
          />
        </div>

        {/* Double-Tap Drag */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '10px' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Double-Tap to Drag</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Double tap and hold to select text / drag windows
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.trackpadDoubleTapDrag ?? true}
            onChange={(e) => onUpdateSettings({ trackpadDoubleTapDrag: e.target.checked })}
            style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-cyan)' }}
          />
        </div>
      </div>
    </div>
  );
};
