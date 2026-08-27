/**
 * Custom Touch Layout Studio Component.
 * Interactive visual canvas editor for creating, editing, and managing touch controller layouts.
 */

import React, { useState, useRef } from 'react';
import { useCustomLayout } from './useCustomLayout';
import { LayoutStorageManager } from './layoutStorage';
import { GamepadButtonBit } from '@lookaremote/protocol-types';
import { haptics } from '../../ui/haptics/hapticEngine';

interface LayoutStudioViewProps {
  onClose: () => void;
}

const BUTTON_BIT_OPTIONS = [
  { label: 'A (South)', value: GamepadButtonBit.SOUTH },
  { label: 'B (East)', value: GamepadButtonBit.EAST },
  { label: 'X (West)', value: GamepadButtonBit.WEST },
  { label: 'Y (North)', value: GamepadButtonBit.NORTH },
  { label: 'LB (Left Shoulder)', value: GamepadButtonBit.SHOULDER_L },
  { label: 'RB (Right Shoulder)', value: GamepadButtonBit.SHOULDER_R },
  { label: 'LS Click (Thumb L)', value: GamepadButtonBit.THUMB_L },
  { label: 'RS Click (Thumb R)', value: GamepadButtonBit.THUMB_R },
  { label: 'Start / Menu', value: GamepadButtonBit.START },
  { label: 'Select / View', value: GamepadButtonBit.SELECT },
  { label: 'D-Pad Up', value: GamepadButtonBit.DPAD_UP },
  { label: 'D-Pad Down', value: GamepadButtonBit.DPAD_DOWN },
  { label: 'D-Pad Left', value: GamepadButtonBit.DPAD_LEFT },
  { label: 'D-Pad Right', value: GamepadButtonBit.DPAD_RIGHT },
];

export const LayoutStudioView: React.FC<LayoutStudioViewProps> = ({ onClose }) => {
  const {
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
  } = useCustomLayout();

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handlePointerDownElement = (e: React.PointerEvent, elemId: string, origX: number, origY: number) => {
    e.stopPropagation();
    haptics.lightTap();
    setSelectedElementId(elemId);
    dragRef.current = {
      id: elemId,
      startX: e.clientX,
      startY: e.clientY,
      origX,
      origY,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = Math.max(0, dragRef.current.origX + dx);
    const newY = Math.max(0, dragRef.current.origY + dy);
    updateElement(dragRef.current.id, { x: newX, y: newY });
  };

  const handlePointerUpCanvas = () => {
    dragRef.current = null;
  };

  const handleExport = () => {
    haptics.buttonClick();
    const json = LayoutStorageManager.exportLayoutToJson(activeLayout);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeLayout.name.toLowerCase().replace(/\s+/g, '-')}-layout.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    try {
      setImportError(null);
      const imported = LayoutStorageManager.importLayoutFromJson(importJsonText);
      haptics.pairSuccess();
      refreshLayouts();
      selectLayout(imported.id);
      setImportModalOpen(false);
      setImportJsonText('');
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse layout JSON');
      haptics.errorAlert();
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Header / Bar */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <button onClick={onClose} style={styles.backButton}>
            ← Back to Gamepad
          </button>
          <h2 style={styles.title}>🎨 Touch Layout Studio</h2>
          <span style={styles.activePill}>
            {activeLayout.name} {activeLayout.isPreset ? '(Preset)' : '(Custom)'}
          </span>
        </div>

        <div style={styles.topBarRight}>
          {/* Preset Selector */}
          <select
            value={activeLayout.id}
            onChange={(e) => selectLayout(e.target.value)}
            style={styles.select}
          >
            {allLayouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} {l.isPreset ? '★' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              const name = prompt('Layout Name:', 'My Custom Layout');
              if (name) createNewLayout(name);
            }}
            style={styles.actionBtn}
          >
            + New
          </button>

          <button
            onClick={() => duplicateLayout(activeLayout.id)}
            style={styles.actionBtn}
          >
            Duplicate
          </button>

          <button onClick={handleExport} style={styles.actionBtn}>
            Export JSON
          </button>

          <button
            onClick={() => setImportModalOpen(true)}
            style={styles.actionBtn}
          >
            Import JSON
          </button>

          {!activeLayout.isPreset && (
            <button onClick={deleteActiveLayout} style={styles.deleteBtn}>
              Delete
            </button>
          )}

          {/* Grid Snap selector */}
          <select
            value={activeLayout.gridSnap}
            onChange={(e) => setGridSnap(Number(e.target.value))}
            style={styles.snapSelect}
          >
            <option value={0}>Snap: Off</option>
            <option value={8}>Snap: 8px</option>
            <option value={16}>Snap: 16px</option>
            <option value={24}>Snap: 24px</option>
          </select>
        </div>
      </div>

      {/* Main Studio Body: Palette, Canvas & Inspector */}
      <div style={styles.mainBody}>
        {/* Left Palette */}
        <div style={styles.palette}>
          <div style={styles.sectionHeader}>Add Controls</div>

          <button
            onClick={() => addElement('button')}
            style={styles.paletteBtn}
          >
            🔘 Action Button
          </button>

          <button
            onClick={() => addElement('stick')}
            style={styles.paletteBtn}
          >
            🕹️ Thumbstick (LS/RS)
          </button>

          <button
            onClick={() => addElement('dpad')}
            style={styles.paletteBtn}
          >
            ➕ D-Pad Cross
          </button>

          <button
            onClick={() => addElement('trigger')}
            style={styles.paletteBtn}
          >
            ⚡ Trigger (LT/RT)
          </button>

          <button
            onClick={() => addElement('turbo')}
            style={{ ...styles.paletteBtn, borderColor: '#FF0055' }}
          >
            🔥 Turbo Fire
          </button>

          <button
            onClick={() => addElement('macro')}
            style={{ ...styles.paletteBtn, borderColor: '#9900FF' }}
          >
            ⚡ Macro Combo
          </button>

          <button
            onClick={() => addElement('touchpad')}
            style={styles.paletteBtn}
          >
            🖱️ Trackpad
          </button>

          <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: '#8B949E', lineHeight: '1.4' }}>
            💡 Drag elements across canvas to position. Magnetic grid snaps automatically.
          </div>
        </div>

        {/* Central Visual Canvas */}
        <div
          ref={canvasRef}
          style={{
            ...styles.canvas,
            backgroundImage:
              activeLayout.gridSnap > 0
                ? `linear-gradient(to right, rgba(0, 229, 255, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 229, 255, 0.08) 1px, transparent 1px)`
                : 'none',
            backgroundSize: `${activeLayout.gridSnap}px ${activeLayout.gridSnap}px`,
          }}
          onPointerMove={handlePointerMoveCanvas}
          onPointerUp={handlePointerUpCanvas}
          onClick={() => setSelectedElementId(null)}
        >
          {activeLayout.elements.map((elem) => {
            const isSelected = elem.id === selectedElementId;
            return (
              <div
                key={elem.id}
                onPointerDown={(e) => handlePointerDownElement(e, elem.id, elem.x, elem.y)}
                style={{
                  ...styles.canvasElement,
                  left: elem.x,
                  top: elem.y,
                  width: elem.width,
                  height: elem.height,
                  borderColor: isSelected ? '#FFFFFF' : elem.color || '#00E5FF',
                  boxShadow: isSelected
                    ? '0 0 16px rgba(255, 255, 255, 0.8), inset 0 0 10px rgba(0, 229, 255, 0.3)'
                    : `0 0 8px ${elem.color || 'rgba(0, 229, 255, 0.3)'}`,
                  borderRadius: elem.type === 'stick' ? '50%' : '12px',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: elem.color || '#fff' }}>
                  {elem.label}
                </span>
                <span style={{ fontSize: '0.6rem', color: '#8B949E' }}>
                  {elem.type.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right Inspector Sidebar */}
        <div style={styles.inspector}>
          <div style={styles.sectionHeader}>Properties Inspector</div>

          {selectedElement ? (
            <div style={styles.inspectorContent}>
              <label style={styles.fieldLabel}>
                Label
                <input
                  type="text"
                  value={selectedElement.label}
                  onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
                  style={styles.input}
                />
              </label>

              <label style={styles.fieldLabel}>
                Button Bitmask Mapping
                <select
                  value={selectedElement.mapping.buttonBit || 0}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      mapping: { ...selectedElement.mapping, buttonBit: Number(e.target.value) },
                    })
                  }
                  style={styles.select}
                >
                  <option value={0}>None / Axis</option>
                  {BUTTON_BIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              {selectedElement.type === 'turbo' && (
                <label style={styles.fieldLabel}>
                  Turbo Rate: {selectedElement.mapping.turboRateHz || 15} Hz
                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={1}
                    value={selectedElement.mapping.turboRateHz || 15}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        mapping: { ...selectedElement.mapping, turboRateHz: Number(e.target.value) },
                      })
                    }
                    style={styles.rangeInput}
                  />
                </label>
              )}

              <div style={styles.coordGrid}>
                <label style={styles.coordLabel}>
                  X
                  <input
                    type="number"
                    value={selectedElement.x}
                    onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })}
                    style={styles.coordInput}
                  />
                </label>

                <label style={styles.coordLabel}>
                  Y
                  <input
                    type="number"
                    value={selectedElement.y}
                    onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })}
                    style={styles.coordInput}
                  />
                </label>

                <label style={styles.coordLabel}>
                  W
                  <input
                    type="number"
                    value={selectedElement.width}
                    onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) })}
                    style={styles.coordInput}
                  />
                </label>

                <label style={styles.coordLabel}>
                  H
                  <input
                    type="number"
                    value={selectedElement.height}
                    onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) })}
                    style={styles.coordInput}
                  />
                </label>
              </div>

              <button
                onClick={() => removeElement(selectedElement.id)}
                style={styles.deleteElemBtn}
              >
                🗑️ Delete Element
              </button>
            </div>
          ) : (
            <div style={styles.emptyInspector}>
              Select any control on the canvas to inspect and edit its bindings.
            </div>
          )}
        </div>
      </div>

      {/* JSON Import Modal */}
      {importModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Import Layout JSON</h3>
            <p style={{ color: '#8B949E', fontSize: '0.8rem', marginBottom: '12px' }}>
              Paste your exported LookARemote layout JSON snippet below:
            </p>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{ "name": "Custom", "elements": [...] }'
              rows={10}
              style={styles.textarea}
            />

            {importError && (
              <div style={{ color: '#FF0055', fontSize: '0.8rem', marginBottom: '12px' }}>
                ⚠️ {importError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setImportModalOpen(false)}
                style={styles.actionBtn}
              >
                Cancel
              </button>
              <button onClick={handleImportSubmit} style={styles.primaryBtn}>
                Import Layout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#05080C',
    color: '#F0F6FC',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 9999,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    userSelect: 'none',
  },
  topBar: {
    height: '60px',
    backgroundColor: '#0A1018',
    borderBottom: '1px solid rgba(0, 229, 255, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  backButton: {
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#00E5FF',
    padding: '6px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  title: {
    fontSize: '1rem',
    fontWeight: 800,
    margin: 0,
  },
  activePill: {
    fontSize: '0.75rem',
    padding: '3px 8px',
    borderRadius: '999px',
    background: 'rgba(0, 229, 255, 0.15)',
    border: '1px solid #00E5FF',
    color: '#00E5FF',
    fontWeight: 700,
  },
  select: {
    background: '#0D1520',
    color: '#F0F6FC',
    border: '1px solid rgba(0, 229, 255, 0.3)',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '0.8rem',
  },
  snapSelect: {
    background: '#0D1520',
    color: '#FFE600',
    border: '1px solid rgba(255, 230, 0, 0.3)',
    borderRadius: '8px',
    padding: '6px 8px',
    fontSize: '0.75rem',
  },
  actionBtn: {
    background: '#162232',
    color: '#F0F6FC',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  deleteBtn: {
    background: 'rgba(255, 0, 85, 0.2)',
    color: '#FF0055',
    border: '1px solid #FF0055',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  mainBody: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  palette: {
    width: '180px',
    backgroundColor: '#0A1018',
    borderRight: '1px solid rgba(0, 229, 255, 0.15)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionHeader: {
    fontSize: '0.75rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#8B949E',
    marginBottom: '8px',
  },
  paletteBtn: {
    background: '#111A24',
    border: '1px solid rgba(0, 229, 255, 0.3)',
    borderRadius: '8px',
    color: '#F0F6FC',
    padding: '8px',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left',
  },
  canvas: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#05080C',
    overflow: 'auto',
  },
  canvasElement: {
    position: 'absolute',
    border: '2px solid #00E5FF',
    backgroundColor: 'rgba(10, 20, 32, 0.85)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    touchAction: 'none',
  },
  inspector: {
    width: '240px',
    backgroundColor: '#0A1018',
    borderLeft: '1px solid rgba(0, 229, 255, 0.15)',
    padding: '16px',
    overflowY: 'auto',
  },
  inspectorContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  emptyInspector: {
    fontSize: '0.8rem',
    color: '#8B949E',
    lineHeight: '1.5',
  },
  fieldLabel: {
    fontSize: '0.75rem',
    color: '#8B949E',
    fontWeight: 700,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  input: {
    background: '#0D1520',
    border: '1px solid rgba(0, 229, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    padding: '6px 8px',
    fontSize: '0.8rem',
  },
  rangeInput: {
    accentColor: '#FF0055',
  },
  coordGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  coordLabel: {
    fontSize: '0.7rem',
    color: '#8B949E',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  coordInput: {
    background: '#0D1520',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    color: '#fff',
    padding: '4px 6px',
    fontSize: '0.75rem',
  },
  deleteElemBtn: {
    marginTop: '12px',
    background: 'rgba(255, 0, 85, 0.15)',
    border: '1px solid #FF0055',
    color: '#FF0055',
    padding: '8px',
    borderRadius: '8px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modalContent: {
    background: '#0D1520',
    border: '1px solid rgba(0, 229, 255, 0.4)',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
  },
  modalTitle: {
    margin: '0 0 8px 0',
    fontSize: '1.2rem',
    color: '#00E5FF',
  },
  textarea: {
    width: '100%',
    background: '#05080C',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#00E5FF',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    padding: '8px',
    marginBottom: '16px',
    boxSizing: 'border-box',
  },
  primaryBtn: {
    background: '#00E5FF',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
