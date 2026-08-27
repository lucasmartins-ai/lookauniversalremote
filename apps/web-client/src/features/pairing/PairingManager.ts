/**
 * LookARemote Pairing Manager
 * Orchestrates pairing lifecycle: IDLE -> PARSING -> HANDSHAKING -> PAIRED -> CONNECTING -> CONNECTED -> RECONNECTING -> FAILED.
 * Preserves X25519 DH, HMAC-SHA256, and single-use nonce security.
 */

import {
  parsePairingUri,
  performPairingHandshake,
  PairingParams,
  PairResponsePayload,
  ClientKeyPair,
  generateClientKeyPair,
} from './pairingCrypto';

export type PairingState =
  | 'idle'
  | 'discovering'
  | 'parsing'
  | 'handshaking'
  | 'paired'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface StoredPairingSession {
  params: PairingParams;
  clientKeyPair: ClientKeyPair;
  sharedSecret: Uint8Array;
  handshakeResponse: PairResponsePayload;
  pairedAt: number;
}

export type PairingStateListener = (state: PairingState, error?: string | null) => void;

export class PairingManager {
  private _state: PairingState = 'idle';
  private _error: string | null = null;
  private _session: StoredPairingSession | null = null;
  private stateListeners: Set<PairingStateListener> = new Set();

  public get state(): PairingState {
    return this._state;
  }

  public get error(): string | null {
    return this._error;
  }

  public get session(): StoredPairingSession | null {
    return this._session;
  }

  public onStateChange(listener: PairingStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private setState(state: PairingState, error: string | null = null): void {
    this._state = state;
    this._error = error;
    for (const listener of this.stateListeners) {
      try {
        listener(state, error);
      } catch (err) {
        console.error('Error in PairingManager state listener:', err);
      }
    }
  }

  /**
   * Pair directly from a raw URI string (from QR code or URL hash #h=...&p=...&k=...&n=...).
   */
  public async pairFromRawUri(rawUri: string): Promise<StoredPairingSession> {
    this.setState('parsing');
    try {
      const params = parsePairingUri(rawUri);
      return await this.pairWithParams(params);
    } catch (err: any) {
      const msg = err.message || 'Failed to parse pairing URI.';
      this.setState('failed', msg);
      throw err;
    }
  }

  /**
   * Pair with explicit pairing parameters.
   */
  public async pairWithParams(params: PairingParams): Promise<StoredPairingSession> {
    this.setState('handshaking');
    try {
      const clientKeyPair = generateClientKeyPair();
      const handshake = await performPairingHandshake(params, clientKeyPair);

      const session: StoredPairingSession = {
        params,
        clientKeyPair: handshake.clientKeyPair,
        sharedSecret: handshake.sharedSecret,
        handshakeResponse: handshake.response,
        pairedAt: Date.now(),
      };

      this._session = session;
      this.setState('paired');
      return session;
    } catch (err: any) {
      const msg = err.message || 'Pairing handshake failed.';
      this.setState('failed', msg);
      throw err;
    }
  }

  /**
   * Update lifecycle state during subsequent connection phases.
   */
  public updateConnectionState(connState: 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'disconnected'): void {
    if (connState === 'connecting') {
      this.setState('connecting');
    } else if (connState === 'connected') {
      this.setState('connected');
    } else if (connState === 'reconnecting') {
      this.setState('reconnecting');
    } else if (connState === 'failed') {
      this.setState('failed', 'Transport connection failed.');
    } else if (connState === 'disconnected') {
      this.setState('idle');
    }
  }

  /**
   * Explicitly reset pairing state and clear all ephemeral keys and secrets.
   */
  public reset(): void {
    this._session = null;
    this.setState('idle', null);
  }
}
