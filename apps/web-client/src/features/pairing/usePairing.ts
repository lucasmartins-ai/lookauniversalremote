import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PairingParams,
  PairResponsePayload,
  ClientKeyPair,
  parsePairingUri,
} from './pairingCrypto';
import { PairingManager, PairingState } from './PairingManager';

export type PairingStage = 'idle' | 'parsing' | 'handshaking' | 'success' | 'error';

export interface PairingSession {
  params: PairingParams;
  clientKeyPair: ClientKeyPair;
  sharedSecret: Uint8Array;
  handshakeResponse: PairResponsePayload;
}

export interface UsePairingOptions {
  autoCheckUrlHash?: boolean;
  onSuccess?: (session: PairingSession) => void;
}

export interface UsePairingResult {
  stage: PairingStage;
  error: string | null;
  session: PairingSession | null;
  manager: PairingManager;
  pairWithRawUri: (rawUri: string) => Promise<PairingSession>;
  pairWithParams: (params: PairingParams) => Promise<PairingSession>;
  reset: () => void;
}

export function usePairing(options: UsePairingOptions | boolean = true): UsePairingResult {
  const opts: UsePairingOptions =
    typeof options === 'boolean' ? { autoCheckUrlHash: options } : options;
  const autoCheckUrlHash = opts.autoCheckUrlHash !== false;
  const onSuccessRef = useRef(opts.onSuccess);
  onSuccessRef.current = opts.onSuccess;

  const managerRef = useRef<PairingManager>(new PairingManager());
  const manager = managerRef.current;

  const [stage, setStage] = useState<PairingStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PairingSession | null>(null);

  useEffect(() => {
    return manager.onStateChange((state: PairingState, err?: string | null) => {
      let currentStage: PairingStage = 'idle';
      if (state === 'parsing') currentStage = 'parsing';
      else if (state === 'handshaking') currentStage = 'handshaking';
      else if (state === 'paired' || state === 'connected') currentStage = 'success';
      else if (state === 'failed') currentStage = 'error';

      setStage(currentStage);
      setError(err ?? null);

      if (manager.session) {
        setSession(manager.session);
      }
    });
  }, [manager]);

  const reset = useCallback(() => {
    manager.reset();
    setStage('idle');
    setError(null);
    setSession(null);
  }, [manager]);

  const pairWithParams = useCallback(
    async (params: PairingParams): Promise<PairingSession> => {
      try {
        const stored = await manager.pairWithParams(params);
        setSession(stored);
        setStage('success');
        return stored;
      } catch (err: any) {
        const msg = err.message || 'Pairing handshake failed.';
        setError(msg);
        setStage('error');
        throw err;
      }
    },
    [manager]
  );

  const pairWithRawUri = useCallback(
    async (rawUri: string): Promise<PairingSession> => {
      try {
        const stored = await manager.pairFromRawUri(rawUri);
        setSession(stored);
        setStage('success');
        return stored;
      } catch (err: any) {
        const msg = err.message || 'Invalid pairing URI format.';
        setError(msg);
        setStage('error');
        throw err;
      }
    },
    [manager]
  );

  // Auto-check URL hash (e.g., https://lookauniversalremote.vercel.app/#h=...&k=...)
  useEffect(() => {
    if (!autoCheckUrlHash || typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (hash && (hash.includes('h=') || hash.includes('k='))) {
      pairWithRawUri(hash)
        .then((sess) => {
          if (onSuccessRef.current) {
            onSuccessRef.current(sess);
          }
        })
        .catch((e: any) => {
          console.warn('Auto-pairing from URL hash failed:', e);
          const isHttps = window.location.protocol === 'https:';
          if (isHttps) {
            try {
              const params = parsePairingUri(hash);
              // If HTTPS blocks local LAN HTTP handshake, redirect to local HTTP origin
              window.location.href = `http://${params.host}:${params.port}/${hash}`;
            } catch {
              // Ignored
            }
          }
        });
    }
  }, [autoCheckUrlHash, pairWithRawUri]);

  return {
    stage,
    error,
    session,
    manager,
    pairWithRawUri,
    pairWithParams,
    reset,
  };
}
