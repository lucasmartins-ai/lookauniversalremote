/**
 * Connection states and telemetry metrics for LookARemote Client
 */

export type AppConnectionState =
  | 'idle'
  | 'scanning'
  | 'pairing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'degraded'
  | 'error'
  | 'disconnected';

export interface TelemetryData {
  rttMs: number;
  jitterMs: number;
  packetsSent: number;
  packetsReceived: number;
  pps: number;
  bytesSent: number;
  bytesReceived: number;
  watchdogActive: boolean;
  state: AppConnectionState;
  hostIp?: string;
  sessionId?: string;
}

export const INITIAL_TELEMETRY: TelemetryData = {
  rttMs: 0,
  jitterMs: 0,
  packetsSent: 0,
  packetsReceived: 0,
  pps: 0,
  bytesSent: 0,
  bytesReceived: 0,
  watchdogActive: false,
  state: 'idle',
};
