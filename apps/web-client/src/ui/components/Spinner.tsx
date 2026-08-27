import React from 'react';

export interface SpinnerProps {
  size?: number;
  color?: string;
  className?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 48,
  color = 'var(--color-neon-cyan)',
  className = '',
  label,
}) => {
  return (
    <div
      className={`lookaremote-spinner-container ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
      }}
    >
      <div
        className="neo-sunken-deep"
        style={{
          width: `${size + 24}px`,
          height: `${size + 24}px`,
          borderRadius: '50%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 4px 10px #000, 0 2px 6px rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Outer CRT/Radar Ring */}
        <div
          style={{
            position: 'absolute',
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            border: `1.5px dashed rgba(0, 229, 255, 0.25)`,
          }}
        />
        {/* Rotating Radar Sweep Beam */}
        <div
          className="animate-radar-sweep"
          style={{
            position: 'absolute',
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            border: `2.5px solid transparent`,
            borderTopColor: color,
            borderRightColor: color,
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
        {/* Inner Phosphor Core */}
        <div
          className="animate-pulse-glow"
          style={{
            width: `${Math.max(8, size * 0.25)}px`,
            height: `${Math.max(8, size * 0.25)}px`,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
      </div>

      {label && (
        <span
          className="retro-embossed-text"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--color-text-primary)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
