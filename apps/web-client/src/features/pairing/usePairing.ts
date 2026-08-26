import { useState, useEffect, useCallback } from 'react';
import {
  parsePairingUri,
  performPairingHandshake,
  PairingParams,
  PairResponsePayload,
  ClientKeyPair,
  generateClientKeyPair,
} from './pairingCrypto';

export type PairingStage = 'idle' | 'parsing' | 'handshaking' | 'success' | 'error';

export interface PairingSession {
  params: PairingParams;
  clientKeyPair: ClientKeyPair;
  sharedSecret: Uint8Array;
  handshakeResponse: PairResponsePayload;
}

export interface UsePairingResult {
  stage: PairingStage;
  error: string | null;
  session: PairingSession | null;
  pairWithRawUri: (rawUri: string) => Promise<PairingSession>;
  pairWithParams: (params: PairingParams) => Promise<PairingSession>;
  reset: () => void;
}

export function usePairing(autoCheckUrlHash = true): UsePairingResult {
  const [stage, setStage] = useState<PairingStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PairingSession | null>(null);

  const reset = useCallback(() => {
    setStage('idle');
    setError(null);
    setSession(null);
  }, []);

  const pairWithParams = useCallback(async (params: PairingParams): Promise<PairingSession> => {
    setStage('handshaking');
    setError(null);

    try {
      const clientKeyPair = generateClientKeyPair();
      const handshake = await performPairingHandshake(params, clientKeyPair);

      const pairingSession: PairingSession = {
        params,
        clientKeyPair: handshake.clientKeyPair,
        sharedSecret: handshake.sharedSecret,
        handshakeResponse: handshake.response,
      };

      setSession(pairingSession);
      setStage('success');
      return pairingSession;
    } catch (err: any) {
      const msg = err.message || 'Pairing handshake failed.';
      setError(msg);
      setStage('error');
      throw err;
    }
  }, []);

  const pairWithRawUri = useCallback(
    async (rawUri: string): Promise<PairingSession> => {
      setStage('parsing');
      setError(null);

      try {
        const params = parsePairingUri(rawUri);
        return await pairWithParams(params);
      } catch (err: any) {
        const msg = err.message || 'Invalid pairing URI format.';
        setError(msg);
        setStage('error');
        throw err;
      }
    },
    [pairWithParams]
  );

  // Auto-check URL hash (e.g., https://remote.lookaberry.com/connect#h=...&k=...)
  useEffect(() => {
    if (!autoCheckUrlHash || typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (hash && (hash.includes('h=') || hash.includes('k='))) {
      pairWithRawUri(hash).catch((e) => {
        console.warn('Auto-pairing from URL hash failed:', e);
      });
    }
  }, [autoCheckUrlHash, pairWithRawUri]);

  return {
    stage,
    error,
    session,
    pairWithRawUri,
    pairWithParams,
    reset,
  };
}
