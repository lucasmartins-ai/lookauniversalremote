/**
 * Storage and JSON Serialization Manager for Custom Touch Layouts.
 */

import { CustomLayout } from './types';
import { BUILTIN_PRESETS, DEFAULT_XBOX_LAYOUT } from './presets';

const STORAGE_KEY = 'lookaremote_touch_layouts';
const ACTIVE_LAYOUT_KEY = 'lookaremote_active_layout_id';

export class LayoutStorageManager {
  /**
   * Retrieves all available layouts (built-in presets + user custom layouts).
   */
  public static loadAllLayouts(): CustomLayout[] {
    const userLayouts = this.loadUserLayouts();
    return [...BUILTIN_PRESETS, ...userLayouts];
  }

  /**
   * Retrieves user-created layouts from localStorage.
   */
  public static loadUserLayouts(): CustomLayout[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse saved touch layouts from localStorage:', e);
      return [];
    }
  }

  /**
   * Persists a new or updated custom layout to localStorage.
   */
  public static saveLayout(layout: CustomLayout): void {
    if (typeof localStorage === 'undefined') return;
    const userLayouts = this.loadUserLayouts();
    const existingIndex = userLayouts.findIndex((l) => l.id === layout.id);

    const updatedLayout: CustomLayout = {
      ...layout,
      isPreset: false,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      userLayouts[existingIndex] = updatedLayout;
    } else {
      userLayouts.push(updatedLayout);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userLayouts));
    } catch (e) {
      console.error('Failed to save touch layout to localStorage:', e);
    }
  }

  /**
   * Deletes a user layout from localStorage.
   */
  public static deleteLayout(id: string): boolean {
    if (typeof localStorage === 'undefined') return false;
    const userLayouts = this.loadUserLayouts().filter((l) => l.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userLayouts));
      if (this.getActiveLayoutId() === id) {
        this.setActiveLayoutId(DEFAULT_XBOX_LAYOUT.id);
      }
      return true;
    } catch (e) {
      console.error('Failed to delete touch layout from localStorage:', e);
      return false;
    }
  }

  /**
   * Returns the currently active layout ID.
   */
  public static getActiveLayoutId(): string {
    if (typeof localStorage === 'undefined') return DEFAULT_XBOX_LAYOUT.id;
    return localStorage.getItem(ACTIVE_LAYOUT_KEY) || DEFAULT_XBOX_LAYOUT.id;
  }

  /**
   * Sets the active layout ID.
   */
  public static setActiveLayoutId(id: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ACTIVE_LAYOUT_KEY, id);
  }

  /**
   * Returns the currently active layout.
   */
  public static getActiveLayout(): CustomLayout {
    const activeId = this.getActiveLayoutId();
    const all = this.loadAllLayouts();
    return all.find((l) => l.id === activeId) || DEFAULT_XBOX_LAYOUT;
  }

  /**
   * Serializes a layout to pretty-formatted JSON.
   */
  public static exportLayoutToJson(layout: CustomLayout): string {
    return JSON.stringify(layout, null, 2);
  }

  /**
   * Validates and imports a layout from JSON string.
   */
  public static importLayoutFromJson(jsonStr: string): CustomLayout {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid JSON format: expected a root layout object');
    }
    if (!parsed.name || typeof parsed.name !== 'string') {
      throw new Error('Invalid layout: missing "name" field');
    }
    if (!Array.isArray(parsed.elements)) {
      throw new Error('Invalid layout: "elements" must be an array');
    }

    const newLayout: CustomLayout = {
      id: `custom-layout-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${parsed.name} (Imported)`,
      description: parsed.description || 'Imported custom touch layout',
      orientation: parsed.orientation === 'portrait' ? 'portrait' : 'landscape',
      elements: parsed.elements.map((elem: any, idx: number) => ({
        id: elem.id || `elem-${idx}-${Date.now()}`,
        type: elem.type || 'button',
        label: elem.label || `Btn ${idx + 1}`,
        x: Number(elem.x) || 50,
        y: Number(elem.y) || 50,
        width: Number(elem.width) || 60,
        height: Number(elem.height) || 60,
        color: elem.color || '#00E5FF',
        mapping: elem.mapping || {},
      })),
      gridSnap: Number(parsed.gridSnap) || 16,
      isPreset: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.saveLayout(newLayout);
    return newLayout;
  }
}
