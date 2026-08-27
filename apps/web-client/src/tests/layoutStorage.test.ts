import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutStorageManager } from '../features/studio/layoutStorage';
import { CustomLayout } from '../features/studio/types';

class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }
  getItem(key: string) {
    return this.store[key] || null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
}

describe('LayoutStorageManager', () => {
  beforeEach(() => {
    (global as any).localStorage = new LocalStorageMock();
  });

  it('should load default built-in presets when storage is empty', () => {
    const layouts = LayoutStorageManager.loadAllLayouts();
    expect(layouts.length).toBeGreaterThanOrEqual(3);
    const names = layouts.map((l) => l.name);
    expect(names).toContain('Standard Xbox Dual-Stick');
    expect(names).toContain('FPS 4-Finger Claw');
    expect(names).toContain('6-Button Arcade Fighter');
  });

  it('should save, retrieve, and delete a custom user layout', () => {
    const custom: CustomLayout = {
      id: 'custom-123',
      name: 'Custom Racing Wheel',
      description: 'Pedals and paddle shifters',
      orientation: 'landscape',
      elements: [
        {
          id: 'btn-paddle-l',
          type: 'button',
          label: 'Gear Down',
          x: 50,
          y: 100,
          width: 80,
          height: 60,
          mapping: { buttonBit: 0x0100 },
        },
      ],
      gridSnap: 16,
      isPreset: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    LayoutStorageManager.saveLayout(custom);
    const userLayouts = LayoutStorageManager.loadUserLayouts();
    expect(userLayouts).toHaveLength(1);
    expect(userLayouts[0].name).toBe('Custom Racing Wheel');

    // Delete layout
    const deleted = LayoutStorageManager.deleteLayout('custom-123');
    expect(deleted).toBe(true);
    expect(LayoutStorageManager.loadUserLayouts()).toHaveLength(0);
  });

  it('should export layout to valid JSON string and import it back', () => {
    const custom: CustomLayout = {
      id: 'custom-export-test',
      name: 'Speedrun Macro Layout',
      description: 'Quick combos and turbo fire',
      orientation: 'landscape',
      elements: [
        {
          id: 'turbo-fire',
          type: 'turbo',
          label: '🔥 Rapid A',
          x: 200,
          y: 150,
          width: 90,
          height: 50,
          mapping: { buttonBit: 0x0001, turboRateHz: 20 },
        },
      ],
      gridSnap: 8,
      isPreset: false,
      createdAt: 1000,
      updatedAt: 1000,
    };

    const json = LayoutStorageManager.exportLayoutToJson(custom);
    expect(typeof json).toBe('string');
    expect(json).toContain('"Speedrun Macro Layout"');
    expect(json).toContain('"turboRateHz": 20');

    const imported = LayoutStorageManager.importLayoutFromJson(json);
    expect(imported.name).toBe('Speedrun Macro Layout (Imported)');
    expect(imported.elements).toHaveLength(1);
    expect(imported.elements[0].type).toBe('turbo');
    expect(imported.elements[0].mapping.turboRateHz).toBe(20);
    expect(imported.isPreset).toBe(false);
  });

  it('should reject invalid JSON during import', () => {
    expect(() => LayoutStorageManager.importLayoutFromJson('invalid json')).toThrow();
    expect(() => LayoutStorageManager.importLayoutFromJson('{"elements": "not an array"}')).toThrow();
  });
});
