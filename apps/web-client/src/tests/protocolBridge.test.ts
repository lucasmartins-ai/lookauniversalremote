import { describe, it, expect } from 'vitest';
import { ProtocolBridge } from '../transport/ProtocolBridge';
import { ITransport, TransportState, TransportStats } from '../transport/ITransport';
import { decodePacket, MessageType } from '@lookaremote/protocol-types';

class MockTransport implements ITransport {
  public state: TransportState = 'connected';
  public sentBuffers: Uint8Array[] = [];
  public dataListeners: Set<(data: ArrayBuffer) => void> = new Set();

  public async connect(): Promise<void> {}
  public disconnect(): void {}

  public send(data: Uint8Array | ArrayBuffer): boolean {
    const buf = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0));
    this.sentBuffers.push(buf);
    return true;
  }

  public onStateChange(_handler: any): () => void {
    return () => {};
  }

  public onData(handler: (data: ArrayBuffer) => void): () => void {
    this.dataListeners.add(handler);
    return () => this.dataListeners.delete(handler);
  }

  public onError(_handler: any): () => void {
    return () => {};
  }

  public onStats(_handler: any): () => void {
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
      lastHeartbeatTs: 0,
    };
  }

  public simulateIncoming(data: Uint8Array | ArrayBuffer) {
    const ab: ArrayBuffer =
      data instanceof Uint8Array
        ? (data.slice().buffer as ArrayBuffer)
        : (data.slice(0) as ArrayBuffer);
    for (const listener of this.dataListeners) {
      listener(ab);
    }
  }
}

describe('ProtocolBridge Input & Serialization Suite', () => {
  it('should encode and send MSG_MOTION with monotonic sequence numbering', () => {
    const transport = new MockTransport();
    const bridge = new ProtocolBridge(transport);

    const sent1 = bridge.sendMotion({
      gyroYaw: 100,
      gyroPitch: -200,
      gyroRoll: 300,
      accelX: 980,
      accelY: -100,
      accelZ: 50,
      timestampUs: 123456,
    });

    const sent2 = bridge.sendMotion({
      gyroYaw: 110,
      gyroPitch: -210,
      gyroRoll: 310,
      accelX: 985,
      accelY: -105,
      accelZ: 55,
      timestampUs: 123466,
    });

    expect(sent1).toBe(true);
    expect(sent2).toBe(true);
    expect(transport.sentBuffers.length).toBe(2);

    const packet1 = decodePacket(transport.sentBuffers[0]!);
    expect(packet1.header.version).toBe(1);
    expect(packet1.header.type).toBe(MessageType.MOTION);
    expect(packet1.header.sequence).toBe(1);
    expect(packet1.payload.type).toBe('motion');

    const packet2 = decodePacket(transport.sentBuffers[1]!);
    expect(packet2.header.sequence).toBe(2);
  });

  it('should encode and send MSG_GAMEPAD_FULL and MSG_TOUCHPAD', () => {
    const transport = new MockTransport();
    const bridge = new ProtocolBridge(transport);

    bridge.sendGamepadFull({
      buttons: 0x0009, // A + Y
      stickLx: 10000,
      stickLy: -10000,
      stickRx: 20000,
      stickRy: -20000,
      triggerL: 128,
      triggerR: 255,
    });

    bridge.sendTouchpad({
      dx: 15,
      dy: -25,
      scrollV: 3,
      scrollH: 0,
      buttonsMask: 0x01,
    });

    expect(transport.sentBuffers.length).toBe(2);

    const gp = decodePacket(transport.sentBuffers[0]!);
    expect(gp.header.type).toBe(MessageType.GAMEPAD_FULL);
    if (gp.payload.type === 'gamepad_full') {
      expect(gp.payload.buttons).toBe(0x0009);
      expect(gp.payload.stickLx).toBe(10000);
      expect(gp.payload.triggerR).toBe(255);
    }

    const tp = decodePacket(transport.sentBuffers[1]!);
    expect(tp.header.type).toBe(MessageType.TOUCHPAD);
    if (tp.payload.type === 'touchpad') {
      expect(tp.payload.dx).toBe(15);
      expect(tp.payload.dy).toBe(-25);
      expect(tp.payload.buttonsMask).toBe(0x01);
    }
  });

  it('should handle incoming heartbeat echoes and notify RTT listeners', () => {
    const transport = new MockTransport();
    const bridge = new ProtocolBridge(transport);

    let recordedRtt = -1;
    let recordedToken = -1;
    bridge.onRtt((rtt, token) => {
      recordedRtt = rtt;
      recordedToken = token;
    });

    // Send a heartbeat
    bridge.sendHeartbeat(9999);
    const sentHeartbeat = transport.sentBuffers[0]!;

    // Simulate host echoing back the heartbeat packet
    transport.simulateIncoming(sentHeartbeat);

    expect(recordedToken).toBe(9999);
    expect(recordedRtt).toBeGreaterThanOrEqual(0);
  });
});
