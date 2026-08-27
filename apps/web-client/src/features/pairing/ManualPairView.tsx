import React, { useState } from 'react';
import { Clipboard, ArrowRight, AlertCircle, Link2, Zap, Server } from 'lucide-react';
import { Button } from '../../ui/components/Button';
import { parsePairingUri, PairingParams } from './pairingCrypto';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface ManualPairViewProps {
  onPair: (params: PairingParams) => void;
  onCancel?: () => void;
}

export const ManualPairView: React.FC<ManualPairViewProps> = ({ onPair, onCancel }) => {
  const defaultHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '192.168.1.105';
  const [hostIp, setHostIp] = useState(defaultHost);
  const [hostPort, setHostPort] = useState('8765');
  const [rawInput, setRawInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1-Click Fast Connect via /api/pair-token
  const handleAutoConnect = async (targetHost: string, targetPort: string) => {
    setIsLoading(true);
    setError(null);
    haptics.buttonClick();

    try {
      const endpoint = `http://${targetHost}:${targetPort}/api/pair-token`;
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Servidor não respondeu (${res.status}). Verifique se o Host Daemon está rodando.`);
      }
      const data = await res.json();
      if (!data.host || !data.host_pubkey || !data.nonce) {
        throw new Error('Resposta inválida do servidor.');
      }

      const params: PairingParams = {
        host: targetHost,
        port: parseInt(targetPort, 10) || 8765,
        hostPubKey: data.host_pubkey,
        nonce: data.nonce,
        version: data.version || 1,
      };

      haptics.pairSuccess();
      onPair(params);
    } catch (err: any) {
      haptics.errorAlert();
      setError(err.message || 'Falha ao conectar com o Host.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      haptics.buttonClick();
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawInput(text);
        setError(null);
      }
    } catch {
      setError('Acesso à área de transferência negado. Cole manualmente no campo.');
    }
  };

  const handleSubmitRaw = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!rawInput.trim()) {
      setError('Por favor, cole a URL de pareamento.');
      return;
    }

    try {
      const params = parsePairingUri(rawInput);
      haptics.pairSuccess();
      onPair(params);
    } catch (err: any) {
      haptics.errorAlert();
      setError(err.message || 'Formato de código inválido.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.15rem',
            fontWeight: 700,
            color: 'var(--color-neon-cyan)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}
        >
          Conexão Direta (Sem Câmera)
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
          Conecte em 1 clique ou insira o IP do seu computador na rede Wi-Fi.
        </p>
      </div>

      {/* 1-CLICK INSTANT LAN CONNECT BUTTON */}
      <div
        style={{
          backgroundColor: 'rgba(0, 229, 255, 0.08)',
          border: '1px solid var(--color-neon-cyan)',
          borderRadius: '10px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 0 16px rgba(0, 229, 255, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-neon-cyan)', fontSize: '0.85rem', fontWeight: 600 }}>
          <Zap size={18} />
          <span>CONEXÃO RÁPIDA DE 1 CLIQUE</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 3 }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px' }}>IP DO HOST / PC</label>
            <input
              type="text"
              value={hostIp}
              onChange={(e) => setHostIp(e.target.value)}
              placeholder="192.168.1.105"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-surface-base)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 1.5 }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px' }}>PORTA</label>
            <input
              type="text"
              value={hostPort}
              onChange={(e) => setHostPort(e.target.value)}
              placeholder="8765"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-surface-base)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <Button
          variant="primary"
          fullWidth
          size="md"
          disabled={isLoading}
          onClick={() => handleAutoConnect(hostIp, hostPort)}
          leftIcon={<Server size={16} />}
          rightIcon={<ArrowRight size={16} />}
        >
          {isLoading ? 'NEGOCIANDO CRIPTOGRAFIA...' : 'CONECTAR AO CONTROLE AGORA'}
        </Button>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--color-neon-red)',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'rgba(255, 23, 68, 0.1)',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 23, 68, 0.3)',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ALTERNATIVE: PASTE FULL TOKEN / URL */}
      <details style={{ marginTop: '4px' }}>
        <summary style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', cursor: 'pointer', outline: 'none' }}>
          Ou cole a URL completa de pareamento com token...
        </summary>
        <form onSubmit={handleSubmitRaw} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                setError(null);
              }}
              rows={3}
              placeholder="https://remote.lookaberry.com/connect#h=192.168.1.105&p=8765..."
              style={{
                width: '100%',
                backgroundColor: 'var(--color-surface-base)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '8px',
                padding: '10px',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                resize: 'none',
                outline: 'none',
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePaste}
              leftIcon={<Clipboard size={12} />}
              style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '0.7rem', padding: '3px 6px' }}
            >
              COLAR
            </Button>
          </div>
          <Button type="submit" variant="ghost" fullWidth size="sm" leftIcon={<Link2 size={14} />}>
            CONECTAR VIA TOKEN
          </Button>
        </form>
      </details>

      {onCancel && (
        <Button type="button" variant="ghost" fullWidth size="sm" onClick={onCancel}>
          VOLTAR
        </Button>
      )}
    </div>
  );
};
