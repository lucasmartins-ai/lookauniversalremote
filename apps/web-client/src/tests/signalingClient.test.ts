import { describe, it, expect, beforeEach } from 'vitest';
import { SignalingClient, SignalingMessage } from '../transport/SignalingClient';

class MockWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;

  public static instances: MockWebSocket[] = [];
  public readyState = 0; // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((err: any) => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 10);
  }

  public send(data: string) {
    this.sent.push(data);
  }

  public close() {
    this.readyState = 3;
    this.onclose?.();
  }

  public simulateMessage(data: SignalingMessage) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe('SignalingClient WebSocket Suite', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
  });

  it('should connect to WebSocket and notify status listeners', async () => {
    const client = new SignalingClient({ url: 'ws://localhost:8765/ws/signaling', autoReconnect: false });
    const statusChanges: boolean[] = [];
    client.onStatus((status) => statusChanges.push(status));

    await client.connect();

    expect(client.isConnected()).toBe(true);
    expect(statusChanges).toContain(true);
    expect(MockWebSocket.instances.length).toBe(1);

    client.close();
    expect(client.isConnected()).toBe(false);
  });

  it('should buffer messages sent before connection opens and flush on open', async () => {
    const client = new SignalingClient({ url: 'ws://localhost:8765/ws/signaling', autoReconnect: false });
    client.send({ type: 'ping' });
    client.send({ type: 'candidate', candidate: 'cand1' });

    await client.connect();

    const wsInstance = MockWebSocket.instances[0]!;
    expect(wsInstance.sent.length).toBe(2);
    expect(JSON.parse(wsInstance.sent[0]!)).toEqual({ type: 'ping' });
    expect(JSON.parse(wsInstance.sent[1]!)).toEqual({ type: 'candidate', candidate: 'cand1' });

    client.close();
  });

  it('should dispatch incoming signaling messages to registered handlers', async () => {
    const client = new SignalingClient({ url: 'ws://localhost:8765/ws/signaling', autoReconnect: false });
    const received: SignalingMessage[] = [];
    client.onMessage((msg) => received.push(msg));

    await client.connect();

    const wsInstance = MockWebSocket.instances[0]!;
    wsInstance.simulateMessage({ type: 'answer', sdp: 'v=0...' });
    wsInstance.simulateMessage({ type: 'pong' });

    expect(received.length).toBe(2);
    expect(received[0]).toEqual({ type: 'answer', sdp: 'v=0...' });
    expect(received[1]).toEqual({ type: 'pong' });

    client.close();
  });
});
