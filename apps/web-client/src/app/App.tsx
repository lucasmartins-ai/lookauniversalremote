import React, { useState, useCallback, useEffect } from 'react';
import {
  QrCode,
  Sliders,
  Settings,
  ShieldAlert,
  RefreshCw,
  Zap,
  ExternalLink,
  Wifi,
} from 'lucide-react';
import { usePairing, PairingSession } from '../features/pairing/usePairing';
import { parsePairingUri } from '../features/pairing/pairingCrypto';
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
import { ErrorBoundary } from '../ui/components/ErrorBoundary';
import { haptics } from '../ui/haptics/hapticEngine';
import { HostConnectionManager } from '../transport/HostConnectionManager';

import { useBatteryTelemetry } from '../features/battery/useBatteryTelemetry';

export const App: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { state: connectionState, telemetry, bridge, connect: connectWebRtc, disconnect: disconnectWebRtc } = useWebRtc();

  const [activeTab, setActiveTab] = useState<'qr' | 'manual'>('qr');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeInputMode, setActiveInputMode] = useState<InputMode>('tv');
  const [playerIndex, setPlayerIndex] = useState<number>(0);
  const [playerColor, setPlayerColor] = useState<string>('#00E5FF');
  const [mixedContentTarget, setMixedContentTarget] = useState<string | null>(null);

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

  // Check URL on load for HTTPS vs Local IP mixed content
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      const hash = window.location.hash;
      if (hash && (hash.includes('h=') || hash.includes('#h='))) {
        try {
          const params = parsePairingUri(hash);
          if (HostConnectionManager.isPrivateIp(params.host)) {
            setMixedContentTarget(`http://${params.host}:${params.port}/${hash}`);
          }
        } catch {
          // Ignored
        }
      }
    }
  }, []);

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

  const { stage: pairingStage, error: pairingError, pairWithRawUri, pairWithParams, reset: resetPairing } = usePairing({
    autoCheckUrlHash: true,
    onSuccess: handlePairingSuccess,
  });

  const handleScanQr = async (text: string) => {
    try {
      const session = await pairWithRawUri(text);
      await handlePairingSuccess(session);
    } catch (e: any) {
      console.warn('Scan handling failed:', e);
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      if (isHttps && (text.includes('#h=') || text.includes('h='))) {
        try {
          const params = parsePairingUri(text);
          const localUrl = `http://${params.host}:${params.port}/#h=${params.host}&p=${params.port}&k=${params.hostPubKey}&n=${params.nonce}&v=${params.version}`;
          setMixedContentTarget(localUrl);
          // Attempt direct redirect to local HTTP daemon origin
          window.location.href = localUrl;
        } catch (parseErr) {
          console.error('Failed to parse scan params for redirect:', parseErr);
        }
      }
    }
  };

  const handleManualPair = async (params: any) => {
    try {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      if (isHttps && HostConnectionManager.isPrivateIp(params.host)) {
        const localUrl = `http://${params.host}:${params.port}/#h=${params.host}&p=${params.port}&k=${params.hostPubKey}&n=${params.nonce}&v=1`;
        setMixedContentTarget(localUrl);
      }
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
    <ErrorBoundary onReset={handleDisconnect}>
      <div
        style={{
          width: '100%',
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#070a0f',
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Background Grid */}
        <div className="cyber-grid-bg" />

        {/* Top 3D Header Bar - Shown on connection / pairing screen */}
        {connectionState !== 'connected' && (
          <header
            className="neo-raised"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              zIndex: 40,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                className="retro-led"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #00f0ff 0%, #008ba3 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 14px rgba(0, 229, 255, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.6)',
                }}
              >
                <Zap size={18} color="#040d1a" />
              </div>
              <div>
                <h1
                  className="retro-embossed-text"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.2rem',
                    fontWeight: 900,
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
                    letterSpacing: '0.08em',
                    fontWeight: 600,
                  }}
                >
                  3D RETRO DECK • 120HZ
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <StatusBadge status={statusVariant} />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
                style={{ width: '34px', height: '34px', padding: 0, borderRadius: '50%' }}
              >
                <Settings size={16} color="var(--color-text-secondary)" />
              </Button>
            </div>
          </header>
        )}

        {/* Mixed Content Notice Banner on Vercel HTTPS */}
        {mixedContentTarget && connectionState !== 'connected' && (
          <div
            style={{
              padding: '10px 16px',
              backgroundColor: 'rgba(0, 229, 255, 0.15)',
              borderBottom: '1px solid var(--color-neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              zIndex: 50,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wifi size={16} color="var(--color-neon-cyan)" />
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                Para conectar na rede local sem bloqueio do navegador:
              </span>
            </div>
            <a
              href={mixedContentTarget}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-neon-cyan)',
                color: '#040d1a',
                fontSize: '0.72rem',
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                textDecoration: 'none',
              }}
            >
              <span>ABRIR VIA IP LOCAL</span>
              <ExternalLink size={12} />
            </a>
          </div>
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
                zIndex: 10,
              }}
            >
              {/* View Switcher Tabs (3D Recessed Track) */}
              <div
                className="neo-sunken"
                style={{
                  display: 'flex',
                  borderRadius: '12px',
                  padding: '5px',
                  marginBottom: '16px',
                  zIndex: 20,
                  gap: '6px',
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
                    className="neo-sunken-deep"
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      position: 'relative',
                      padding: '6px',
                    }}
                  >
                    <QrScannerView
                      onScan={handleScanQr}
                      onSwitchToManual={() => {
                        haptics.buttonClick();
                        setActiveTab('manual');
                      }}
                    />
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
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 42, 85, 0.15)',
                    border: '1.5px solid var(--color-neon-red)',
                    boxShadow: '0 0 12px rgba(255, 42, 85, 0.3)',
                    color: 'var(--color-neon-red)',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 700,
                  }}
                >
                  <ShieldAlert size={18} />
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
                zIndex: 10,
              }}
            >
              <Spinner size={64} label="NEGOCIANDO TRANSPORTE 120HZ WEBRTC" />

              <div
                className="neo-sunken"
                style={{
                  textAlign: 'center',
                  maxWidth: '340px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '14px 18px',
                  borderRadius: '12px',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--color-neon-cyan)', fontWeight: 700 }}>
                  {pairingStage === 'handshaking'
                    ? 'COMPUTANDO PROVA X25519 DH & HMAC...'
                    : 'TROCANDO SDP & CANDIDATOS ICE...'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  HOST DESTINO: {telemetry.hostIp || 'Host Local (LAN)'}
                </div>
              </div>

              <Button variant="secondary" size="sm" onClick={handleDisconnect} leftIcon={<RefreshCw size={14} />}>
                CANCELAR CONEXÃO
              </Button>
            </div>
          )}

          {/* VIEW 3: CONNECTED CONTROLLER DASHBOARD */}
          {connectionState === 'connected' && (
            <div style={{ flex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {/* Smart Context Toast HUD */}
              <ContextToast
                toast={toast}
                onDismiss={dismissToast}
                isManualLocked={isManualLocked}
                onToggleLock={toggleManualLock}
              />

              {bridge ? (
                activeInputMode === 'tv' ? (
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
                )
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spinner size={48} label="CARREGANDO CANAL DE CONTROLE..." />
                </div>
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
    </ErrorBoundary>
  );
};
