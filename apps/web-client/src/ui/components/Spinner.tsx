import React from 'react';

export interface SpinnerProps {
  size?: number;
  color?: string;
  className?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 40,
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
        gap: '12px',
      }}
    >
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer Ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid rgba(0, 229, 255, 0.15)`,
          }}
        />
        {/* Rotating Arc */}
        <div
          className="animate-radar-sweep"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid transparent`,
            borderTopColor: color,
            borderRightColor: color,
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
        {/* Inner Pulsing Core */}
        <div
          className="animate-pulse-glow"
          style={{
            width: `${Math.max(6, size * 0.25)}px`,
            height: `${Math.max(6, size * 0.25)}px`,
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
      </div>

      {label && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
