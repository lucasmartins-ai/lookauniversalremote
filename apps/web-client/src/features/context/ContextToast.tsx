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
      return <MousePointer size={20} color="var(--color-neon-green)" />;
    case 'keyboard':
      return <Keyboard size={20} color="var(--color-neon-amber)" />;
    case 'media':
      return <Music size={20} color="var(--color-neon-pink)" />;
    default:
      return <Gamepad2 size={20} color="var(--color-neon-cyan)" />;
  }
}

function getModeGlow(mode: InputMode): string {
  switch (mode) {
    case 'gamepad':
      return 'rgba(0, 229, 255, 0.4)';
    case 'trackpad':
      return 'rgba(0, 245, 155, 0.4)';
    case 'keyboard':
      return 'rgba(255, 183, 3, 0.4)';
    case 'media':
      return 'rgba(255, 0, 127, 0.4)';
    default:
      return 'rgba(0, 229, 255, 0.4)';
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
      className="neo-raised-lg"
      style={{
        position: 'absolute',
        top: '64px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        width: 'calc(100% - 32px)',
        maxWidth: '440px',
        borderRadius: '16px',
        border: `1.5px solid ${glowColor}`,
        boxShadow: `0 8px 30px rgba(0, 0, 0, 0.8), 0 0 20px ${glowColor}`,
        padding: '12px 18px',
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
          className="neo-sunken"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {getModeIcon(toast.mode)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div
            className="retro-embossed-text"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.88rem',
              fontWeight: 800,
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
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontWeight: 600,
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
          className="lookaremote-btn retro-btn"
          style={{
            padding: '8px',
            borderRadius: '8px',
            background: isManualLocked
              ? 'linear-gradient(180deg, #ffc01e 0%, #b36b00 100%)'
              : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: isManualLocked ? '1px solid #ffc01e' : '1px solid rgba(255, 255, 255, 0.12)',
            color: isManualLocked ? '#1a0e00' : 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isManualLocked ? 'var(--neo-shadow-button-amber)' : 'var(--neo-shadow-button-slate)',
          }}
        >
          {isManualLocked ? <Lock size={15} /> : <Unlock size={15} />}
        </button>

        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss Toast"
          className="lookaremote-btn retro-btn"
          style={{
            padding: '8px',
            borderRadius: '8px',
            background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
