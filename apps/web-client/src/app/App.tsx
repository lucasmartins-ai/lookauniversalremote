import React, { useState, useCallback, useEffect } from 'react';
import {
  QrCode,
  Sliders,
  Settings,
  ShieldAlert,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { usePairing, PairingSession } from '../features/pairing/usePairing';
import { useWebRtc } from '../features/connection/useWebRtc';
import { useSettings } from '../features/settings/useSettings';
import { useSmartContext, InputMode } from '../features/context/useSmartContext';
import { ContextToast } from '../features/context/ContextToast';
import { useWakeLock } from './useWakeLock';
import { QrScannerView } from '../features/pairing/QrScannerView';
import { ManualPairView } from '../features/pairing/ManualPairView';
import { SettingsModal } from '../features/settings/SettingsModal';
import { TvRemoteView } from '../features/tv/TvRemoteView';
import { AirMouseView } from '../features/airmouse/AirMouseView';
import { GamepadView } from '../features/gamepad/GamepadView';
import { TrackpadView } from '../features/trackpad/TrackpadView';
import { KeyboardView } from '../features/keyboard/KeyboardView';
import { MediaRemoteView } from '../features/media/MediaRemoteView';
import { StatusBadge, StatusVariant } from '../ui/components/StatusBadge';
import { Button } from '../ui/components/Button';
import { Spinner } from '../ui/components/Spinner';
import { haptics } from '../ui/haptics/hapticEngine';

import { useBatteryTelemetry } from '../features/battery/useBatteryTelemetry';

export const App: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { stage: pairingStage, error: pairingError, pairWithRawUri, pairWithParams, reset: resetPairing } = usePairing();
  const { state: connectionState, telemetry, bridge, connect: connectWebRtc, disconnect: disconnectWebRtc } = useWebRtc();

  const [activeTab, setActiveTab] = useState<'qr' | 'manual'>('qr');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeInputMode, setActiveInputMode] = useState<InputMode>('tv');
  const [playerIndex, setPlayerIndex] = useState<number>(0);
  const [playerColor, setPlayerColor] = useState<string>('#00E5FF');

  const {
    selectMode,
    toast,
    dismissToast,
    isManualLocked,
    toggleManualLock,
  } = useSmartContext({
    bridge,
    settings,
    onUpdateSettings: updateSettings,
    activeInputMode,
    setActiveInputMode,
  });

  // Activate Screen Wake Lock during active connection
  useWakeLock(settings.wakeLockEnabled && connectionState === 'connected');

  // Battery Telemetry (auto-reports every 30s)
  const batteryState = useBatteryTelemetry(bridge, playerIndex);

  // Listen to Slot Assignment messages from host
  useEffect(() => {
    if (!bridge) return;
    return bridge.onSlotAssignment((slot) => {
      setPlayerIndex(slot.playerIndex);
      const colors = ['#00E5FF', '#FF007F', '#FFE600', '#00FF66'];
      const color = colors[slot.playerIndex % 4] || '#00E5FF';
      setPlayerColor(color);
      document.documentElement.style.setProperty('--player-accent', color);
    });
  }, [bridge]);

  // Handle successful pairing handshake -> connect WebRTC
  const handlePairingSuccess = useCallback(
    async (session: PairingSession) => {
      try {
        if (session.handshakeResponse.player_index !== undefined) {
          setPlayerIndex(session.handshakeResponse.player_index);
        }
        if (session.handshakeResponse.player_color) {
          setPlayerColor(session.handshakeResponse.player_color);
          document.documentElement.style.setProperty('--player-accent', session.handshakeResponse.player_color);
        }
        await connectWebRtc(session);
      } catch (e) {
        console.error('WebRTC connect error after pairing:', e);
      }
    },
    [connectWebRtc]
  );

  const handleScanQr = async (text: string) => {
    try {
      const session = await pairWithRawUri(text);
      await handlePairingSuccess(session);
    } catch (e) {
      console.warn('Scan handling failed:', e);
    }
  };

  const handleManualPair = async (params: any) => {
    try {
      const session = await pairWithParams(params);
      await handlePairingSuccess(session);
    } catch (e) {
      console.warn('Manual pair handling failed:', e);
    }
  };

  const handleDisconnect = () => {
    disconnectWebRtc();
    resetPairing();
    haptics.disconnectWarning();
  };

  // Status mapping
  let statusVariant: StatusVariant = 'disconnected';
  if (connectionState === 'connected') {
    statusVariant = telemetry.rttMs > 25 ? 'degraded' : 'connected';
  } else if (connectionState === 'connecting' || pairingStage === 'handshaking') {
    statusVariant = 'connecting';
  } else if (pairingStage === 'parsing') {
    statusVariant = 'pairing';
  } else if (connectionState === 'error' || pairingStage === 'error') {
    statusVariant = 'error';
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#000000',
        color: 'var(--color-text-primary)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Background Grid */}
      <div className="cyber-grid-bg" />

      {/* Top Header Bar - Only shown on connection / pairing screen */}
      {connectionState !== 'connected' && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border-subtle)',
            backgroundColor: 'rgba(5, 8, 12, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 40,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(0, 229, 255, 0.15)',
                border: '1px solid var(--color-neon-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 8px rgba(0, 229, 255, 0.3)',
              }}
            >
              <Zap size={16} color="var(--color-neon-cyan)" />
            </div>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#ffffff',
                  lineHeight: 1,
                }}
              >
                LOOKA<span style={{ color: 'var(--color-neon-cyan)' }}>REMOTE</span>
              </h1>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--color-text-muted)',
                  letterSpacing: '0.05em',
                }}
              >
                UNIVERSAL REMOTE • 120HZ
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <StatusBadge status={statusVariant} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              style={{ padding: '6px', borderRadius: '50%' }}
            >
              <Settings size={18} color="var(--color-text-secondary)" />
            </Button>
          </div>
        </header>
      )}

      {/* Main Screen Body */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {/* VIEW 1: NOT CONNECTED (Pairing Scanner & Manual Entry) */}
        {connectionState !== 'connected' && connectionState !== 'connecting' && pairingStage !== 'handshaking' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              justifyContent: 'space-between',
            }}
          >
            {/* View Switcher Tabs */}
            <div
              style={{
                display: 'flex',
                borderRadius: '8px',
                backgroundColor: 'var(--color-surface-card)',
                padding: '4px',
                border: '1px solid var(--color-border-subtle)',
                marginBottom: '16px',
                zIndex: 20,
              }}
            >
              <Button
                variant={activeTab === 'qr' ? 'primary' : 'ghost'}
                size="sm"
                fullWidth
                leftIcon={<QrCode size={16} />}
                onClick={() => {
                  haptics.buttonClick();
                  setActiveTab('qr');
                }}
              >
                QR SCANNER
              </Button>
              <Button
                variant={activeTab === 'manual' ? 'primary' : 'ghost'}
                size="sm"
                fullWidth
                leftIcon={<Sliders size={16} />}
                onClick={() => {
                  haptics.buttonClick();
                  setActiveTab('manual');
                }}
              >
                MANUAL PAIR
              </Button>
            </div>

            {/* Active Subview */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {activeTab === 'qr' ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--color-border-accent)',
                    position: 'relative',
                  }}
                >
                  <QrScannerView onScan={handleScanQr} />
                </div>
              ) : (
                <ManualPairView onPair={handleManualPair} />
              )}
            </div>

            {/* Pairing Error Feedback */}
            {pairingError && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 23, 68, 0.15)',
                  border: '1px solid var(--color-neon-red)',
                  color: 'var(--color-neon-red)',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShieldAlert size={16} />
                <span>{pairingError}</span>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: CONNECTING / HANDSHAKING OVERLAY */}
        {(connectionState === 'connecting' || pairingStage === 'handshaking') && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              gap: '24px',
            }}
          >
            <Spinner size={64} label="NEGOTIATING WEBRTC TRANSPORT" />

            <div
              style={{
                textAlign: 'center',
                maxWidth: '320px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--color-neon-cyan)' }}>
                {pairingStage === 'handshaking'
                  ? 'COMPUTING X25519 DH & HMAC PROOF...'
                  : 'EXCHANGING SDP & TRICKLE ICE CANDIDATES...'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Target: {telemetry.hostIp || 'Local Host'}
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={handleDisconnect} leftIcon={<RefreshCw size={14} />}>
              CANCEL CONNECTION
            </Button>
          </div>
        )}

        {/* VIEW 3: CONNECTED CONTROLLER DASHBOARD */}
        {connectionState === 'connected' && bridge && (
          <div style={{ flex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Smart Context Toast HUD */}
            <ContextToast
              toast={toast}
              onDismiss={dismissToast}
              isManualLocked={isManualLocked}
              onToggleLock={toggleManualLock}
            />

            {activeInputMode === 'tv' ? (
              <TvRemoteView
                bridge={bridge}
                telemetry={telemetry}
                settings={settings}
                activeMode={activeInputMode}
                onSelectMode={(m) => selectMode(m as InputMode)}
                onOpenSettings={() => setSettingsOpen(true)}
                onDisconnect={handleDisconnect}
              />
            ) : activeInputMode === 'airmouse' ? (
              <AirMouseView
                bridge={bridge}
                telemetry={telemetry}
                settings={settings}
                activeMode={activeInputMode}
                onSelectMode={(m) => selectMode(m as InputMode)}
                onOpenSettings={() => setSettingsOpen(true)}
                onDisconnect={handleDisconnect}
              />
            ) : activeInputMode === 'gamepad' ? (
              <GamepadView
                bridge={bridge}
                telemetry={telemetry}
                settings={settings}
                activeMode={activeInputMode as any}
                playerIndex={playerIndex}
                playerColor={playerColor}
                batteryLevel={batteryState.batteryLevel}
                isCharging={batteryState.isCharging}
                onSelectMode={(m) => selectMode(m as InputMode)}
                onOpenSettings={() => setSettingsOpen(true)}
                onDisconnect={handleDisconnect}
              />
            ) : activeInputMode === 'trackpad' ? (
              <TrackpadView
                bridge={bridge}
                telemetry={telemetry}
                settings={settings}
                activeMode={activeInputMode as any}
                onSelectMode={(m) => selectMode(m as InputMode)}
                onOpenSettings={() => setSettingsOpen(true)}
                onDisconnect={handleDisconnect}
              />
            ) : activeInputMode === 'keyboard' ? (
              <KeyboardView
                bridge={bridge}
                telemetry={telemetry}
                settings={settings}
                activeMode={activeInputMode as any}
                onSelectMode={(m) => selectMode(m as InputMode)}
                onOpenSettings={() => setSettingsOpen(true)}
                onDisconnect={handleDisconnect}
              />
            ) : (
              <MediaRemoteView
                bridge={bridge}
                telemetry={telemetry}
                settings={settings}
                activeMode={activeInputMode as any}
                onSelectMode={(m) => selectMode(m as InputMode)}
                onOpenSettings={() => setSettingsOpen(true)}
                onDisconnect={handleDisconnect}
              />
            )}
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onDisconnect={connectionState === 'connected' ? handleDisconnect : undefined}
        isConnected={connectionState === 'connected'}
        activeMode={activeInputMode as any}
        onSelectMode={(m) => selectMode(m as InputMode)}
      />
    </div>
  );
};
