import React from 'react';
import { Tv, Monitor, Gamepad2, Check } from 'lucide-react';
import { haptics } from '../../ui/haptics/hapticEngine';
import { TargetDeviceType, TargetDeviceTypeValue } from '@lookaremote/protocol-types';

export type MainTargetCategory = 'tv' | 'pc' | 'console';

export interface TargetSelectorProps {
  currentTargetCategory: MainTargetCategory;
  onSelectCategory: (category: MainTargetCategory) => void;
  selectedTvDevice: TargetDeviceTypeValue;
  onSelectTvDevice: (device: TargetDeviceTypeValue) => void;
}

const TV_BRANDS: { id: TargetDeviceTypeValue; name: string; brandColor: string }[] = [
  { id: TargetDeviceType.SAMSUNG_TIZEN, name: 'Samsung Smart TV (Tizen)', brandColor: '#1428a0' },
  { id: TargetDeviceType.LG_WEBOS, name: 'LG Smart TV (webOS)', brandColor: '#a50034' },
  { id: TargetDeviceType.ANDROID_GOOGLE_TV, name: 'Google / Android TV', brandColor: '#34a853' },
  { id: TargetDeviceType.ROKU_TV, name: 'Roku TV / Streaming Stick', brandColor: '#662d91' },
  { id: TargetDeviceType.SONY_BRAVIA, name: 'Sony Bravia (Android/Google)', brandColor: '#ffffff' },
  { id: TargetDeviceType.APPLE_TV, name: 'Apple TV (tvOS)', brandColor: '#a2aaad' },
  { id: TargetDeviceType.GENERIC_TV, name: 'Generic TV (HDMI-CEC / DLNA)', brandColor: '#00e5ff' },
];

export const TargetSelector: React.FC<TargetSelectorProps> = ({
  currentTargetCategory,
  onSelectCategory,
  selectedTvDevice,
  onSelectTvDevice,
}) => {
  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: '10px' }}>
      {/* Category Switcher: SMART TV / PC / CONSOLE */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px',
          borderRadius: '12px',
          backgroundColor: 'rgba(10, 15, 22, 0.95)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.5)',
        }}
      >
        {/* TV Mode Pill */}
        <button
          type="button"
          onClick={() => {
            haptics.buttonClick();
            onSelectCategory('tv');
          }}
          style={{
            flex: 1.2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 10px',
            borderRadius: '8px',
            backgroundColor:
              currentTargetCategory === 'tv' ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
            border: currentTargetCategory === 'tv' ? '1px solid var(--color-neon-cyan)' : '1px solid transparent',
            color: currentTargetCategory === 'tv' ? 'var(--color-neon-cyan)' : 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            boxShadow: currentTargetCategory === 'tv' ? '0 0 12px rgba(0, 229, 255, 0.25)' : 'none',
          }}
        >
          <Tv size={16} />
          <span>📺 SMART TV</span>
        </button>

        {/* PC / Mac Pill */}
        <button
          type="button"
          onClick={() => {
            haptics.buttonClick();
            onSelectCategory('pc');
          }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 10px',
            borderRadius: '8px',
            backgroundColor:
              currentTargetCategory === 'pc' ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
            border: currentTargetCategory === 'pc' ? '1px solid var(--color-neon-cyan)' : '1px solid transparent',
            color: currentTargetCategory === 'pc' ? 'var(--color-neon-cyan)' : 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Monitor size={15} />
          <span>💻 PC / MAC</span>
        </button>

        {/* Console Pill */}
        <button
          type="button"
          onClick={() => {
            haptics.buttonClick();
            onSelectCategory('console');
          }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 10px',
            borderRadius: '8px',
            backgroundColor:
              currentTargetCategory === 'console' ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
            border: currentTargetCategory === 'console' ? '1px solid var(--color-neon-cyan)' : '1px solid transparent',
            color: currentTargetCategory === 'console' ? 'var(--color-neon-cyan)' : 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Gamepad2 size={15} />
          <span>🎮 CONSOLE</span>
        </button>
      </div>

      {/* DIRECT VISIBLE TV BRANDS SELECTOR STRIP */}
      {currentTargetCategory === 'tv' && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontSize: '0.65rem',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              paddingLeft: '4px',
            }}
          >
            Selecione a marca da sua TV:
          </div>

          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '4px',
              scrollbarWidth: 'none',
            }}
          >
            {TV_BRANDS.map((brand) => {
              const isSelected = brand.id === selectedTvDevice;
              return (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => {
                    haptics.buttonClick();
                    onSelectTvDevice(brand.id);
                  }}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '20px',
                    backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: isSelected ? '1.5px solid var(--color-neon-cyan)' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: isSelected ? '#ffffff' : 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: isSelected ? '0 0 10px rgba(0, 229, 255, 0.3)' : 'none',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: brand.brandColor,
                      boxShadow: isSelected ? `0 0 6px ${brand.brandColor}` : 'none',
                    }}
                  />
                  <span>{brand.name.split(' (')[0]}</span>
                  {isSelected && <Check size={13} color="var(--color-neon-cyan)" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
