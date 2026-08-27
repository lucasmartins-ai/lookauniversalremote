/**
 * LookARemote WebRTC DataChannel Transport (Zero-Retransmit, Unordered)
 * Full PeerConnection lifecycle with automated recovery, bounded backoff, and signaling sync.
 */

import {
  ITransport,
  TransportState,
  TransportStats,
  StateChangeHandler,
  DataHandler,
  ErrorHandler,
  StatsHandler,
} from './ITransport';
import { SignalingClient, SignalingMessage } from './SignalingClient';
import { HostConnectionManager } from './HostConnectionManager';

export interface WebRtcTransportOptions {
  host: string;
  port: number;
  sessionId?: string;
  rtcConfig?: RTCConfiguration;
  maxReconnectAttempts?: number;
}

export class WebRtcTransport implements ITransport {
  private _state: TransportState = 'disconnected';
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signaling: SignalingClient | null = null;

  private stateHandlers: Set<StateChangeHandler> = new Set();
  private dataHandlers: Set<DataHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private statsHandlers: Set<StatsHandler> = new Set();

  private stats: TransportStats = {
    rttMs: 0,
    packetsSent: 0,
    packetsReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    jitterMs: 0,
    packetLossRatio: 0,
    lastHeartbeatTs: 0,
  };

  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private isExplicitlyClosed = false;

  constructor(private readonly options: WebRtcTransportOptions) {}

  public get state(): TransportState {
    return this._state;
  }

  public async connect(): Promise<void> {
    if (this._state === 'connected' || (this._state === 'connecting' && !this.isReconnecting)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.setState('connecting');

    try {
      // 1. Connect WebSocket signaling via HostConnectionManager
      const wsUrl = HostConnectionManager.getSignalingWsUrl(
        this.options.host,
        this.options.port,
        this.options.sessionId
      );

      if (!this.signaling) {
        this.signaling = new SignalingClient({ url: wsUrl, autoReconnect: true });
        this.signaling.onMessage(this.handleSignalingMessage.bind(this));
        this.signaling.onStatus((connected) => {
          if (connected && this._state !== 'connected' && !this.isExplicitlyClosed) {
            this.reconnectPeerConnection().catch((err) => {
              console.warn('PeerConnection recovery on signaling reconnect failed:', err);
            });
          }
        });
      }

      await this.signaling.connect();

      // 2. Instantiate and negotiate PeerConnection & DataChannel
      await this.recreatePeerConnection();
    } catch (err: any) {
      console.error('Failed to initialize WebRtcTransport:', err);
      this.setState('failed');
      this.notifyError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Complete teardown and recreation of RTCPeerConnection and RTCDataChannel.
   */
  private async recreatePeerConnection(): Promise<void> {
    // Teardown previous invalid peer connection
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    this.remoteDescriptionSet = false;
    this.pendingCandidates = [];

    const rtcConfig: RTCConfiguration = this.options.rtcConfig || {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 2,
    };

    this.pc = new RTCPeerConnection(rtcConfig);

    // Setup ICE candidate negotiation
    this.pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && this.signaling) {
        const c = event.candidate;
        this.signaling.send({
          type: 'candidate',
          candidate: c.candidate,
          sdp_mid: c.sdpMid,
          sdp_mline_index: c.sdpMLineIndex,
        });
      }
    };

    // Monitor ICE connection state transitions
    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      const iceState = this.pc.iceConnectionState;
      if (iceState === 'failed' || iceState === 'disconnected') {
        console.warn('WebRTC ICE Connection State Changed:', iceState);
        if (this._state === 'connected' && !this.isExplicitlyClosed) {
          this.schedulePeerReconnect();
        }
      }
    };

    // Create Unordered, Zero-Retransmit DataChannel for maximum throughput & lowest latency
    const dataChannelInit: RTCDataChannelInit = {
      ordered: false,
      maxRetransmits: 0,
    };

    this.dataChannel = this.pc.createDataChannel('lookaremote-input', dataChannelInit);
    this.setupDataChannelEvents(this.dataChannel);

    this.pc.ondatachannel = (event: RTCDataChannelEvent) => {
      this.setupDataChannelEvents(event.channel);
    };

    // Create and dispatch SDP Offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    if (offer.sdp && this.signaling) {
      this.signaling.send({
        type: 'offer',
        sdp: offer.sdp,
      });
    }
  }

  private schedulePeerReconnect(): void {
    if (this.isReconnecting || this.isExplicitlyClosed) return;
    this.isReconnecting = true;
    this.setState('reconnecting');

    const maxAttempts = this.options.maxReconnectAttempts ?? 5;
    if (this.reconnectAttempts >= maxAttempts) {
      console.warn(`WebRTC Transport reached maximum reconnect attempts (${maxAttempts}).`);
      this.setState('failed');
      this.isReconnecting = false;
      return;
    }

    this.reconnectAttempts++;
    const backoffMs = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);

    setTimeout(async () => {
      if (this.isExplicitlyClosed) {
        this.isReconnecting = false;
        return;
      }

      try {
        await this.recreatePeerConnection();
        this.isReconnecting = false;
      } catch (e) {
        console.warn('WebRTC PeerConnection reconnect attempt failed:', e);
        this.isReconnecting = false;
        this.schedulePeerReconnect();
      }
    }, backoffMs);
  }

  public async reconnectPeerConnection(): Promise<void> {
    if (this.isExplicitlyClosed) return;
    this.setState('reconnecting');
    await this.recreatePeerConnection();
  }

  public send(data: Uint8Array | ArrayBuffer): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(data as any);
        this.stats.packetsSent++;
        this.stats.bytesSent += data.byteLength;
        this.notifyStats();
        return true;
      } catch (err) {
        console.warn('Failed to send frame via DataChannel, trying WebSocket fallback:', err);
      }
    }

    if (this.signaling && this.signaling.isConnected()) {
      try {
        this.signaling.sendRaw(data);
        this.stats.packetsSent++;
        this.stats.bytesSent += data.byteLength;
        this.notifyStats();
        return true;
      } catch (err) {
        console.warn('Failed to send frame via WebSocket fallback:', err);
        return false;
      }
    }

    return false;
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    if (this.signaling) {
      this.signaling.close();
      this.signaling = null;
    }

    this.remoteDescriptionSet = false;
    this.pendingCandidates = [];
    this.setState('disconnected');
  }

  public updateRtt(rttMs: number): void {
    const prevRtt = this.stats.rttMs;
    const currentJitter = Math.abs(rttMs - prevRtt);
    this.stats.jitterMs = this.stats.jitterMs === 0 ? currentJitter : this.stats.jitterMs * 0.8 + currentJitter * 0.2;
    this.stats.rttMs = rttMs;
    this.stats.lastHeartbeatTs = Date.now();
    this.notifyStats();
  }

  public getStats(): TransportStats {
    return { ...this.stats };
  }

  public onStateChange(handler: StateChangeHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  public onData(handler: DataHandler): () => void {
    this.dataHandlers.add(handler);
    return () => this.dataHandlers.delete(handler);
  }

  public onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  public onStats(handler: StatsHandler): () => void {
    this.statsHandlers.add(handler);
    return () => this.statsHandlers.delete(handler);
  }

  private setupDataChannelEvents(channel: RTCDataChannel): void {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.setState('connected');
    };

    channel.onclose = () => {
      if (this._state === 'connected' && !this.isExplicitlyClosed) {
        this.schedulePeerReconnect();
      } else if (this.isExplicitlyClosed) {
        this.setState('disconnected');
      }
    };

    channel.onerror = (event) => {
      console.warn('DataChannel error event:', event);
      this.notifyError(new Error('RTCDataChannel error'));
    };

    channel.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        this.stats.packetsReceived++;
        this.stats.bytesReceived += event.data.byteLength;
        this.notifyData(event.data);
      }
    };
  }

  private async handleSignalingMessage(msg: SignalingMessage): Promise<void> {
    if (!this.pc) return;

    switch (msg.type) {
      case 'answer': {
        try {
          const desc = new RTCSessionDescription({
            type: 'answer',
            sdp: msg.sdp,
          });
          await this.pc.setRemoteDescription(desc);
          this.remoteDescriptionSet = true;

          // Drain queued candidates
          while (this.pendingCandidates.length > 0) {
            const candidate = this.pendingCandidates.shift();
            if (candidate) {
              await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
          }
        } catch (e: any) {
          console.error('Failed to set remote description (SDP Answer):', e);
          this.notifyError(e);
        }
        break;
      }

      case 'candidate': {
        const init: RTCIceCandidateInit = {
          candidate: msg.candidate,
          sdpMid: msg.sdp_mid ?? undefined,
          sdpMLineIndex: msg.sdp_mline_index ?? undefined,
        };

        if (this.remoteDescriptionSet && this.pc.remoteDescription) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(init));
          } catch (e) {
            console.warn('Failed to add received ICE candidate:', e);
          }
        } else {
          this.pendingCandidates.push(init);
        }
        break;
      }

      case 'error': {
        console.warn('Signaling server reported error:', msg.message);
        this.notifyError(new Error(msg.message));
        break;
      }
    }
  }

  private setState(newState: TransportState): void {
    if (this._state === newState) return;
    this._state = newState;
    for (const handler of this.stateHandlers) {
      try {
        handler(newState);
      } catch (e) {
        console.error('Error in transport state handler:', e);
      }
    }
  }

  private notifyData(data: ArrayBuffer): void {
    for (const handler of this.dataHandlers) {
      try {
        handler(data);
      } catch (e) {
        console.error('Error in transport data handler:', e);
      }
    }
  }

  private notifyError(err: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(err);
      } catch (e) {
        console.error('Error in transport error handler:', e);
      }
    }
  }

  private notifyStats(): void {
    for (const handler of this.statsHandlers) {
      try {
        handler({ ...this.stats });
      } catch (e) {
        console.error('Error in transport stats handler:', e);
      }
    }
  }
}
