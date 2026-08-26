import { describe, it, expect, beforeEach } from 'vitest';
import { WebRtcTransport } from '../transport/WebRtcTransport';

class MockRTCDataChannel {
  public readyState = 'open';
  public binaryType = 'arraybuffer';
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((e: any) => void) | null = null;
  public onmessage: ((e: any) => void) | null = null;
  public sent: any[] = [];

  send(data: any) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 'closed';
    this.onclose?.();
  }
}

class MockRTCPeerConnection {
  public dataChannel: MockRTCDataChannel | null = null;
  public localDescription: any = null;
  public remoteDescription: any = null;
  public onicecandidate: ((e: any) => void) | null = null;
  public oniceconnectionstatechange: (() => void) | null = null;
  public ondatachannel: ((e: any) => void) | null = null;

  createDataChannel(_label: string, _init: any) {
    this.dataChannel = new MockRTCDataChannel();
    return this.dataChannel;
  }

  async createOffer() {
    return { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
  }

  async setLocalDescription(desc: any) {
    this.localDescription = desc;
  }

  async setRemoteDescription(desc: any) {
    this.remoteDescription = desc;
  }

  async addIceCandidate(_cand: any) {}

  close() {
    this.dataChannel?.close();
  }
}

describe('WebRtcTransport State Machine Suite', () => {
  beforeEach(() => {
    (globalThis as any).RTCPeerConnection = MockRTCPeerConnection;
    (globalThis as any).RTCSessionDescription = class {
      constructor(public init: any) {}
    };
    (globalThis as any).RTCIceCandidate = class {
      constructor(public init: any) {}
    };
  });

  it('should initialize with disconnected state and update RTT stats', () => {
    const transport = new WebRtcTransport({ host: '127.0.0.1', port: 8765 });
    expect(transport.state).toBe('disconnected');

    transport.updateRtt(5.5);
    const stats = transport.getStats();
    expect(stats.rttMs).toBe(5.5);
    expect(stats.lastHeartbeatTs).toBeGreaterThan(0);
  });
});
