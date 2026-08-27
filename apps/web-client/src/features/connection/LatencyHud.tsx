import React, { useState } from 'react';
import { Activity, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { TelemetryData } from './ConnectionState';
import { PlayerBadge } from '../multiplayer/PlayerBadge';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface LatencyHudProps {
  telemetry: TelemetryData;
  className?: string;
  defaultExpanded?: boolean;
  playerIndex?: number;
  playerColor?: string;
  batteryLevel?: number | null;
  isCharging?: boolean | null;
}

export const LatencyHud: React.FC<LatencyHudProps> = ({
  telemetry,
  className = '',
  defaultExpanded = false,
  playerIndex,
  playerColor,
  batteryLevel,
  isCharging,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const rtt = telemetry.rttMs;
  let rttColor = 'var(--color-neon-green)';
  let rttLabel = 'EXCELLENT';

  if (rtt <= 0) {
    rttColor = 'var(--color-text-muted)';
    rttLabel = 'MEASURING';
  } else if (rtt < 8) {
    rttColor = 'var(--color-neon-green)';
    rttLabel = '< 8ms (EXCELLENT)';
  } else if (rtt <= 25) {
    rttColor = 'var(--color-neon-amber)';
    rttLabel = '8-25ms (GOOD)';
  } else {
    rttColor = 'var(--color-neon-red)';
    rttLabel = '> 25ms (DEGRADED)';
  }

  const toggleExpand = () => {
    haptics.lightTap();
    setExpanded((prev) => !prev);
  };

  return (
    <div
      className={`lookaremote-latency-hud neo-raised ${className}`}
      style={{
        borderRadius: '12px',
        padding: expanded ? '10px 14px' : '6px 12px',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8rem',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: 'all var(--transition-normal)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
      onClick={toggleExpand}
    >
      {/* Compact Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Player Slot Badge */}
        {playerIndex !== undefined && (
          <PlayerBadge
            playerIndex={playerIndex}
            playerColor={playerColor}
            batteryLevel={batteryLevel}
            isCharging={isCharging}
          />
        )}

        {/* RTT Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={14} color={rttColor} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 700 }}>RTT:</span>
          <span
            style={{
              color: rttColor,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textShadow: `0 0 8px ${rttColor}60`,
            }}
          >
            {rtt > 0 ? `${rtt.toFixed(1)} ms` : '--'}
          </span>
        </div>

        {/* Watchdog Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck
            size={14}
            color={telemetry.watchdogActive ? 'var(--color-neon-green)' : 'var(--color-text-muted)'}
          />
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: telemetry.watchdogActive ? 'var(--color-neon-green)' : 'var(--color-text-muted)',
            }}
          >
            100MS WD
          </span>
        </div>

        {/* Expand / Collapse Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded Metrics Details (3D Sunken Display) */}
      {expanded && (
        <div
          className="neo-sunken"
          style={{
            marginTop: '10px',
            padding: '10px 12px',
            borderRadius: '8px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            fontSize: '0.725rem',
            fontWeight: 700,
          }}
        >
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>JITTER: </span>
            <span style={{ color: 'var(--color-text-primary)' }}>
              ±{telemetry.jitterMs.toFixed(1)} ms
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>RATE: </span>
            <span style={{ color: 'var(--color-neon-cyan)' }}>
              {telemetry.pps} pkt/s
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>TX PKTS: </span>
            <span style={{ color: 'var(--color-text-primary)' }}>
              {telemetry.packetsSent.toLocaleString()}
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>RX PKTS: </span>
            <span style={{ color: 'var(--color-text-primary)' }}>
              {telemetry.packetsReceived.toLocaleString()}
            </span>
          </div>

          {telemetry.hostIp && (
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>HOST: </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{telemetry.hostIp}</span>
            </div>
          )}

          <div
            style={{
              gridColumn: 'span 2',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>CHANNEL HEALTH</span>
            <span style={{ color: rttColor, fontWeight: 800, fontSize: '0.7rem' }}>{rttLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
};
