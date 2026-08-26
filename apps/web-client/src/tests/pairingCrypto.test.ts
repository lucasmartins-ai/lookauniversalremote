import { describe, it, expect } from 'vitest';
import { x25519 } from '@noble/curves/ed25519';
import {
  parsePairingUri,
  generateClientKeyPair,
  deriveSharedSecret,
  computePairingProof,
  performPairingHandshake,
  bytesToHex,
} from '../features/pairing/pairingCrypto';

describe('Pairing Cryptography & Handshake Suite', () => {
  it('should correctly parse canonical QR code URIs', () => {
    const host = '192.168.1.100';
    const port = 8765;
    const hostPubKey = 'a'.repeat(64);
    const nonce = 'b'.repeat(64);
    const uri = `https://remote.lookaberry.com/connect#h=${host}&p=${port}&k=${hostPubKey}&n=${nonce}&v=1`;

    const parsed = parsePairingUri(uri);
    expect(parsed.host).toBe(host);
    expect(parsed.port).toBe(port);
    expect(parsed.hostPubKey).toBe(hostPubKey);
    expect(parsed.nonce).toBe(nonce);
    expect(parsed.version).toBe(1);
  });

  it('should correctly parse query string or raw fragment formats', () => {
    const hostPubKey = '1234567890abcdef'.repeat(4);
    const nonce = 'fedcba0987654321'.repeat(4);
    const uri = `lookaremote://connect?h=10.0.0.5&p=9000&k=${hostPubKey}&n=${nonce}`;

    const parsed = parsePairingUri(uri);
    expect(parsed.host).toBe('10.0.0.5');
    expect(parsed.port).toBe(9000);
    expect(parsed.hostPubKey).toBe(hostPubKey);
    expect(parsed.nonce).toBe(nonce);
    expect(parsed.version).toBe(1);
  });

  it('should parse JSON pairing payload', () => {
    const hostPubKey = 'c'.repeat(64);
    const nonce = 'd'.repeat(64);
    const json = JSON.stringify({
      host: '172.16.0.2',
      port: 8080,
      hostPubKey,
      nonce,
      version: 1,
    });

    const parsed = parsePairingUri(json);
    expect(parsed.host).toBe('172.16.0.2');
    expect(parsed.port).toBe(8080);
    expect(parsed.hostPubKey).toBe(hostPubKey);
    expect(parsed.nonce).toBe(nonce);
  });

  it('should reject invalid or truncated keys and nonces', () => {
    expect(() => parsePairingUri('https://remote.lookaberry.com/connect#h=192.168.1.1&p=8765&k=1234&n=5678')).toThrow(
      /Invalid host public key/
    );
  });

  it('should generate valid 32-byte X25519 ephemeral keypairs', () => {
    const keypair = generateClientKeyPair();
    expect(keypair.privateKey.length).toBe(32);
    expect(keypair.publicKey.length).toBe(32);
    expect(keypair.publicKeyHex.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(keypair.publicKeyHex)).toBe(true);
  });

  it('should derive symmetric Diffie-Hellman shared secret between client and simulated host', () => {
    // Generate simulated host keypair
    const hostPriv = x25519.utils.randomPrivateKey();
    const hostPub = x25519.getPublicKey(hostPriv);
    const hostPubHex = bytesToHex(hostPub);

    // Generate client keypair
    const clientKeyPair = generateClientKeyPair();

    // Derive shared secrets from both sides
    const clientSecret = deriveSharedSecret(clientKeyPair.privateKey, hostPubHex);
    const hostSecret = x25519.getSharedSecret(hostPriv, clientKeyPair.publicKey);

    expect(clientSecret).toEqual(hostSecret);
    expect(clientSecret.length).toBe(32);
  });

  it('should compute valid HMAC-SHA256 authentication proof', () => {
    const sharedSecret = new Uint8Array(32).fill(0x42);
    const nonceHex = '0123456789abcdef'.repeat(4);

    const proofHex = computePairingProof(sharedSecret, nonceHex);
    expect(proofHex.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(proofHex)).toBe(true);

    // Verify proof changes if nonce changes
    const diffNonce = '0123456789abcdee'.repeat(4);
    const diffProof = computePairingProof(sharedSecret, diffNonce);
    expect(proofHex).not.toBe(diffProof);
  });

  it('should perform complete handshake with mocked HTTP fetch', async () => {
    const hostKeyPair = generateClientKeyPair();
    const nonce = 'e'.repeat(64);

    const mockFetch = async (url: string, init: any) => {
      expect(url).toBe('http://192.168.1.50:8765/api/pair');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.client_pubkey.length).toBe(64);
      expect(body.nonce).toBe(nonce);
      expect(body.hmac_proof.length).toBe(64);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'paired',
          session_id: 'sess_123456789',
          host_pubkey: hostKeyPair.publicKeyHex,
          signaling_ws_url: '/ws/signaling',
        }),
      } as any;
    };

    const params = {
      host: '192.168.1.50',
      port: 8765,
      hostPubKey: hostKeyPair.publicKeyHex,
      nonce,
      version: 1,
    };

    const result = await performPairingHandshake(params, undefined, mockFetch as any);
    expect(result.response.status).toBe('paired');
    expect(result.response.session_id).toBe('sess_123456789');
    expect(result.clientKeyPair.publicKeyHex.length).toBe(64);
  });
});
