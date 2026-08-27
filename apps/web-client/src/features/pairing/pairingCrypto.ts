/**
 * LookARemote Ephemeral X25519 & HMAC-SHA256 Browser Crypto
 * Interoperable with host-daemon Rust crypto implementation.
 */

import { x25519 } from '@noble/curves/ed25519';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { HostConnectionManager } from '../../transport/HostConnectionManager';

export const PAIRING_HMAC_CONTEXT_STRING = 'LOOKAREMOTE_PAIRING_V1:';
const PAIRING_HMAC_CONTEXT_BYTES = new TextEncoder().encode(PAIRING_HMAC_CONTEXT_STRING);

export interface PairingParams {
  host: string;
  port: number;
  hostPubKey: string; // 64 hex characters (32 bytes)
  nonce: string; // 64 hex characters (32 bytes)
  version: number;
}

export interface ClientKeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyHex: string;
}

export interface PairRequestPayload {
  client_pubkey: string;
  nonce: string;
  hmac_proof: string;
}

export interface PairResponsePayload {
  status: string;
  player_index?: number;
  player_color?: string;
  session_id: string;
  host_pubkey: string;
  signaling_ws_url: string;
}

/**
 * Converts Uint8Array to lowercase hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b !== undefined) {
      hex += b.toString(16).padStart(2, '0');
    }
  }
  return hex;
}

/**
 * Converts hex string to Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim().toLowerCase();
  if (cleanHex.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: ${cleanHex.length}`);
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const sub = cleanHex.substring(i * 2, i * 2 + 2);
    const parsed = parseInt(sub, 16);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid hex byte: "${sub}"`);
    }
    bytes[i] = parsed;
  }
  return bytes;
}

/**
 * Parses the canonical QR Code URI:
 * e.g., `https://remote.lookaberry.com/connect#h=192.168.1.50&p=8765&k=a8f94c...&n=e3b0c4...&v=1`
 * Also supports direct hash string, query string, or JSON payload.
 */
export function parsePairingUri(raw: string): PairingParams {
  const trimmed = raw.trim();

  // 1. Try JSON parsing
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      const host = obj.h || obj.host || '127.0.0.1';
      const port = Number(obj.p || obj.port || 8765);
      const hostPubKey = String(obj.k || obj.hostPubKey || obj.host_pubkey || '').trim().toLowerCase();
      const nonce = String(obj.n || obj.nonce || '').trim().toLowerCase();
      const version = Number(obj.v || obj.version || 1);

      if (hostPubKey.length !== 64) {
        throw new Error(`Invalid hostPubKey length: expected 64 hex characters, got ${hostPubKey.length}`);
      }
      if (nonce.length !== 64) {
        throw new Error(`Invalid nonce length: expected 64 hex characters, got ${nonce.length}`);
      }

      return { host, port, hostPubKey, nonce, version };
    } catch (e: any) {
      if (e.message.includes('expected 64')) throw e;
    }
  }

  // 2. Extract fragment (#...) or query (?...)
  let paramString = '';
  const hashIdx = trimmed.indexOf('#');
  const queryIdx = trimmed.indexOf('?');

  if (hashIdx !== -1) {
    paramString = trimmed.substring(hashIdx + 1);
  } else if (queryIdx !== -1) {
    paramString = trimmed.substring(queryIdx + 1);
  } else if (trimmed.includes('h=') || trimmed.includes('k=')) {
    paramString = trimmed;
  } else {
    throw new Error('Formato de QR Code não reconhecido. Aponte para o QR Code do LookARemote.');
  }

  // Normalize HTML entities like &amp;
  paramString = paramString.replace(/&amp;/g, '&');

  const searchParams = new URLSearchParams(paramString);
  const host = searchParams.get('h') || searchParams.get('host');
  const portStr = searchParams.get('p') || searchParams.get('port');
  const hostPubKey = (searchParams.get('k') || searchParams.get('hostPubKey') || searchParams.get('key') || '').trim().toLowerCase();
  const nonce = (searchParams.get('n') || searchParams.get('nonce') || '').trim().toLowerCase();
  const versionStr = searchParams.get('v') || searchParams.get('version') || '1';

  if (!host) {
    throw new Error('Missing host IP (parameter "h")');
  }

  const port = parseInt(portStr || '8765', 10);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: "${portStr}"`);
  }

  if (hostPubKey.length !== 64) {
    throw new Error(`Invalid host public key (parameter "k"): expected 64 hex characters, got ${hostPubKey.length}`);
  }

  if (nonce.length !== 64) {
    throw new Error(`Invalid pairing nonce (parameter "n"): expected 64 hex characters, got ${nonce.length}`);
  }

  const version = parseInt(versionStr, 10) || 1;

  return {
    host,
    port,
    hostPubKey,
    nonce,
    version,
  };
}

/**
 * Generates an ephemeral X25519 keypair for the client.
 */
export function generateClientKeyPair(): ClientKeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    publicKeyHex: bytesToHex(publicKey),
  };
}

/**
 * Derives Diffie-Hellman shared secret: S = X25519(client_priv, host_pub).
 */
export function deriveSharedSecret(clientPrivateKey: Uint8Array, hostPublicKeyHex: string): Uint8Array {
  const hostPubKeyBytes = hexToBytes(hostPublicKeyHex);
  return x25519.getSharedSecret(clientPrivateKey, hostPubKeyBytes);
}

/**
 * Computes HMAC-SHA256(shared_secret, "LOOKAREMOTE_PAIRING_V1:" || nonce).
 */
export function computePairingProof(sharedSecret: Uint8Array, nonceHex: string): string {
  const nonceBytes = hexToBytes(nonceHex);
  const message = new Uint8Array(PAIRING_HMAC_CONTEXT_BYTES.length + nonceBytes.length);
  message.set(PAIRING_HMAC_CONTEXT_BYTES, 0);
  message.set(nonceBytes, PAIRING_HMAC_CONTEXT_BYTES.length);

  const proofBytes = hmac(sha256, sharedSecret, message);
  return bytesToHex(proofBytes);
}

/**
 * Performs complete cryptographic handshake with the Host Daemon:
 * 1. Generates ephemeral client X25519 keypair
 * 2. Derives shared secret
 * 3. Computes HMAC proof
 * 4. POSTs /api/pair to the host
 */
export async function performPairingHandshake(
  params: PairingParams,
  clientKeyPair: ClientKeyPair = generateClientKeyPair(),
  fetchImpl: typeof fetch = fetch
): Promise<{
  response: PairResponsePayload;
  clientKeyPair: ClientKeyPair;
  sharedSecret: Uint8Array;
}> {
  const sharedSecret = deriveSharedSecret(clientKeyPair.privateKey, params.hostPubKey);
  const hmacProof = computePairingProof(sharedSecret, params.nonce);

  const payload: PairRequestPayload = {
    client_pubkey: clientKeyPair.publicKeyHex,
    nonce: params.nonce,
    hmac_proof: hmacProof,
  };

  const endpoint = HostConnectionManager.getPairingEndpoint(params.host, params.port);

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.message) {
        errorDetail = `${errJson.error || 'error'}: ${errJson.message}`;
      }
    } catch {
      // Ignored
    }
    throw new Error(`Pairing handshake failed (${errorDetail})`);
  }

  const response: PairResponsePayload = await res.json();

  if (response.status !== 'paired' || !response.session_id) {
    throw new Error(`Pairing rejected by host: ${JSON.stringify(response)}`);
  }

  return {
    response,
    clientKeyPair,
    sharedSecret,
  };
}
