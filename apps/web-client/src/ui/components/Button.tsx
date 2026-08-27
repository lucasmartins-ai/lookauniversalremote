import React, { forwardRef, useState } from 'react';
import { haptics } from '../haptics/hapticEngine';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'amber' | 'ghost';
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
      onPointerUp,
      onPointerCancel,
      ...rest
    },
    ref
  ) => {
    const [isPressed, setIsPressed] = useState(false);

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!disabled) {
        setIsPressed(true);
        if (hapticFeedback) {
          if (variant === 'danger') {
            haptics.heavyClick();
          } else {
            haptics.buttonClick();
          }
        }
      }
      onPointerDown?.(e);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
      setIsPressed(false);
      onPointerUp?.(e);
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
      setIsPressed(false);
      onPointerCancel?.(e);
    };

    // 3D Neomorphic Retro Variant Styles
    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        background: isPressed
          ? 'linear-gradient(180deg, #009bb3 0%, #00b4d8 100%)'
          : 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #007791 100%)',
        borderColor: '#00f0ff',
        color: '#040d1a',
        textShadow: isPressed ? 'none' : '0 1px 0 rgba(255, 255, 255, 0.4)',
        boxShadow: isPressed
          ? 'var(--neo-shadow-button-cyan-pressed)'
          : 'var(--neo-shadow-button-cyan)',
        borderTop: '1px solid rgba(255, 255, 255, 0.8)',
        borderBottom: '1px solid #005f73',
      },
      secondary: {
        background: isPressed
          ? 'linear-gradient(180deg, #111722 0%, #161e2e 100%)'
          : 'linear-gradient(180deg, #222d42 0%, #171f2e 60%, #0e1420 100%)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        color: '#f1f5f9',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
        boxShadow: isPressed
          ? 'var(--neo-shadow-button-slate-pressed)'
          : 'var(--neo-shadow-button-slate)',
        borderTop: '1px solid rgba(255, 255, 255, 0.22)',
        borderBottom: '1px solid #06090e',
      },
      danger: {
        background: isPressed
          ? 'linear-gradient(180deg, #b81438 0%, #8a0c27 100%)'
          : 'linear-gradient(180deg, #ff3366 0%, #e60039 50%, #9e0c29 100%)',
        borderColor: '#ff3366',
        color: '#ffffff',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
        boxShadow: isPressed
          ? 'var(--neo-shadow-button-red-pressed)'
          : 'var(--neo-shadow-button-red)',
        borderTop: '1px solid rgba(255, 255, 255, 0.6)',
        borderBottom: '1px solid #6b0519',
      },
      success: {
        background: isPressed
          ? 'linear-gradient(180deg, #00b36f 0%, #00874e 100%)'
          : 'linear-gradient(180deg, #00f59b 0%, #00cc7a 50%, #007a47 100%)',
        borderColor: '#00f59b',
        color: '#03140a',
        textShadow: '0 1px 0 rgba(255, 255, 255, 0.4)',
        boxShadow: isPressed
          ? 'var(--neo-shadow-button-green-pressed)'
          : 'var(--neo-shadow-button-green)',
        borderTop: '1px solid rgba(255, 255, 255, 0.7)',
        borderBottom: '1px solid #004d2c',
      },
      amber: {
        background: isPressed
          ? 'linear-gradient(180deg, #d98200 0%, #a66000 100%)'
          : 'linear-gradient(180deg, #ffc01e 0%, #ff9e00 50%, #b36b00 100%)',
        borderColor: '#ffc01e',
        color: '#1a0e00',
        textShadow: '0 1px 0 rgba(255, 255, 255, 0.4)',
        boxShadow: isPressed
          ? 'var(--neo-shadow-button-amber-pressed)'
          : 'var(--neo-shadow-button-amber)',
        borderTop: '1px solid rgba(255, 255, 255, 0.7)',
        borderBottom: '1px solid #734500',
      },
      ghost: {
        background: isPressed ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
        borderColor: isPressed ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
        color: isPressed ? '#ffffff' : 'var(--color-text-secondary)',
        boxShadow: isPressed ? 'inset 0 1px 3px rgba(0, 0, 0, 0.5)' : 'none',
      },
    };

    // Size Styles with 3D Keycap proportions
    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: {
        padding: '5px 12px',
        fontSize: '0.8rem',
        borderRadius: '7px',
        gap: '5px',
        height: '32px',
      },
      md: {
        padding: '8px 16px',
        fontSize: '0.9rem',
        borderRadius: '9px',
        gap: '8px',
        height: '40px',
      },
      lg: {
        padding: '12px 22px',
        fontSize: '1.05rem',
        borderRadius: '11px',
        gap: '10px',
        height: '48px',
      },
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.35 : 1,
          width: fullWidth ? '100%' : 'auto',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'manipulation',
          transform: isPressed && !disabled ? 'translateY(3px) scale(0.985)' : 'translateY(0) scale(1)',
          transition: 'transform 80ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 80ms cubic-bezier(0.4, 0, 0.2, 1), background 80ms ease',
          ...sizeStyles[size],
          ...variantStyles[variant],
        }}
        className={`lookaremote-btn retro-btn ${className}`}
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
