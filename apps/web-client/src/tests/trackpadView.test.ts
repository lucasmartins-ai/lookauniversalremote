import { describe, it, expect, vi } from 'vitest';
import { ProtocolBridge } from '../transport/ProtocolBridge';
import { ITransport } from '../transport/ITransport';
import { decodePacket, MessageType } from '@lookaremote/protocol-types';

describe('Trackpad & Desktop Control Bridge Integration', () => {
  it('encodes and transmits MSG_TOUCHPAD frames accurately', () => {
    let sentBuffer: ArrayBuffer | null = null;
    const mockTransport: ITransport = {
      state: 'connected',
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(),
      send: vi.fn((data: Uint8Array | ArrayBuffer) => {
        sentBuffer = data instanceof Uint8Array ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer) : (data as ArrayBuffer);
        return true;
      }),
      onStateChange: vi.fn(() => () => {}),
      onData: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      onStats: vi.fn(() => () => {}),
      getStats: vi.fn(() => ({
        rttMs: 0,
        packetsSent: 1,
        packetsReceived: 0,
        bytesSent: 0,
        bytesReceived: 0,
        jitterMs: 0,
        packetLossRatio: 0,
        lastHeartbeatTs: 0,
      })),
    };

    const bridge = new ProtocolBridge(mockTransport);

    const success = bridge.sendTouchpad({
      dx: 15,
      dy: -8,
      scrollV: 3,
      scrollH: 0,
      buttonsMask: 0x01,
    });

    expect(success).toBe(true);
    expect(mockTransport.send).toHaveBeenCalledTimes(1);
    expect(sentBuffer).not.toBeNull();

    // Verify decoded packet
    const decoded = decodePacket(sentBuffer!);
    expect(decoded.header.type).toBe(MessageType.TOUCHPAD);
    if (decoded.payload.type === 'touchpad') {
      expect(decoded.payload.dx).toBe(15);
      expect(decoded.payload.dy).toBe(-8);
      expect(decoded.payload.scrollV).toBe(3);
      expect(decoded.payload.scrollH).toBe(0);
      expect(decoded.payload.buttonsMask).toBe(0x01);
    } else {
      throw new Error('Expected touchpad payload');
    }
  });

  it('encodes and transmits MSG_KEYBOARD frames with modifiers', () => {
    let sentBuffer: ArrayBuffer | null = null;
    const mockTransport: ITransport = {
      state: 'connected',
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(),
      send: vi.fn((data: Uint8Array | ArrayBuffer) => {
        sentBuffer = data instanceof Uint8Array ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer) : (data as ArrayBuffer);
        return true;
      }),
      onStateChange: vi.fn(() => () => {}),
      onData: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      onStats: vi.fn(() => () => {}),
      getStats: vi.fn(() => ({
        rttMs: 0,
        packetsSent: 1,
        packetsReceived: 0,
        bytesSent: 0,
        bytesReceived: 0,
        jitterMs: 0,
        packetLossRatio: 0,
        lastHeartbeatTs: 0,
      })),
    };

    const bridge = new ProtocolBridge(mockTransport);

    // Send Key Down for 'C' (HID 0x06) with Ctrl modifier (0x01)
    bridge.sendKeyboard({
      keyCode: 0x06,
      state: 1, // Key Down
      modifiers: 0x01, // Ctrl
    });

    expect(sentBuffer).not.toBeNull();
    const decoded = decodePacket(sentBuffer!);
    expect(decoded.header.type).toBe(MessageType.KEYBOARD);
    if (decoded.payload.type === 'keyboard') {
      expect(decoded.payload.keyCode).toBe(0x06);
      expect(decoded.payload.state).toBe(1);
      expect(decoded.payload.modifiers).toBe(0x01);
    } else {
      throw new Error('Expected keyboard payload');
    }
  });

  it('encodes and transmits MSG_MEDIA frames', () => {
    let sentBuffer: ArrayBuffer | null = null;
    const mockTransport: ITransport = {
      state: 'connected',
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(),
      send: vi.fn((data: Uint8Array | ArrayBuffer) => {
        sentBuffer = data instanceof Uint8Array ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer) : (data as ArrayBuffer);
        return true;
      }),
      onStateChange: vi.fn(() => () => {}),
      onData: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      onStats: vi.fn(() => () => {}),
      getStats: vi.fn(() => ({
        rttMs: 0,
        packetsSent: 1,
        packetsReceived: 0,
        bytesSent: 0,
        bytesReceived: 0,
        jitterMs: 0,
        packetLossRatio: 0,
        lastHeartbeatTs: 0,
      })),
    };

    const bridge = new ProtocolBridge(mockTransport);

    bridge.sendMedia({
      mediaAction: 1, // PLAY_PAUSE
    });

    expect(sentBuffer).not.toBeNull();
    const decoded = decodePacket(sentBuffer!);
    expect(decoded.header.type).toBe(MessageType.MEDIA);
    if (decoded.payload.type === 'media') {
      expect(decoded.payload.mediaAction).toBe(1);
    } else {
      throw new Error('Expected media payload');
    }
  });
});
