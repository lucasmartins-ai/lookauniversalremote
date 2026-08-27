/**
 * Multi-Player Slot Indicator & Telemetry Badge Component.
 */

import React from 'react';

interface PlayerBadgeProps {
  playerIndex: number;
  playerColor?: string;
  batteryLevel?: number | null;
  isCharging?: boolean | null;
}

const DEFAULT_PLAYER_COLORS = ['#00E5FF', '#FF007F', '#FFE600', '#00FF66'];

export const PlayerBadge: React.FC<PlayerBadgeProps> = ({
  playerIndex,
  playerColor,
  batteryLevel,
  isCharging,
}) => {
  const color = playerColor || DEFAULT_PLAYER_COLORS[playerIndex % 4];
  const playerLabel = `P${playerIndex + 1}`;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '999px',
        background: 'linear-gradient(180deg, #182232 0%, #0d121c 100%)',
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 10px ${color}40, inset 0 1px 1px rgba(255, 255, 255, 0.2)`,
        fontFamily: 'var(--font-display)',
        fontSize: '0.8rem',
        fontWeight: 900,
        color: '#ffffff',
        letterSpacing: '0.04em',
        userSelect: 'none',
      }}
    >
      <span
        className="retro-led"
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}, inset 0 1px 1px rgba(255, 255, 255, 0.8)`,
        }}
      />
      <span style={{ color, textShadow: `0 0 8px ${color}60` }}>{playerLabel}</span>

      {batteryLevel !== null && batteryLevel !== undefined && (
        <span
          style={{
            marginLeft: '4px',
            paddingLeft: '6px',
            borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
            color: batteryLevel <= 20 ? '#ff2a55' : '#94a3b8',
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
          }}
        >
          {isCharging ? '⚡' : '🔋'} {batteryLevel}%
        </span>
      )}
    </div>
  );
};
