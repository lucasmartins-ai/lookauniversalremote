import { describe, it, expect } from 'vitest';
import { TargetDeviceType } from '@lookaremote/protocol-types';
import { TargetSelector } from '../features/tv/TargetSelector';

describe('TargetSelector', () => {
  it('should export component cleanly', () => {
    expect(TargetSelector).toBeDefined();
  });

  it('should format protocol constants correctly', () => {
    expect(TargetDeviceType.SAMSUNG_TIZEN).toBe(1);
    expect(TargetDeviceType.LG_WEBOS).toBe(2);
    expect(TargetDeviceType.ANDROID_GOOGLE_TV).toBe(3);
    expect(TargetDeviceType.ROKU_TV).toBe(4);
    expect(TargetDeviceType.SONY_BRAVIA).toBe(5);
    expect(TargetDeviceType.APPLE_TV).toBe(6);
  });
});
