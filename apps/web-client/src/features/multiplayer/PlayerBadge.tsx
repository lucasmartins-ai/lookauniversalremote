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
        backgroundColor: 'rgba(10, 16, 24, 0.85)',
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 10px ${color}40`,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '0.75rem',
        fontWeight: 800,
        color: '#F0F6FC',
        letterSpacing: '0.04em',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      <span style={{ color }}>{playerLabel}</span>

      {batteryLevel !== null && batteryLevel !== undefined && (
        <span
          style={{
            marginLeft: '4px',
            paddingLeft: '6px',
            borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
            color: batteryLevel <= 20 ? '#FF0055' : '#8B949E',
            fontSize: '0.7rem',
          }}
        >
          {isCharging ? '⚡' : '🔋'} {batteryLevel}%
        </span>
      )}
    </div>
  );
};
