/**
 * Abstract Transport Interface for LookARemote Client
 */

export type TransportState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface TransportStats {
  rttMs: number;
  packetsSent: number;
  packetsReceived: number;
  bytesSent: number;
  bytesReceived: number;
  jitterMs: number;
  packetLossRatio: number;
  lastHeartbeatTs: number;
}

export type StateChangeHandler = (state: TransportState) => void;
export type DataHandler = (data: ArrayBuffer) => void;
export type ErrorHandler = (error: Error) => void;
export type StatsHandler = (stats: TransportStats) => void;

export interface ITransport {
  readonly state: TransportState;
  connect(): Promise<void>;
  disconnect(): void;
  send(data: Uint8Array | ArrayBuffer): boolean;
  onStateChange(handler: StateChangeHandler): () => void;
  onData(handler: DataHandler): () => void;
  onError(handler: ErrorHandler): () => void;
  onStats(handler: StatsHandler): () => void;
  getStats(): TransportStats;
}
