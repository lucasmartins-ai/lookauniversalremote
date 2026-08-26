import { describe, it, expect, vi } from 'vitest';
import { GamepadSampler } from '../features/gamepad/GamepadSampler';
import { ProtocolBridge } from '../transport/ProtocolBridge';
import { ITransport, TransportState, TransportStats } from '../transport/ITransport';
import { GamepadButtonMask } from '@lookaremote/protocol-types';

class MockTransport implements ITransport {
  public state: TransportState = 'connected';
  public sentBuffers: ArrayBuffer[] = [];
  public dataHandler: ((data: ArrayBuffer) => void) | null = null;

  public async connect(): Promise<void> {
    this.state = 'connected';
  }

  public disconnect(): void {
    this.state = 'disconnected';
  }

  public send(data: ArrayBuffer | Uint8Array): boolean {
    if (data instanceof Uint8Array) {
      const copy = new ArrayBuffer(data.byteLength);
      new Uint8Array(copy).set(data);
      this.sentBuffers.push(copy);
    } else {
      this.sentBuffers.push(data);
    }
    return true;
  }

  public onStateChange(): () => void {
    return () => {};
  }

  public onData(handler: (data: ArrayBuffer) => void): () => void {
    this.dataHandler = handler;
    return () => {
      this.dataHandler = null;
    };
  }

  public onError(): () => void {
    return () => {};
  }

  public onStats(): () => void {
    return () => {};
  }

  public getStats(): TransportStats {
    return {
      rttMs: 0,
      packetsSent: this.sentBuffers.length,
      packetsReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      jitterMs: 0,
      packetLossRatio: 0,
      lastHeartbeatTs: Date.now(),
    };
  }
}

describe('GamepadSampler & Protocol Pipeline Tests', () => {
  it('correctly samples single frame and serializes MSG_GAMEPAD_FULL via bridge', () => {
    const transport = new MockTransport();
    const bridge = new ProtocolBridge(transport);

    const snapshot = {
      buttons: GamepadButtonMask.BTN_SOUTH | GamepadButtonMask.BTN_EAST, // A + B
      stickLx: -12000,
      stickLy: 24000,
      stickRx: 32767,
      stickRy: -32768,
      triggerL: 128,
      triggerR: 255,
      reserved: 0,
    };

    const sampler = new GamepadSampler(bridge, () => snapshot, 120);

    expect(sampler.isRunning()).toBe(false);
    expect(sampler.getSampleRate()).toBe(120);

    const success = sampler.sampleOnce();
    expect(success).toBe(true);
    expect(transport.sentBuffers.length).toBe(1);

    const sent = new Uint8Array(transport.sentBuffers[0]);
    // Check header: version 0x01, type 0x02 (MSG_GAMEPAD_FULL)
    expect(sent[0]).toBe(0x01);
    expect(sent[1]).toBe(0x02);
    expect(sent.length).toBe(19); // 5-byte header + 14-byte payload

    // Read buttons (u16 LE at offset 5)
    const view = new DataView(sent.buffer, sent.byteOffset, sent.byteLength);
    expect(view.getUint16(5, true)).toBe(GamepadButtonMask.BTN_SOUTH | GamepadButtonMask.BTN_EAST);
    expect(view.getInt16(7, true)).toBe(-12000);
    expect(view.getInt16(9, true)).toBe(24000);
    expect(view.getInt16(11, true)).toBe(32767);
    expect(view.getInt16(13, true)).toBe(-32768);
    expect(view.getUint8(15)).toBe(128);
    expect(view.getUint8(16)).toBe(255);
  });

  it('manages timer lifecycle cleanly with start and stop', () => {
    vi.useFakeTimers();

    const transport = new MockTransport();
    const bridge = new ProtocolBridge(transport);
    let sampleCallCount = 0;

    const sampler = new GamepadSampler(
      bridge,
      () => {
        sampleCallCount++;
        return {
          buttons: 0,
          stickLx: 0,
          stickLy: 0,
          stickRx: 0,
          stickRy: 0,
          triggerL: 0,
          triggerR: 0,
          reserved: 0,
        };
      },
      120 // ~8.33ms per frame -> rounded to 8ms
    );

    sampler.start();
    expect(sampler.isRunning()).toBe(true);

    // Fast-forward 40ms (~5 sample intervals)
    vi.advanceTimersByTime(40);
    expect(sampleCallCount).toBeGreaterThanOrEqual(4);

    sampler.stop();
    expect(sampler.isRunning()).toBe(false);

    const countAfterStop = sampleCallCount;
    vi.advanceTimersByTime(40);
    expect(sampleCallCount).toBe(countAfterStop);

    vi.useRealTimers();
  });

  it('allows dynamic sample rate updates', () => {
    const transport = new MockTransport();
    const bridge = new ProtocolBridge(transport);

    const sampler = new GamepadSampler(
      bridge,
      () => ({
        buttons: 0,
        stickLx: 0,
        stickLy: 0,
        stickRx: 0,
        stickRy: 0,
        triggerL: 0,
        triggerR: 0,
        reserved: 0,
      }),
      120
    );

    expect(sampler.getSampleRate()).toBe(120);
    sampler.setSampleRate(60);
    expect(sampler.getSampleRate()).toBe(60);
  });
});
