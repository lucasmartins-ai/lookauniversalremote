import React, { useState } from 'react';
import { Clipboard, ArrowRight, AlertCircle, Link2 } from 'lucide-react';
import { Button } from '../../ui/components/Button';
import { parsePairingUri, PairingParams } from './pairingCrypto';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface ManualPairViewProps {
  onPair: (params: PairingParams) => void;
  onCancel?: () => void;
}

export const ManualPairView: React.FC<ManualPairViewProps> = ({ onPair, onCancel }) => {
  const [rawInput, setRawInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePaste = async () => {
    try {
      haptics.buttonClick();
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawInput(text);
        setError(null);
      }
    } catch {
      setError('Clipboard access denied. Please paste manually into the field.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!rawInput.trim()) {
      setError('Please enter a pairing URL or parameters.');
      return;
    }

    try {
      const params = parsePairingUri(rawInput);
      haptics.pairSuccess();
      onPair(params);
    } catch (err: any) {
      haptics.errorAlert();
      setError(err.message || 'Invalid pairing code format.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--color-neon-cyan)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}
        >
          Manual Pairing Handshake
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          Paste the pairing URL or token displayed in the Host Daemon terminal.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setError(null);
            }}
            rows={4}
            placeholder="https://remote.lookaberry.com/connect#h=192.168.1.50&p=8765&k=...&n=...&v=1"
            style={{
              width: '100%',
              backgroundColor: 'var(--color-surface-base)',
              border: `1px solid ${error ? 'var(--color-neon-red)' : 'var(--color-border-subtle)'}`,
              borderRadius: '8px',
              padding: '12px',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.825rem',
              resize: 'none',
              outline: 'none',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
            }}
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePaste}
            leftIcon={<Clipboard size={14} />}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              fontSize: '0.75rem',
              padding: '4px 8px',
            }}
          >
            PASTE
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

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          {onCancel && (
            <Button type="button" variant="ghost" fullWidth onClick={onCancel}>
              BACK
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            fullWidth
            leftIcon={<Link2 size={16} />}
            rightIcon={<ArrowRight size={16} />}
          >
            CONNECT TO HOST
          </Button>
        </div>
      </form>
    </div>
  );
};
