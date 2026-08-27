import { describe, it, expect } from 'vitest';
import { HostConnectionManager } from '../transport/HostConnectionManager';

describe('HostConnectionManager', () => {
  it('should detect localhost addresses correctly', () => {
    expect(HostConnectionManager.isLocalhost('localhost')).toBe(true);
    expect(HostConnectionManager.isLocalhost('127.0.0.1')).toBe(true);
    expect(HostConnectionManager.isLocalhost('::1')).toBe(true);
    expect(HostConnectionManager.isLocalhost('app.localhost')).toBe(true);
    expect(HostConnectionManager.isLocalhost('192.168.1.50')).toBe(false);
    expect(HostConnectionManager.isLocalhost('remote.lookaberry.com')).toBe(false);
  });

  it('should detect private LAN IPs correctly', () => {
    expect(HostConnectionManager.isPrivateIp('192.168.1.105')).toBe(true);
    expect(HostConnectionManager.isPrivateIp('10.0.0.1')).toBe(true);
    expect(HostConnectionManager.isPrivateIp('172.20.10.2')).toBe(true);
    expect(HostConnectionManager.isPrivateIp('169.254.1.1')).toBe(true);
    expect(HostConnectionManager.isPrivateIp('myhost.local')).toBe(true);
    expect(HostConnectionManager.isPrivateIp('8.8.8.8')).toBe(false);
    expect(HostConnectionManager.isPrivateIp('remote.lookaberry.com')).toBe(false);
  });

  it('should construct correct HTTP base URLs', () => {
    expect(HostConnectionManager.getHttpBaseUrl('192.168.1.100', 8765)).toBe('http://192.168.1.100:8765');
    expect(HostConnectionManager.getHttpBaseUrl('127.0.0.1:9000')).toBe('http://127.0.0.1:9000');
  });

  it('should construct correct WebSocket signaling URLs', () => {
    const wsUrl = HostConnectionManager.getSignalingWsUrl('192.168.1.100', 8765);
    expect(wsUrl).toContain('/ws/signaling');
    expect(wsUrl).toContain('192.168.1.100:8765');

    const wsUrlWithSession = HostConnectionManager.getSignalingWsUrl('192.168.1.100', 8765, 'sess-1234');
    expect(wsUrlWithSession).toContain('session_id=sess-1234');
  });

  it('should construct correct pairing and health endpoints', () => {
    expect(HostConnectionManager.getPairingEndpoint('192.168.1.100', 8765)).toBe('http://192.168.1.100:8765/api/pair');
    expect(HostConnectionManager.getHealthEndpoint('192.168.1.100', 8765)).toBe('http://192.168.1.100:8765/health');
    expect(HostConnectionManager.getApiUrl('192.168.1.100', 'api/v1/devices', 8765)).toBe('http://192.168.1.100:8765/api/v1/devices');
  });
});
