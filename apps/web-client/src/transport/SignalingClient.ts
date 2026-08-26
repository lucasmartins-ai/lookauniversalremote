/**
 * LookARemote Local WebSocket Signaling Client
 * Handles SDP Offer/Answer negotiation and Trickle ICE Candidates.
 */

export type SignalingMessage =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'candidate'; candidate: string; sdp_mid?: string | null; sdp_mline_index?: number | null }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'state'; state: string }
  | { type: 'error'; message: string };

export type SignalingMessageHandler = (msg: SignalingMessage) => void;
export type SignalingStatusHandler = (connected: boolean) => void;

export interface SignalingClientOptions {
  url: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectIntervalMs?: number;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private messageQueue: SignalingMessage[] = [];
  private messageHandlers: Set<SignalingMessageHandler> = new Set();
  private statusHandlers: Set<SignalingStatusHandler> = new Set();
  private isConnecting = false;
  private isExplicitlyClosed = false;
  private reconnectAttempts = 0;
  private pingTimer: any = null;

  constructor(private readonly options: SignalingClientOptions) {}

  public connect(): Promise<void> {
    this.isExplicitlyClosed = false;

    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.options.url);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.notifyStatus(true);
          this.flushQueue();
          this.startPingInterval();
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const data: SignalingMessage = JSON.parse(event.data);
            this.notifyMessage(data);
          } catch (e) {
            console.warn('Malformed signaling message received:', event.data, e);
          }
        };

        this.ws.onerror = (err) => {
          console.warn('Signaling WebSocket error:', err);
          if (this.isConnecting) {
            reject(new Error('Failed to connect to signaling server.'));
          }
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.stopPingInterval();
          this.notifyStatus(false);

          if (!this.isExplicitlyClosed && this.options.autoReconnect !== false) {
            this.scheduleReconnect();
          }
        };
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  public send(msg: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
    }
  }

  public close(): void {
    this.isExplicitlyClosed = true;
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageQueue = [];
    this.notifyStatus(false);
  }

  public onMessage(handler: SignalingMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public onStatus(handler: SignalingStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.ws.send(JSON.stringify(msg));
      }
    }
  }

  private notifyMessage(msg: SignalingMessage): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(msg);
      } catch (e) {
        console.error('Error in signaling message handler:', e);
      }
    }
  }

  private notifyStatus(connected: boolean): void {
    for (const handler of this.statusHandlers) {
      try {
        handler(connected);
      } catch (e) {
        console.error('Error in signaling status handler:', e);
      }
    }
  }

  private scheduleReconnect(): void {
    const maxAttempts = this.options.maxReconnectAttempts ?? 5;
    if (this.reconnectAttempts >= maxAttempts) {
      console.warn(`Signaling client exceeded max reconnect attempts (${maxAttempts}).`);
      return;
    }

    const interval = this.options.reconnectIntervalMs ?? 2000;
    this.reconnectAttempts++;
    setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect().catch((e) => {
          console.warn('Signaling reconnect attempt failed:', e);
        });
      }
    }, interval);
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, 15000);
  }

  private stopPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
