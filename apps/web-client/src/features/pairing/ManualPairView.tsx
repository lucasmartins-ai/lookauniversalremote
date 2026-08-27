import React, { useState, useEffect } from 'react';
import { Clipboard, ArrowRight, AlertCircle, Link2, Zap, Server, ExternalLink, Info } from 'lucide-react';
import { Button } from '../../ui/components/Button';
import { parsePairingUri, PairingParams } from './pairingCrypto';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface ManualPairViewProps {
  onPair: (params: PairingParams) => void;
  onCancel?: () => void;
}

export const ManualPairView: React.FC<ManualPairViewProps> = ({ onPair, onCancel }) => {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  const getInitialHost = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lookaremote_last_host_ip');
      if (saved) return saved;
      const host = window.location.hostname;
      if (
        host &&
        (host.startsWith('192.168.') ||
          host.startsWith('10.') ||
          host.startsWith('172.') ||
          host === 'localhost' ||
          host === '127.0.0.1')
      ) {
        return host;
      }
    }
    return '192.168.1.105';
  };

  const [hostIp, setHostIp] = useState(getInitialHost);
  const [hostPort, setHostPort] = useState('8765');
  const [rawInput, setRawInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mixedContentWarning, setMixedContentWarning] = useState<string | null>(null);

  // Save last used host IP
  useEffect(() => {
    if (hostIp && !hostIp.includes('vercel.app') && !hostIp.includes('lookaberry')) {
      localStorage.setItem('lookaremote_last_host_ip', hostIp.trim());
    }
  }, [hostIp]);

  // Handle direct connect with IP or pasted full URI
  const handleAutoConnect = async (targetInput: string, targetPort: string) => {
    setIsLoading(true);
    setError(null);
    setMixedContentWarning(null);
    haptics.buttonClick();

    const cleanInput = targetInput.trim();

    // 1. If user pasted a full pairing URL / hash / JSON in the IP field, parse directly!
    if (
      cleanInput.includes('http://') ||
      cleanInput.includes('https://') ||
      cleanInput.includes('#h=') ||
      cleanInput.includes('h=') ||
      cleanInput.startsWith('{')
    ) {
      try {
        const params = parsePairingUri(cleanInput);
        haptics.pairSuccess();
        onPair(params);
        return;
      } catch {
        // Fall back to treating as host
      }
    }

    const cleanHost = cleanInput.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').split(':')[0] || '192.168.1.105';
    const port = parseInt(targetPort, 10) || 8765;

    try {
      const endpoint = `http://${cleanHost}:${port}/api/pair-token`;
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Servidor respondeu com status ${res.status}. Verifique se o Host Daemon está rodando.`);
      }
      const data = await res.json();
      if (!data.host || !data.host_pubkey || !data.nonce) {
        throw new Error('Resposta inválida do servidor.');
      }

      const params: PairingParams = {
        host: cleanHost,
        port,
        hostPubKey: data.host_pubkey,
        nonce: data.nonce,
        version: data.version || 1,
      };

      haptics.pairSuccess();
      onPair(params);
    } catch (err: any) {
      haptics.errorAlert();
      const errMsg = err.message || '';

      if (isHttps && (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('Load failed'))) {
        setMixedContentWarning(`O navegador bloqueia requisições de páginas HTTPS para IPs locais HTTP (Mixed Content). Abra http://${cleanHost}:${port} diretamente no celular ou cole o Token de Pareamento abaixo.`);
        setError(`Falha ao conectar via HTTPS. Use a conexão direta HTTP ou cole o Token.`);
      } else {
        setError(errMsg || 'Falha ao conectar com o Host Daemon.');
      }
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
        // If it looks like a pairing link, auto-connect
        if (text.includes('#h=') || text.includes('h=') || text.startsWith('{')) {
          try {
            const params = parsePairingUri(text);
            haptics.pairSuccess();
            onPair(params);
          } catch {
            // Wait for user click
          }
        }
      }
    } catch {
      setError('Acesso à área de transferência negado. Cole manualmente no campo.');
    }
  };

  const handleSubmitRaw = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!rawInput.trim()) {
      setError('Por favor, cole a URL ou Token de pareamento.');
      return;
    }

    try {
      const params = parsePairingUri(rawInput);
      haptics.pairSuccess();
      onPair(params);
    } catch (err: any) {
      haptics.errorAlert();
      setError(err.message || 'Formato de token/código inválido.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h3
          className="retro-embossed-text"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.2rem',
            fontWeight: 900,
            color: 'var(--color-neon-cyan)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}
        >
          Conexão Manual / Direta
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem', fontWeight: 600 }}>
          Conecte inserindo o IP do computador na rede Wi-Fi ou colando a URL de pareamento.
        </p>
      </div>

      {/* HTTPS Notice */}
      {isHttps && (
        <div
          className="neo-raised"
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 192, 30, 0.4)',
            backgroundColor: 'rgba(255, 192, 30, 0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <Info size={18} color="#ffc01e" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.74rem', color: '#f0f6fc', lineHeight: 1.4 }}>
            <strong style={{ color: '#ffc01e' }}>Acesso via Rede Local:</strong> Para conectar em 1 clique sem bloqueio de segurança do navegador, você também pode abrir{' '}
            <a
              href={`http://${hostIp}:${hostPort}`}
              target="_self"
              style={{ color: 'var(--color-neon-cyan)', fontWeight: 700, textDecoration: 'underline' }}
            >
              http://{hostIp}:{hostPort}
            </a>{' '}
            no navegador do seu celular.
          </div>
        </div>
      )}

      {/* 1-CLICK INSTANT LAN CONNECT BOX (3D Raised Panel) */}
      <div
        className="neo-raised"
        style={{
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          border: '1.5px solid rgba(0, 229, 255, 0.35)',
          boxShadow: 'var(--neo-shadow-raised), 0 0 16px rgba(0, 229, 255, 0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-neon-cyan)', fontSize: '0.85rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
          <Zap size={18} />
          <span>CONECTAR POR IP DO COMPUTADOR</span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 3 }}>
            <label style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px', fontWeight: 700 }}>IP DO HOST / PC (Wi-Fi)</label>
            <input
              type="text"
              value={hostIp}
              onChange={(e) => setHostIp(e.target.value)}
              placeholder="ex: 192.168.1.105"
              className="neo-sunken"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                fontWeight: 700,
                outline: 'none',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            />
          </div>
          <div style={{ flex: 1.4 }}>
            <label style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px', fontWeight: 700 }}>PORTA</label>
            <input
              type="text"
              value={hostPort}
              onChange={(e) => setHostPort(e.target.value)}
              placeholder="8765"
              className="neo-sunken"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                fontWeight: 700,
                outline: 'none',
                border: '1px solid rgba(255, 255, 255, 0.1)',
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
          {isLoading ? 'CONECTANDO AO HOST...' : 'CONECTAR AO COMPUTADOR'}
        </Button>
      </div>

      {/* Mixed Content / Error Guidance */}
      {mixedContentWarning && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: 'rgba(255, 192, 30, 0.12)',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1.5px solid #ffc01e',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffc01e', fontWeight: 700, fontSize: '0.8rem' }}>
            <AlertCircle size={18} />
            <span>Bloqueio de Segurança do Navegador</span>
          </div>
          <p style={{ color: '#f0f6fc', fontSize: '0.74rem', lineHeight: 1.4 }}>
            {mixedContentWarning}
          </p>
          <a
            href={`http://${hostIp}:${hostPort}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: '#ffc01e',
              color: '#070a0f',
              padding: '8px 12px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.75rem',
              textDecoration: 'none',
              marginTop: '4px',
            }}
          >
            <ExternalLink size={14} />
            ABRIR http://{hostIp}:{hostPort} NO NAVEGADOR
          </a>
        </div>
      )}

      {error && !mixedContentWarning && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--color-neon-red)',
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            backgroundColor: 'rgba(255, 42, 85, 0.15)',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1.5px solid var(--color-neon-red)',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* PASTE FULL TOKEN / URL BOX */}
      <div
        className="neo-sunken"
        style={{
          borderRadius: '14px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
            OU COLE A URL / TOKEN DO TERMINAL:
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handlePaste}
            leftIcon={<Clipboard size={12} />}
            style={{ fontSize: '0.7rem', height: '26px', padding: '2px 8px' }}
          >
            COLAR
          </Button>
        </div>

        <form onSubmit={handleSubmitRaw} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setError(null);
            }}
            rows={2}
            placeholder="Cole o link https://remote...#h=192.168... ou o código gerado no terminal"
            className="neo-sunken-deep"
            style={{
              width: '100%',
              borderRadius: '8px',
              padding: '8px 10px',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              resize: 'none',
              outline: 'none',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          />
          <Button type="submit" variant="secondary" fullWidth size="sm" leftIcon={<Link2 size={14} />}>
            CONECTAR VIA TOKEN
          </Button>
        </form>
      </div>

      {onCancel && (
        <Button type="button" variant="ghost" fullWidth size="sm" onClick={onCancel}>
          VOLTAR
        </Button>
      )}
    </div>
  );
};
