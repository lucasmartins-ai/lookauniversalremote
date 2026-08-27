import { describe, it, expect } from 'vitest';
import { WebRtcTransport } from '../transport/WebRtcTransport';

describe('WebRTC Reliability Tests', () => {
  it('should initialize with disconnected state and clean initial stats', () => {
    const transport = new WebRtcTransport({
      host: '127.0.0.1',
      port: 8765,
    });

    expect(transport.state).toBe('disconnected');
    const stats = transport.getStats();
    expect(stats.packetsSent).toBe(0);
    expect(stats.packetsReceived).toBe(0);
    expect(stats.rttMs).toBe(0);
  });

  it('should update RTT and smooth jitter calculations', () => {
    const transport = new WebRtcTransport({
      host: '127.0.0.1',
      port: 8765,
    });

    transport.updateRtt(10);
    expect(transport.getStats().rttMs).toBe(10);

    transport.updateRtt(20);
    expect(transport.getStats().rttMs).toBe(20);
    expect(transport.getStats().jitterMs).toBeGreaterThan(0);
  });

  it('should cleanly disconnect and reset state', () => {
    const transport = new WebRtcTransport({
      host: '127.0.0.1',
      port: 8765,
    });

    const states: string[] = [];
    transport.onStateChange((s) => states.push(s));

    transport.disconnect();
    expect(transport.state).toBe('disconnected');
  });
});
