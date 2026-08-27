import { describe, it, expect } from 'vitest';
import { snapValue } from '../features/studio/useCustomLayout';

describe('snapValue (Magnetic Snap-to-Grid)', () => {
  it('should snap coordinates to multiples of the grid size', () => {
    expect(snapValue(14, 16)).toBe(16);
    expect(snapValue(7, 16)).toBe(0);
    expect(snapValue(25, 16)).toBe(32);
    expect(snapValue(100, 8)).toBe(104);
    expect(snapValue(101, 8)).toBe(104);
  });

  it('should bypass snapping when grid is 0 or negative', () => {
    expect(snapValue(14.7, 0)).toBe(15);
    expect(snapValue(23.2, 0)).toBe(23);
  });
});
