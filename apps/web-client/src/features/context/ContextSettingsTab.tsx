import React from 'react';
import { Layers, Lock, Bell, Zap, Gamepad2, MousePointer, Keyboard, Music } from 'lucide-react';
import { AppSettings } from '../settings/useSettings';

export interface ContextSettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  activeMode?: string;
  onSelectMode?: (mode: 'gamepad' | 'trackpad' | 'keyboard' | 'media') => void;
}

export const ContextSettingsTab: React.FC<ContextSettingsTabProps> = ({
  settings,
  onUpdateSettings,
  activeMode = 'gamepad',
  onSelectMode,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Card */}
      <div
        style={{
          padding: '14px 16px',
          borderRadius: '10px',
          backgroundColor: 'rgba(0, 229, 255, 0.05)',
          border: '1px solid rgba(0, 229, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={16} color="var(--color-neon-cyan)" />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--color-neon-cyan)',
              letterSpacing: '0.05em',
            }}
          >
            SMART CONTEXT ENGINE
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
          The host daemon automatically detects active foreground games, media players, and desktop applications to seamlessly switch mobile controller decks.
        </p>
      </div>

      {/* Auto Switch Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Layers size={18} color="var(--color-neon-cyan)" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>Auto-Switching</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              Automatically adapt UI when host window focus changes
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={settings.autoSwitchEnabled}
          onChange={(e) => onUpdateSettings({ autoSwitchEnabled: e.target.checked })}
          style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-cyan)' }}
        />
      </div>

      {/* Manual Override Lock Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Lock size={18} color="var(--color-neon-yellow, #ffd600)" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>Manual Mode Lock</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              Lock selected mode and ignore host auto-switch signals
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={settings.manualOverrideLock}
          onChange={(e) => onUpdateSettings({ manualOverrideLock: e.target.checked })}
          style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-yellow, #ffd600)' }}
        />
      </div>

      {/* Toast Notifications Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Bell size={18} color="var(--color-neon-green, #00e676)" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>HUD Toast Alerts</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              Display neon notification toast on mode transitions
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={settings.smartContextToastEnabled}
          onChange={(e) => onUpdateSettings({ smartContextToastEnabled: e.target.checked })}
          style={{ width: '18px', height: '18px', accentColor: 'var(--color-neon-green, #00e676)' }}
        />
      </div>

      {/* Mode Switcher Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.05em' }}>
          QUICK MODE SELECT
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onSelectMode?.('gamepad')}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: activeMode === 'gamepad' ? 'rgba(0, 229, 255, 0.15)' : 'var(--color-surface-card)',
              border: activeMode === 'gamepad' ? '1px solid var(--color-neon-cyan)' : '1px solid var(--color-border-subtle)',
              color: activeMode === 'gamepad' ? 'var(--color-neon-cyan)' : 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <Gamepad2 size={16} />
            GAMEPAD
          </button>

          <button
            type="button"
            onClick={() => onSelectMode?.('trackpad')}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: activeMode === 'trackpad' ? 'rgba(0, 230, 118, 0.15)' : 'var(--color-surface-card)',
              border: activeMode === 'trackpad' ? '1px solid var(--color-neon-green, #00e676)' : '1px solid var(--color-border-subtle)',
              color: activeMode === 'trackpad' ? 'var(--color-neon-green, #00e676)' : 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <MousePointer size={16} />
            TRACKPAD
          </button>

          <button
            type="button"
            onClick={() => onSelectMode?.('keyboard')}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: activeMode === 'keyboard' ? 'rgba(255, 214, 0, 0.15)' : 'var(--color-surface-card)',
              border: activeMode === 'keyboard' ? '1px solid var(--color-neon-yellow, #ffd600)' : '1px solid var(--color-border-subtle)',
              color: activeMode === 'keyboard' ? 'var(--color-neon-yellow, #ffd600)' : 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <Keyboard size={16} />
            KEYBOARD
          </button>

          <button
            type="button"
            onClick={() => onSelectMode?.('media')}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: activeMode === 'media' ? 'rgba(245, 0, 87, 0.15)' : 'var(--color-surface-card)',
              border: activeMode === 'media' ? '1px solid var(--color-neon-magenta, #f50057)' : '1px solid var(--color-border-subtle)',
              color: activeMode === 'media' ? 'var(--color-neon-magenta, #f50057)' : 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <Music size={16} />
            MEDIA
          </button>
        </div>
      </div>
    </div>
  );
};
