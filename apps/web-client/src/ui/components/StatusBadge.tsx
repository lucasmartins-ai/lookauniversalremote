import React from 'react';

export type StatusVariant = 'connected' | 'connecting' | 'pairing' | 'degraded' | 'disconnected' | 'error';

export interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  className?: string;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
  showDot = true,
}) => {
  const config: Record<
    StatusVariant,
    { color: string; bg: string; border: string; defaultLabel: string; pulse: boolean }
  > = {
    connected: {
      color: 'var(--color-neon-green)',
      bg: 'rgba(118, 255, 3, 0.1)',
      border: 'rgba(118, 255, 3, 0.3)',
      defaultLabel: 'ONLINE',
      pulse: false,
    },
    connecting: {
      color: 'var(--color-neon-amber)',
      bg: 'rgba(255, 214, 0, 0.1)',
      border: 'rgba(255, 214, 0, 0.3)',
      defaultLabel: 'NEGOTIATING',
      pulse: true,
    },
    pairing: {
      color: 'var(--color-neon-cyan)',
      bg: 'rgba(0, 229, 255, 0.1)',
      border: 'rgba(0, 229, 255, 0.3)',
      defaultLabel: 'PAIRING',
      pulse: true,
    },
    degraded: {
      color: 'var(--color-neon-amber)',
      bg: 'rgba(255, 214, 0, 0.1)',
      border: 'rgba(255, 214, 0, 0.3)',
      defaultLabel: 'DEGRADED',
      pulse: true,
    },
    disconnected: {
      color: 'var(--color-text-muted)',
      bg: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.1)',
      defaultLabel: 'OFFLINE',
      pulse: false,
    },
    error: {
      color: 'var(--color-neon-red)',
      bg: 'rgba(255, 23, 68, 0.1)',
      border: 'rgba(255, 23, 68, 0.3)',
      defaultLabel: 'ERROR',
      pulse: true,
    },
  };

  const current = config[status] || config.disconnected;
  const displayLabel = label || current.defaultLabel;

  return (
    <div
      className={`lookaremote-status-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '20px',
        backgroundColor: current.bg,
        border: `1px solid ${current.border}`,
        color: current.color,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {showDot && (
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: current.color,
            boxShadow: `0 0 6px ${current.color}`,
            display: 'inline-block',
          }}
          className={current.pulse ? 'animate-pulse-glow' : ''}
        />
      )}
      <span>{displayLabel}</span>
    </div>
  );
};
