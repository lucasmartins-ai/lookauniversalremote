import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GestureRecognizer, GestureConfig, TouchPoint, TouchpadOutput } from './GestureRecognizer';
import { haptics } from '../../ui/haptics/hapticEngine';
import { MousePointer } from 'lucide-react';

export interface TrackpadSurfaceProps {
  config: Partial<GestureConfig>;
  onOutput: (output: TouchpadOutput) => void;
}

interface ActivePointerVisual {
  id: number;
  x: number;
  y: number;
}

export const TrackpadSurface: React.FC<TrackpadSurfaceProps> = ({ config, onOutput }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const [activeVisuals, setActiveVisuals] = useState<ActivePointerVisual[]>([]);

  useEffect(() => {
    if (!recognizerRef.current) {
      recognizerRef.current = new GestureRecognizer(config, (output) => {
        if (output.buttonsMask & 0x08) {
          haptics.lightTap();
        } else if (output.buttonsMask & 0x02) {
          haptics.buttonClick();
        }
        onOutput(output);
      });
    } else {
      recognizerRef.current.setConfig(config);
      recognizerRef.current.setCallback((output) => {
        if (output.buttonsMask & 0x08) {
          haptics.lightTap();
        } else if (output.buttonsMask & 0x02) {
          haptics.buttonClick();
        }
        onOutput(output);
      });
    }
  }, [config, onOutput]);

  const extractTouchPoints = useCallback((touchList: React.TouchList | TouchList): TouchPoint[] => {
    const points: TouchPoint[] = [];
    const rect = containerRef.current?.getBoundingClientRect();
    const offsetX = rect ? rect.left : 0;
    const offsetY = rect ? rect.top : 0;

    for (let i = 0; i < touchList.length; i++) {
      const t = touchList.item(i);
      if (t) {
        points.push({
          id: t.identifier,
          x: t.clientX - offsetX,
          y: t.clientY - offsetY,
        });
      }
    }
    return points;
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const points = extractTouchPoints(e.touches);
    setActiveVisuals(points);
    recognizerRef.current?.onTouchStart(points, Date.now());
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const points = extractTouchPoints(e.touches);
    setActiveVisuals(points);
    recognizerRef.current?.onTouchMove(points, Date.now());
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    const activePoints = extractTouchPoints(e.touches);
    const removedIds: number[] = [];
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i);
      if (t) {
        removedIds.push(t.identifier);
      }
    }
    setActiveVisuals(activePoints);
    recognizerRef.current?.onTouchEnd(activePoints, removedIds, Date.now());
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    handleTouchEnd(e);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      className="neo-sunken-deep"
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: '260px',
        borderRadius: '18px',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Background Cyber Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(0, 229, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.03) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
        }}
      />

      {/* Decorative Center Watermark */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          opacity: activeVisuals.length > 0 ? 0.15 : 0.45,
          transition: 'opacity var(--transition-normal)',
          pointerEvents: 'none',
        }}
      >
        <MousePointer size={38} color="var(--color-neon-cyan)" />
        <span
          className="retro-embossed-text"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.9rem',
            letterSpacing: '0.12em',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
          }}
        >
          MULTI-TOUCH TRACKPAD DECK
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            color: 'var(--color-text-muted)',
            fontWeight: 600,
          }}
        >
          1-FINGER: CURSOR & TAP • 2-FINGER: SCROLL & RIGHT TAP
        </span>
      </div>

      {/* Active Touch Visuals */}
      {activeVisuals.map((visual) => (
        <div
          key={visual.id}
          style={{
            position: 'absolute',
            left: visual.x,
            top: visual.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 229, 255, 0.25)',
              border: '2px solid var(--color-neon-cyan)',
              boxShadow: '0 0 18px var(--color-neon-cyan)',
              animation: 'pulse-glow 1s infinite alternate',
            }}
          />
        </div>
      ))}
    </div>
  );
};
