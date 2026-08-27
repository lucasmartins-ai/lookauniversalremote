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
      bg: 'rgba(0, 245, 155, 0.12)',
      border: 'rgba(0, 245, 155, 0.4)',
      defaultLabel: 'ONLINE',
      pulse: false,
    },
    connecting: {
      color: 'var(--color-neon-amber)',
      bg: 'rgba(255, 183, 3, 0.12)',
      border: 'rgba(255, 183, 3, 0.4)',
      defaultLabel: 'NEGOTIATING',
      pulse: true,
    },
    pairing: {
      color: 'var(--color-neon-cyan)',
      bg: 'rgba(0, 229, 255, 0.12)',
      border: 'rgba(0, 229, 255, 0.4)',
      defaultLabel: 'PAIRING',
      pulse: true,
    },
    degraded: {
      color: 'var(--color-neon-amber)',
      bg: 'rgba(255, 183, 3, 0.12)',
      border: 'rgba(255, 183, 3, 0.4)',
      defaultLabel: 'DEGRADED',
      pulse: true,
    },
    disconnected: {
      color: 'var(--color-text-muted)',
      bg: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.12)',
      defaultLabel: 'OFFLINE',
      pulse: false,
    },
    error: {
      color: 'var(--color-neon-red)',
      bg: 'rgba(255, 42, 85, 0.12)',
      border: 'rgba(255, 42, 85, 0.4)',
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
        gap: '7px',
        padding: '3px 10px',
        borderRadius: '12px',
        background: 'linear-gradient(180deg, #0c1018 0%, #06090e 100%)',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        borderBottom: '1px solid #000000',
        borderRight: '1px solid #000000',
        boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 0.4)',
        color: current.color,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {showDot && (
        <span
          className={`retro-led ${current.pulse ? 'animate-pulse-glow' : ''}`}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: current.color,
            boxShadow: `0 0 8px ${current.color}, inset 0 1px 1px rgba(255, 255, 255, 0.8)`,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ textShadow: `0 0 10px ${current.color}60` }}>{displayLabel}</span>
    </div>
  );
};
