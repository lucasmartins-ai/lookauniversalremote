import React, { useState, useEffect } from 'react';
import { TargetDeviceTypeValue } from '@lookaremote/protocol-types';
import { HostConnectionManager } from '../../transport/HostConnectionManager';
import { Tv, RefreshCw, Check, AlertCircle, Radio, X } from 'lucide-react';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface DiscoveredTvDevice {
  id: string;
  ip: string;
  name: string;
  brand: string;
  protocol: TargetDeviceTypeValue;
  port: number;
  source: 'ssdp' | 'mdns' | 'probe' | 'manual';
  model?: string;
  requires_pairing: boolean;
  capabilities: string[];
}

export interface TargetSelectorProps {
  selectedProtocol: TargetDeviceTypeValue;
  onSelectDevice: (device: DiscoveredTvDevice) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const TargetSelector: React.FC<TargetSelectorProps> = ({
  selectedProtocol,
  onSelectDevice,
  isOpen,
  onClose,
}) => {
  const [devices, setDevices] = useState<DiscoveredTvDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      setErrorMsg(null);
      const endpoint = HostConnectionManager.getHttpEndpoint('/api/v1/tv/devices');
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'ok' && Array.isArray(json.devices)) {
          setDevices(json.devices);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch discovered TV devices:', err);
    }
  };

  const triggerScan = async () => {
    setIsScanning(true);
    setErrorMsg(null);
    haptics.buttonClick();
    try {
      const endpoint = HostConnectionManager.getHttpEndpoint('/api/v1/tv/scan');
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'ok' && Array.isArray(json.devices)) {
          setDevices(json.devices);
          haptics.heavyClick();
        }
      } else {
        setErrorMsg('Falha ao escanear rede local.');
      }
    } catch (err) {
      setErrorMsg('Erro de conexão com o Host LookARemote.');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 4, 8, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 1000,
      }}
    >
      <div
        className="neo-raised-lg"
        style={{
          width: '100%',
          maxWidth: '400px',
          borderRadius: '18px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            background: 'linear-gradient(180deg, #1e293b 0%, #121824 100%)',
            borderBottom: '1.5px solid #070a0f',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tv size={18} color="var(--color-neon-cyan)" />
            <h3
              style={{
                margin: 0,
                fontSize: '1rem',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              SELECIONAR SMART TV
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scan Actions & Device List */}
        <div
          className="neo-sunken"
          style={{
            margin: '12px 14px',
            padding: '14px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-text-secondary)',
                fontWeight: 700,
              }}
            >
              DISPOSITIVOS NA REDE ({devices.length})
            </span>
            <button
              type="button"
              onClick={triggerScan}
              disabled={isScanning}
              className="lookaremote-btn retro-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(180deg, #00f0ff 0%, #008ba3 100%)',
                border: '1px solid #00f0ff',
                color: '#040d1a',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                boxShadow: 'var(--neo-shadow-button-cyan)',
                cursor: isScanning ? 'wait' : 'pointer',
              }}
            >
              <RefreshCw size={13} className={isScanning ? 'spin' : ''} />
              <span>{isScanning ? 'BUSCANDO...' : 'ESCANEAR'}</span>
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 42, 85, 0.15)',
                border: '1px solid var(--color-neon-red)',
                color: 'var(--color-neon-red)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
              }}
            >
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}

          {devices.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 12px',
                color: 'var(--color-text-muted)',
                fontSize: '0.8rem',
              }}
            >
              <Radio size={28} style={{ opacity: 0.5, marginBottom: '8px' }} />
              <p style={{ margin: 0, fontWeight: 600 }}>Nenhuma TV detectada via SSDP / mDNS.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.725rem', fontFamily: 'var(--font-mono)' }}>
                Clique em "ESCANEAR" para buscar na rede local.
              </p>
            </div>
          ) : (
            devices.map((device) => {
              const isSelected = selectedProtocol === device.protocol;
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => {
                    haptics.buttonClick();
                    onSelectDevice(device);
                    onClose();
                  }}
                  className="lookaremote-btn retro-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: isSelected
                      ? 'linear-gradient(180deg, #1b263b 0%, #111a28 100%)'
                      : 'linear-gradient(180deg, #182030 0%, #0e1420 100%)',
                    border: `1.5px solid ${isSelected ? 'var(--color-neon-cyan)' : 'rgba(255, 255, 255, 0.1)'}`,
                    boxShadow: isSelected
                      ? 'var(--neo-shadow-button-cyan-pressed), 0 0 10px rgba(0, 229, 255, 0.3)'
                      : 'var(--neo-shadow-button-slate)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', fontFamily: 'var(--font-display)' }}>{device.name}</span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(0, 229, 255, 0.15)',
                          color: 'var(--color-neon-cyan)',
                          fontWeight: 700,
                        }}
                      >
                        {device.brand}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {device.ip}:{device.port} ({device.source.toUpperCase()})
                    </span>
                  </div>

                  {isSelected && <Check size={18} color="var(--color-neon-cyan)" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
