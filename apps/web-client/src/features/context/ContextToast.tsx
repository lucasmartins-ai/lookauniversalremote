import React from 'react';
import { Gamepad2, MousePointer, Keyboard, Music, Lock, Unlock, X } from 'lucide-react';
import { ContextToastData, InputMode } from './useSmartContext';

export interface ContextToastProps {
  toast: ContextToastData | null;
  onDismiss: () => void;
  isManualLocked: boolean;
  onToggleLock: () => void;
}

function getModeIcon(mode: InputMode) {
  switch (mode) {
    case 'gamepad':
      return <Gamepad2 size={20} color="var(--color-neon-cyan)" />;
    case 'trackpad':
      return <MousePointer size={20} color="var(--color-neon-green, #00e676)" />;
    case 'keyboard':
      return <Keyboard size={20} color="var(--color-neon-yellow, #ffd600)" />;
    case 'media':
      return <Music size={20} color="var(--color-neon-magenta, #f50057)" />;
  }
}

function getModeGlow(mode: InputMode): string {
  switch (mode) {
    case 'gamepad':
      return 'rgba(0, 229, 255, 0.35)';
    case 'trackpad':
      return 'rgba(0, 230, 118, 0.35)';
    case 'keyboard':
      return 'rgba(255, 214, 0, 0.35)';
    case 'media':
      return 'rgba(245, 0, 87, 0.35)';
  }
}

export const ContextToast: React.FC<ContextToastProps> = ({
  toast,
  onDismiss,
  isManualLocked,
  onToggleLock,
}) => {
  if (!toast) return null;

  const glowColor = getModeGlow(toast.mode);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        top: '64px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        width: 'calc(100% - 32px)',
        maxWidth: '420px',
        backgroundColor: 'rgba(10, 15, 22, 0.95)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${glowColor}`,
        borderRadius: '12px',
        boxShadow: `0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px ${glowColor}`,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        animation: 'slideDownToast 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {getModeIcon(toast.mode)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {toast.title}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '0.7rem',
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {toast.subtitle}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onToggleLock}
          title={isManualLocked ? 'Manual Lock Active (Auto-Switch Paused)' : 'Auto-Switch Active (Click to Lock)'}
          style={{
            padding: '6px',
            borderRadius: '6px',
            backgroundColor: isManualLocked ? 'rgba(255, 214, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: isManualLocked ? '1px solid var(--color-neon-yellow, #ffd600)' : '1px solid rgba(255, 255, 255, 0.1)',
            color: isManualLocked ? 'var(--color-neon-yellow, #ffd600)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isManualLocked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>

        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss Toast"
          style={{
            padding: '6px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
