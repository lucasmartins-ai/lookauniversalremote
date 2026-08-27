import React, { useState, useEffect } from 'react';
import { TargetDeviceType, TargetDeviceTypeValue } from '@lookaremote/protocol-types';
import { HostConnectionManager } from '../../transport/HostConnectionManager';
import { Tv, RefreshCw, Check, AlertCircle, Radio, X, Plus, ListFilter } from 'lucide-react';
import { haptics } from '../../ui/haptics/hapticEngine';
import { Button } from '../../ui/components/Button';

export interface DiscoveredTvDevice {
  id: string;
  ip: string;
  name: string;
  brand: string;
  protocol: TargetDeviceTypeValue;
  port: number;
  source?: 'ssdp' | 'mdns' | 'probe' | 'manual';
  discovery_source?: 'ssdp' | 'mdns' | 'probe' | 'manual';
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
  const [activeTab, setActiveTab] = useState<'discovered' | 'manual'>('discovered');

  // Manual TV form state
  const [manualIp, setManualIp] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualProtocol, setManualProtocol] = useState<TargetDeviceTypeValue>(
    TargetDeviceType.ANDROID_GOOGLE_TV
  );

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

  const handleAddManualTv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) {
      setErrorMsg('Digite o endereço IP da TV (Ex: 192.168.1.50)');
      return;
    }

    const cleanIp = manualIp.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const brandMap: Record<number, string> = {
      [TargetDeviceType.ANDROID_GOOGLE_TV]: 'Google / Android TV',
      [TargetDeviceType.SAMSUNG_TIZEN]: 'Samsung',
      [TargetDeviceType.LG_WEBOS]: 'LG',
      [TargetDeviceType.ROKU_TV]: 'Roku',
      [TargetDeviceType.SONY_BRAVIA]: 'Sony',
      [TargetDeviceType.APPLE_TV]: 'Apple',
      [TargetDeviceType.GENERIC_TV]: 'Genérica',
    };

    const brand = brandMap[manualProtocol] || 'Smart TV';
    const name = manualName.trim() || `${brand} (${cleanIp})`;
    const manualDevice: DiscoveredTvDevice = {
      id: `manual-${cleanIp.replace(/\./g, '-')}`,
      ip: cleanIp,
      name,
      brand,
      protocol: manualProtocol,
      port: 80,
      source: 'manual',
      requires_pairing: false,
      capabilities: ['keys', 'text_input'],
    };

    try {
      const endpoint = HostConnectionManager.getHttpEndpoint('/api/tv-target');
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tv_ip: cleanIp }),
      }).catch(() => {});

      const selectEndpoint = HostConnectionManager.getHttpEndpoint('/api/v1/tv/select');
      await fetch(selectEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: manualDevice.id }),
      }).catch(() => {});
    } catch {
      // Ignored
    }

    haptics.pairSuccess();
    onSelectDevice(manualDevice);
    onClose();
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
          maxWidth: '420px',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: '85vh',
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

        {/* Tab switcher: Discovered vs Manual IP */}
        <div
          className="neo-sunken"
          style={{
            margin: '12px 14px 0 14px',
            padding: '4px',
            borderRadius: '10px',
            display: 'flex',
            gap: '6px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              haptics.buttonClick();
              setActiveTab('discovered');
            }}
            className="lookaremote-btn retro-btn"
            style={{
              flex: 1,
              padding: '7px 4px',
              borderRadius: '8px',
              background: activeTab === 'discovered' ? 'linear-gradient(180deg, #00f0ff 0%, #008ba3 100%)' : 'transparent',
              border: activeTab === 'discovered' ? '1px solid #00f0ff' : 'none',
              color: activeTab === 'discovered' ? '#040d1a' : 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: '0.75rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <ListFilter size={14} />
            <span>DESCOBERTAS ({devices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.buttonClick();
              setActiveTab('manual');
            }}
            className="lookaremote-btn retro-btn"
            style={{
              flex: 1,
              padding: '7px 4px',
              borderRadius: '8px',
              background: activeTab === 'manual' ? 'linear-gradient(180deg, #00f0ff 0%, #008ba3 100%)' : 'transparent',
              border: activeTab === 'manual' ? '1px solid #00f0ff' : 'none',
              color: activeTab === 'manual' ? '#040d1a' : 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: '0.75rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Plus size={14} />
            <span>INSERIR IP MANUAL</span>
          </button>
        </div>

        {/* Content Body */}
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

          {activeTab === 'discovered' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  DISPOSITIVOS NA REDE
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
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    boxShadow: 'var(--neo-shadow-button-cyan)',
                    cursor: isScanning ? 'wait' : 'pointer',
                  }}
                >
                  <RefreshCw size={13} className={isScanning ? 'spin' : ''} />
                  <span>{isScanning ? 'BUSCANDO...' : 'BUSCAR NA REDE'}</span>
                </button>
              </div>

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
                  <p style={{ margin: 0, fontWeight: 600 }}>Nenhuma TV detectada automaticamente.</p>
                  <p style={{ margin: '4px 0 12px 0', fontSize: '0.725rem', fontFamily: 'var(--font-mono)' }}>
                    Clique na aba "INSERIR IP MANUAL" para conectar direto.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab('manual')}
                    leftIcon={<Plus size={14} />}
                  >
                    DIGITAR IP DA MINHA TV
                  </Button>
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
                          <span style={{ fontWeight: 800, fontSize: '0.88rem', fontFamily: 'var(--font-display)' }}>
                            {device.name}
                          </span>
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
                          {device.ip}:{device.port} ({((device.discovery_source || device.source || 'rede') as string).toUpperCase()})
                        </span>
                      </div>

                      {isSelected && <Check size={18} color="var(--color-neon-cyan)" />}
                    </button>
                  );
                })
              )}
            </>
          ) : (
            /* Manual IP Tab */
            <form onSubmit={handleAddManualTv} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-muted)',
                    marginBottom: '4px',
                    fontWeight: 700,
                  }}
                >
                  ENDEREÇO IP DA SMART TV
                </label>
                <input
                  type="text"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  placeholder="Ex: 192.168.1.50"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 229, 255, 0.4)',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-muted)',
                    marginBottom: '4px',
                    fontWeight: 700,
                  }}
                >
                  SISTEMA / MARCA DA TV
                </label>
                <select
                  value={manualProtocol}
                  onChange={(e) => setManualProtocol(parseInt(e.target.value, 10) as TargetDeviceTypeValue)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 229, 255, 0.4)',
                    backgroundColor: '#101622',
                    color: '#ffffff',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value={TargetDeviceType.ANDROID_GOOGLE_TV}>Android TV / Google TV / Chromecast</option>
                  <option value={TargetDeviceType.SAMSUNG_TIZEN}>Samsung Smart TV (Tizen)</option>
                  <option value={TargetDeviceType.LG_WEBOS}>LG Smart TV (webOS)</option>
                  <option value={TargetDeviceType.ROKU_TV}>Roku TV / Roku Express / Stick</option>
                  <option value={TargetDeviceType.SONY_BRAVIA}>Sony Bravia</option>
                  <option value={TargetDeviceType.APPLE_TV}>Apple TV (tvOS / AirPlay)</option>
                  <option value={TargetDeviceType.GENERIC_TV}>Outras Smart TVs (Genérica / DLNA)</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-muted)',
                    marginBottom: '4px',
                    fontWeight: 700,
                  }}
                >
                  NOME PERSONALIZADO (OPCIONAL)
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Ex: TV da Sala"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                style={{ marginTop: '8px' }}
              >
                CONECTAR À SMART TV
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
