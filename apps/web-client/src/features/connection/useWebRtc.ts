import { useState, useEffect, useRef, useCallback } from 'react';
import { WebRtcTransport } from '../../transport/WebRtcTransport';
import { ProtocolBridge } from '../../transport/ProtocolBridge';
import { TransportState } from '../../transport/ITransport';
import { TelemetryData, INITIAL_TELEMETRY, AppConnectionState } from './ConnectionState';
import { PairingSession } from '../pairing/usePairing';
import { HostConnectionManager } from '../../transport/HostConnectionManager';

export interface UseWebRtcResult {
  state: AppConnectionState;
  telemetry: TelemetryData;
  bridge: ProtocolBridge | null;
  transport: WebRtcTransport | null;
  connect: (session: PairingSession) => Promise<void>;
  disconnect: () => void;
}

export function useWebRtc(): UseWebRtcResult {
  const [state, setState] = useState<AppConnectionState>('idle');
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);
  const [activeBridge, setActiveBridge] = useState<ProtocolBridge | null>(null);
  const [activeTransport, setActiveTransport] = useState<WebRtcTransport | null>(null);

  const transportRef = useRef<WebRtcTransport | null>(null);
  const bridgeRef = useRef<ProtocolBridge | null>(null);
  const heartbeatTimerRef = useRef<any>(null);
  const ppsCalcRef = useRef<{ lastSent: number; lastTs: number }>({ lastSent: 0, lastTs: Date.now() });

  const disconnect = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    if (bridgeRef.current) {
      bridgeRef.current.destroy();
      bridgeRef.current = null;
    }

    if (transportRef.current) {
      transportRef.current.disconnect();
      transportRef.current = null;
    }

    setActiveBridge(null);
    setActiveTransport(null);
    setState('disconnected');
    setTelemetry((prev) => ({ ...prev, state: 'disconnected' }));
  }, []);

  const connect = useCallback(
    async (session: PairingSession) => {
      disconnect();

      // Register active host globally in HostConnectionManager
      HostConnectionManager.setActiveHost(session.params.host, session.params.port);

      setState('connecting');
      setTelemetry((prev) => ({
        ...prev,
        state: 'connecting',
        hostIp: `${session.params.host}:${session.params.port}`,
        sessionId: session.handshakeResponse.session_id,
      }));

      const transport = new WebRtcTransport({
        host: session.params.host,
        port: session.params.port,
        sessionId: session.handshakeResponse.session_id,
      });

      const bridge = new ProtocolBridge(transport);
      transportRef.current = transport;
      bridgeRef.current = bridge;
      setActiveBridge(bridge);
      setActiveTransport(transport);

      // Bind transport state
      transport.onStateChange((transportState: TransportState) => {
        let appState: AppConnectionState = 'connecting';
        if (transportState === 'connected') {
          appState = 'connected';
        } else if (transportState === 'disconnected') {
          appState = 'disconnected';
        } else if (transportState === 'reconnecting') {
          appState = 'reconnecting';
        } else if (transportState === 'failed') {
          appState = 'error';
        }

        setState(appState);
        setTelemetry((prev) => ({
          ...prev,
          state: appState,
          watchdogActive: appState === 'connected',
        }));
      });

      // Bind RTT calculation
      bridge.onRtt((rttMs: number) => {
        transport.updateRtt(rttMs);
      });

      // Bind transport stats updates
      transport.onStats((stats) => {
        const now = Date.now();
        const deltaSec = (now - ppsCalcRef.current.lastTs) / 1000;
        let pps = 0;
        if (deltaSec >= 1) {
          const sentDelta = stats.packetsSent - ppsCalcRef.current.lastSent;
          pps = Math.round(sentDelta / deltaSec);
          ppsCalcRef.current = { lastSent: stats.packetsSent, lastTs: now };
        }

        setTelemetry((prev) => ({
          ...prev,
          rttMs: stats.rttMs,
          jitterMs: stats.jitterMs,
          packetsSent: stats.packetsSent,
          packetsReceived: stats.packetsReceived,
          bytesSent: stats.bytesSent,
          bytesReceived: stats.bytesReceived,
          pps: pps > 0 ? pps : prev.pps,
        }));
      });

      try {
        await transport.connect();

        // Start 80ms heartbeat interval for watchdog keepalive (<= watchdog_timeout / 3) & RTT sampling
        heartbeatTimerRef.current = setInterval(() => {
          if (bridgeRef.current && transportRef.current?.state === 'connected') {
            bridgeRef.current.sendHeartbeat();
          }
        }, 80);
      } catch (err) {
        console.error('Failed to establish WebRTC transport:', err);
        setState('error');
        setTelemetry((prev) => ({ ...prev, state: 'error' }));
        throw err;
      }
    },
    [disconnect]
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    telemetry,
    bridge: activeBridge || bridgeRef.current,
    transport: activeTransport || transportRef.current,
    connect,
    disconnect,
  };
}
