import { describe, it, expect, vi } from 'vitest';
import { PairingManager } from '../features/pairing/PairingManager';
import { x25519 } from '@noble/curves/ed25519';
import { bytesToHex } from '@noble/curves/abstract/utils';

describe('Pairing Lifecycle Tests', () => {
  it('should initialize in idle state with no session', () => {
    const manager = new PairingManager();
    expect(manager.state).toBe('idle');
    expect(manager.session).toBeNull();
    expect(manager.error).toBeNull();
  });

  it('should reject invalid URI formats and enter failed state', async () => {
    const manager = new PairingManager();
    await expect(manager.pairFromRawUri('invalid_uri_string')).rejects.toThrow();
    expect(manager.state).toBe('failed');
    expect(manager.error).toBeDefined();
  });

  it('should perform pairing and transition to paired state upon valid response', async () => {
    const manager = new PairingManager();
    const stateTransitions: string[] = [];
    manager.onStateChange((state) => stateTransitions.push(state));

    const hostPriv = x25519.utils.randomPrivateKey();
    const hostPub = x25519.getPublicKey(hostPriv);
    const hostPubHex = bytesToHex(hostPub);
    const nonceHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // Mock fetch for host handshake
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'paired',
        player_index: 0,
        player_color: '#00E5FF',
        session_id: 'sess-abc-123',
        host_pubkey: hostPubHex,
        signaling_ws_url: '/ws/signaling?session_id=sess-abc-123',
      }),
    });

    const rawUri = `lookaremote://pair?h=127.0.0.1&p=8765&k=${hostPubHex}&n=${nonceHex}&v=1`;

    // Temporarily replace global.fetch
    const originalFetch = global.fetch;
    global.fetch = mockFetch as any;

    try {
      const session = await manager.pairFromRawUri(rawUri);
      expect(session).toBeDefined();
      expect(session.handshakeResponse.session_id).toBe('sess-abc-123');
      expect(manager.state).toBe('paired');
      expect(stateTransitions).toContain('parsing');
      expect(stateTransitions).toContain('handshaking');
      expect(stateTransitions).toContain('paired');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should clear secrets and session on reset', () => {
    const manager = new PairingManager();
    manager.reset();
    expect(manager.state).toBe('idle');
    expect(manager.session).toBeNull();
  });
});
