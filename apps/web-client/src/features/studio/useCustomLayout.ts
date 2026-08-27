/**
 * React hook managing Custom Layout Studio state, element manipulation, magnetic snapping, and presets.
 */

import { useState, useCallback, useEffect } from 'react';
import { CustomLayout, StudioElement, TouchElementType } from './types';
import { LayoutStorageManager } from './layoutStorage';
import { GamepadButtonBit } from '@lookaremote/protocol-types';

export function snapValue(val: number, snap: number): number {
  if (snap <= 0) return Math.round(val);
  return Math.round(val / snap) * snap;
}

export function useCustomLayout() {
  const [allLayouts, setAllLayouts] = useState<CustomLayout[]>(() =>
    LayoutStorageManager.loadAllLayouts(),
  );
  const [activeLayout, setActiveLayout] = useState<CustomLayout>(() =>
    LayoutStorageManager.getActiveLayout(),
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Sync active layout selection
  const selectLayout = useCallback((id: string) => {
    LayoutStorageManager.setActiveLayoutId(id);
    const found = LayoutStorageManager.loadAllLayouts().find((l) => l.id === id);
    if (found) {
      setActiveLayout(found);
      setSelectedElementId(null);
    }
  }, []);

  // Reload list
  const refreshLayouts = useCallback(() => {
    const list = LayoutStorageManager.loadAllLayouts();
    setAllLayouts(list);
    const active = LayoutStorageManager.getActiveLayout();
    setActiveLayout(active);
  }, []);

  // Create new blank layout
  const createNewLayout = useCallback((name: string, orientation: 'landscape' | 'portrait' = 'landscape') => {
    const newLayout: CustomLayout = {
      id: `custom-layout-${Date.now()}`,
      name: name || 'My Custom Layout',
      description: 'Customized touch controller layout',
      orientation,
      elements: [],
      gridSnap: 16,
      isPreset: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    LayoutStorageManager.saveLayout(newLayout);
    LayoutStorageManager.setActiveLayoutId(newLayout.id);
    refreshLayouts();
    return newLayout;
  }, [refreshLayouts]);

  // Duplicate an existing layout or preset
  const duplicateLayout = useCallback((id: string) => {
    const source = allLayouts.find((l) => l.id === id) || activeLayout;
    const duplicated: CustomLayout = {
      ...source,
      id: `custom-layout-${Date.now()}`,
      name: `${source.name} (Copy)`,
      isPreset: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    LayoutStorageManager.saveLayout(duplicated);
    LayoutStorageManager.setActiveLayoutId(duplicated.id);
    refreshLayouts();
    return duplicated;
  }, [allLayouts, activeLayout, refreshLayouts]);

  // Update a single element on the active layout
  const updateElement = useCallback((elementId: string, updates: Partial<StudioElement>) => {
    setActiveLayout((prev) => {
      const updatedElements = prev.elements.map((elem) => {
        if (elem.id !== elementId) return elem;
        const grid = prev.gridSnap || 0;
        const newX = updates.x !== undefined ? snapValue(updates.x, grid) : elem.x;
        const newY = updates.y !== undefined ? snapValue(updates.y, grid) : elem.y;
        const newW = updates.width !== undefined ? Math.max(30, snapValue(updates.width, grid)) : elem.width;
        const newH = updates.height !== undefined ? Math.max(30, snapValue(updates.height, grid)) : elem.height;

        return {
          ...elem,
          ...updates,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
          mapping: {
            ...elem.mapping,
            ...(updates.mapping || {}),
          },
        };
      });

      const updatedLayout: CustomLayout = {
        ...prev,
        elements: updatedElements,
        updatedAt: Date.now(),
      };

      if (!updatedLayout.isPreset) {
        LayoutStorageManager.saveLayout(updatedLayout);
      }
      return updatedLayout;
    });
  }, []);

  // Add new element to active layout
  const addElement = useCallback((type: TouchElementType, x = 100, y = 100) => {
    setActiveLayout((prev) => {
      const grid = prev.gridSnap || 0;
      let label = 'BTN';
      let width = 60;
      let height = 60;
      let color = '#00E5FF';
      let defaultMapping = {};

      switch (type) {
        case 'stick':
          label = 'Stick';
          width = 130;
          height = 130;
          color = '#00E5FF';
          defaultMapping = { axisX: 'stick_lx', axisY: 'stick_ly', buttonBit: GamepadButtonBit.THUMB_L };
          break;
        case 'dpad':
          label = 'D-Pad';
          width = 120;
          height = 120;
          color = '#FFE600';
          break;
        case 'trigger':
          label = 'Trigger';
          width = 80;
          height = 50;
          color = '#00FF66';
          defaultMapping = { triggerSide: 'right' };
          break;
        case 'turbo':
          label = '🔥 Turbo';
          width = 90;
          height = 50;
          color = '#FF0055';
          defaultMapping = { buttonBit: GamepadButtonBit.SOUTH, turboRateHz: 15 };
          break;
        case 'macro':
          label = '⚡ Macro';
          width = 100;
          height = 50;
          color = '#9900FF';
          defaultMapping = {
            macroSequence: [GamepadButtonBit.SOUTH, 0, GamepadButtonBit.EAST],
            macroStepDelayMs: 50,
          };
          break;
        case 'touchpad':
          label = 'Touchpad';
          width = 160;
          height = 100;
          color = '#00E5FF';
          break;
        case 'button':
        default:
          label = 'A';
          width = 55;
          height = 55;
          color = '#00E5FF';
          defaultMapping = { buttonBit: GamepadButtonBit.SOUTH };
          break;
      }

      const newElem: StudioElement = {
        id: `elem-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        type,
        label,
        x: snapValue(x, grid),
        y: snapValue(y, grid),
        width: snapValue(width, grid),
        height: snapValue(height, grid),
        color,
        mapping: defaultMapping,
      };

      const updatedLayout: CustomLayout = {
        ...prev,
        isPreset: false,
        elements: [...prev.elements, newElem],
        updatedAt: Date.now(),
      };

      LayoutStorageManager.saveLayout(updatedLayout);
      setSelectedElementId(newElem.id);
      return updatedLayout;
    });
  }, []);

  // Remove element from layout
  const removeElement = useCallback((elementId: string) => {
    setActiveLayout((prev) => {
      const updatedLayout: CustomLayout = {
        ...prev,
        isPreset: false,
        elements: prev.elements.filter((e) => e.id !== elementId),
        updatedAt: Date.now(),
      };
      LayoutStorageManager.saveLayout(updatedLayout);
      if (selectedElementId === elementId) {
        setSelectedElementId(null);
      }
      return updatedLayout;
    });
  }, [selectedElementId]);

  // Set grid snap
  const setGridSnap = useCallback((snap: number) => {
    setActiveLayout((prev) => {
      const updated: CustomLayout = { ...prev, gridSnap: snap };
      if (!updated.isPreset) {
        LayoutStorageManager.saveLayout(updated);
      }
      return updated;
    });
  }, []);

  // Delete current layout
  const deleteActiveLayout = useCallback(() => {
    if (activeLayout.isPreset) return;
    LayoutStorageManager.deleteLayout(activeLayout.id);
    refreshLayouts();
  }, [activeLayout, refreshLayouts]);

  useEffect(() => {
    refreshLayouts();
  }, [refreshLayouts]);

  const selectedElement = activeLayout.elements.find((e) => e.id === selectedElementId) || null;

  return {
    allLayouts,
    activeLayout,
    selectedElement,
    selectedElementId,
    setSelectedElementId,
    selectLayout,
    createNewLayout,
    duplicateLayout,
    updateElement,
    addElement,
    removeElement,
    setGridSnap,
    deleteActiveLayout,
    refreshLayouts,
  };
}
