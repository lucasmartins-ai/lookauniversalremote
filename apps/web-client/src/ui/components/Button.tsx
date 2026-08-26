import React, { forwardRef } from 'react';
import { haptics } from '../haptics/hapticEngine';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  hapticFeedback?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      hapticFeedback = true,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled = false,
      className = '',
      onPointerDown,
      ...rest
    },
    ref
  ) => {
    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!disabled && hapticFeedback) {
        if (variant === 'danger') {
          haptics.heavyClick();
        } else {
          haptics.buttonClick();
        }
      }
      onPointerDown?.(e);
    };

    // Variant Styles
    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: 'rgba(0, 229, 255, 0.12)',
        borderColor: 'var(--color-neon-cyan)',
        color: 'var(--color-neon-cyan)',
        boxShadow: '0 0 12px rgba(0, 229, 255, 0.25)',
      },
      secondary: {
        backgroundColor: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-subtle)',
        color: 'var(--color-text-primary)',
      },
      danger: {
        backgroundColor: 'rgba(255, 23, 68, 0.12)',
        borderColor: 'var(--color-neon-red)',
        color: 'var(--color-neon-red)',
        boxShadow: '0 0 12px rgba(255, 23, 68, 0.25)',
      },
      success: {
        backgroundColor: 'rgba(118, 255, 3, 0.12)',
        borderColor: 'var(--color-neon-green)',
        color: 'var(--color-neon-green)',
        boxShadow: '0 0 12px rgba(118, 255, 3, 0.25)',
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        color: 'var(--color-text-secondary)',
      },
    };

    // Size Styles
    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: {
        padding: '6px 12px',
        fontSize: '0.825rem',
        borderRadius: '6px',
        gap: '6px',
      },
      md: {
        padding: '10px 18px',
        fontSize: '0.95rem',
        borderRadius: '8px',
        gap: '8px',
      },
      lg: {
        padding: '14px 24px',
        fontSize: '1.1rem',
        borderRadius: '10px',
        gap: '10px',
      },
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderWidth: '1px',
          borderStyle: 'solid',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          transition: 'all var(--transition-fast)',
          width: fullWidth ? '100%' : 'auto',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'manipulation',
          ...sizeStyles[size],
          ...variantStyles[variant],
        }}
        className={`lookaremote-btn ${className}`}
        {...rest}
      >
        {leftIcon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{leftIcon}</span>}
        {children}
        {rightIcon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
