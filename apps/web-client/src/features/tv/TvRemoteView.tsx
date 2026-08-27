import React, { useState, useMemo, useEffect } from 'react';
import { ProtocolBridge } from '../../transport/ProtocolBridge';
import { AppSettings } from '../settings/useSettings';
import { haptics } from '../../ui/haptics/hapticEngine';
import { TvCommandService } from './TvCommandService';
import { TargetSelector, DiscoveredTvDevice } from './TargetSelector';
import { HostConnectionManager } from '../../transport/HostConnectionManager';
import {
  TvCommand,
  TvCommandValue,
  TargetDeviceType,
  TargetDeviceTypeValue,
} from '@lookaremote/protocol-types';
import {
  Power,
  Settings,
  Home,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Hash,
  Search,
  Mic,
  Send,
  Sparkles,
  Radio,
  X,
  Tv,
  Monitor,
  Gamepad2,
  CheckCircle2,
} from 'lucide-react';
import { TelemetryData } from '../connection/ConnectionState';

export interface TvRemoteViewProps {
  bridge: ProtocolBridge;
  telemetry: TelemetryData;
  settings: AppSettings;
  activeMode?: string;
  onSelectMode: (mode: string) => void;
  onOpenSettings: () => void;
  onDisconnect?: () => void;
}

export const TvRemoteView: React.FC<TvRemoteViewProps> = ({
  bridge,
  settings: _settings,
  onSelectMode,
  onOpenSettings,
}) => {
  const [selectedTvDevice, setSelectedTvDevice] = useState<TargetDeviceTypeValue>(
    TargetDeviceType.ANDROID_GOOGLE_TV
  );
  const [activeDeviceLabel, setActiveDeviceLabel] = useState<string>('Buscando Smart TV...');
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showNumpadModal, setShowNumpadModal] = useState(false);
  const [inputText, setInputText] = useState('');
  const [lastActionFeedback, setLastActionFeedback] = useState<string>('Controle Pronto');
  const [activePressedBtn, setActivePressedBtn] = useState<string | null>(null);

  // Authoritative Single-Dispatch Service
  const commandService = useMemo(() => new TvCommandService(bridge), [bridge]);

  useEffect(() => {
    commandService.setBridge(bridge);
  }, [bridge, commandService]);

  // Load initial device label from host
  useEffect(() => {
    const fetchCurrentTarget = async () => {
      try {
        const endpoint = HostConnectionManager.getHttpEndpoint('/api/v1/tv/devices');
        const res = await fetch(endpoint);
        if (res.ok) {
          const json = await res.json();
          if (json.selected_device) {
            setActiveDeviceLabel(`${json.selected_device.name} (${json.selected_device.ip})`);
            setSelectedTvDevice(json.selected_device.protocol);
          } else if (json.devices && json.devices.length > 0) {
            const first = json.devices[0];
            setActiveDeviceLabel(`${first.name} (${first.ip})`);
            setSelectedTvDevice(first.protocol);
          } else {
            setActiveDeviceLabel('Smart TV (Genérica)');
          }
        }
      } catch {
        setActiveDeviceLabel('Smart TV Local');
      }
    };
    fetchCurrentTarget();
  }, []);

  // Send TV command with single authoritative dispatch
  const sendTvCmd = (cmd: TvCommandValue, label: string) => {
    haptics.buttonClick();
    setLastActionFeedback(`Enviado: ${label}`);
    setActivePressedBtn(label);
    setTimeout(() => setActivePressedBtn(null), 180);

    commandService.sendCommand(cmd, selectedTvDevice);
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    haptics.heavyClick();
    setLastActionFeedback(`Buscando: "${text}"`);
    commandService.sendTextInput(text);
    setInputText('');
  };

  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      haptics.buttonClick();
      setLastActionFeedback('Ouvindo voz...');

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          setLastActionFeedback(`Voz: "${transcript}"`);
          commandService.sendTextInput(transcript);
          haptics.heavyClick();
        }
      };

      recognition.onerror = () => setLastActionFeedback('Erro na voz');
      recognition.start();
    } catch (err) {
      console.warn('Speech error:', err);
    }
  };

  const handleDeviceSelected = (device: DiscoveredTvDevice) => {
    setSelectedTvDevice(device.protocol);
    setActiveDeviceLabel(`${device.name} (${device.ip})`);
    setLastActionFeedback(`TV: ${device.brand}`);
    try {
      const endpoint = HostConnectionManager.getHttpEndpoint('/api/v1/tv/select');
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: device.id }),
      }).catch(() => {});
    } catch {}
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100dvh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 14px 14px 14px',
        backgroundColor: '#070a0f',
        color: '#ffffff',
        overflow: 'hidden',
        touchAction: 'manipulation',
        userSelect: 'none',
      }}
    >
      <TargetSelector
        isOpen={showTargetModal}
        selectedProtocol={selectedTvDevice}
        onSelectDevice={handleDeviceSelected}
        onClose={() => setShowTargetModal(false)}
      />

      {/* 1. TOP HEADER & FEEDBACK Visor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          {/* TV Target Pill with Retro LED */}
          <button
            type="button"
            onClick={() => setShowTargetModal(true)}
            className="neo-raised"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              color: 'var(--color-neon-green)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              cursor: 'pointer',
              maxWidth: '170px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              border: '1px solid rgba(0, 245, 155, 0.4)',
            }}
          >
            <span
              className="retro-led animate-pulse-glow"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-neon-green)',
                boxShadow: '0 0 8px var(--color-neon-green)',
                flexShrink: 0,
              }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeDeviceLabel}</span>
          </button>

          {/* Action Feedback Badge (7-Segment style readout) */}
          <div
            className="neo-sunken"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '10px',
              color: 'var(--color-neon-cyan)',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              maxWidth: '160px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              textShadow: '0 0 8px rgba(0, 229, 255, 0.6)',
            }}
          >
            <CheckCircle2 size={13} />
            <span>{lastActionFeedback}</span>
          </div>

          {/* Controls: Power, Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setIsPowerOn(!isPowerOn);
                sendTvCmd(TvCommand.POWER, 'Power');
              }}
              className="lookaremote-btn retro-btn"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: isPowerOn
                  ? 'linear-gradient(180deg, #ff3366 0%, #d90429 60%, #850015 100%)'
                  : 'linear-gradient(180deg, #222d42 0%, #171f2e 100%)',
                border: `1.5px solid ${isPowerOn ? '#ff3366' : 'rgba(255, 255, 255, 0.15)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isPowerOn ? '#ffffff' : 'var(--color-text-muted)',
                cursor: 'pointer',
                boxShadow: isPowerOn
                  ? 'var(--neo-shadow-button-red)'
                  : 'var(--neo-shadow-button-slate)',
              }}
              aria-label="Power"
            >
              <Power size={18} />
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="lookaremote-btn retro-btn"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(180deg, #222d42 0%, #171f2e 100%)',
                border: '1.5px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                boxShadow: 'var(--neo-shadow-button-slate)',
              }}
            >
              <Settings size={17} />
            </button>
          </div>
        </div>

        {/* 3D Mode Selector: TV / PC / CONSOLE */}
        <div
          className="neo-sunken"
          style={{
            display: 'flex',
            gap: '6px',
            padding: '4px',
            borderRadius: '12px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              haptics.buttonClick();
              setSelectedTvDevice(TargetDeviceType.ANDROID_GOOGLE_TV);
            }}
            className="lookaremote-btn retro-btn"
            style={{
              flex: 1.2,
              padding: '8px 6px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #007791 100%)',
              border: '1px solid #00f0ff',
              color: '#040d1a',
              fontFamily: 'var(--font-display)',
              fontSize: '0.8rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: 'var(--neo-shadow-button-cyan)',
            }}
          >
            <Tv size={15} />
            <span>SMART TV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('trackpad');
            }}
            className="lookaremote-btn retro-btn"
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #222d42 0%, #171f2e 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: '0.8rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: 'var(--neo-shadow-button-slate)',
            }}
          >
            <Monitor size={15} />
            <span>PC / MAC</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('gamepad');
            }}
            className="lookaremote-btn retro-btn"
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #222d42 0%, #171f2e 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: '0.8rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: 'var(--neo-shadow-button-slate)',
            }}
          >
            <Gamepad2 size={15} />
            <span>CONSOLE</span>
          </button>
        </div>
      </div>

      {/* 2. TEXT SEARCH BAR with 3D inset styling */}
      <form
        onSubmit={handleSendText}
        className="neo-sunken"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px 6px 14px',
          borderRadius: '24px',
          border: '1.5px solid rgba(0, 229, 255, 0.4)',
          flexShrink: 0,
        }}
      >
        <Search size={16} color="var(--color-neon-cyan)" />
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Digitar ou Pesquisar na TV..."
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
          }}
        />
        <button
          type="button"
          onClick={handleVoiceInput}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            touchAction: 'manipulation',
          }}
        >
          <Mic size={18} />
        </button>
        <button
          type="submit"
          className="lookaremote-btn retro-btn"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(180deg, #00f0ff 0%, #008ba3 100%)',
            border: '1px solid #00f0ff',
            color: '#040d1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--neo-shadow-button-cyan)',
          }}
        >
          <Send size={14} />
        </button>
      </form>

      {/* 3. PHYSICAL REMOTE CORE (VOL ROCKER + 5-WAY CIRCULAR DPAD + CH ROCKER) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flex: 1,
          maxHeight: '260px',
          margin: '4px 0',
        }}
      >
        {/* LEFT: 3D VOLUME ROCKER SWITCH */}
        <div
          className="neo-raised"
          style={{
            width: '68px',
            height: '100%',
            borderRadius: '26px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px',
            boxShadow: 'var(--neo-shadow-raised-lg)',
            border: '1.5px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* VOL + */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.VOLUME_UP, 'Volume +')}
            className="lookaremote-btn retro-btn"
            style={{
              width: '100%',
              flex: 1,
              borderRadius: '20px 20px 6px 6px',
              background: activePressedBtn === 'Volume +'
                ? 'linear-gradient(180deg, #008ba3 0%, #00e5ff 100%)'
                : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--color-neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activePressedBtn === 'Volume +'
                ? 'inset 0 3px 6px rgba(0,0,0,0.8)'
                : '0 3px 0 #07090f, 0 4px 8px rgba(0,0,0,0.6)',
            }}
          >
            <ChevronUp size={30} />
          </button>

          {/* MUTE PIVOT BUTTON */}
          <button
            type="button"
            onClick={() => {
              setIsMuted(!isMuted);
              sendTvCmd(TvCommand.MUTE, isMuted ? 'Desmudo' : 'Mudo');
            }}
            className="lookaremote-btn retro-btn"
            style={{
              width: '90%',
              padding: '6px 4px',
              margin: '6px 0',
              borderRadius: '10px',
              background: isMuted
                ? 'linear-gradient(180deg, #ff2a55 0%, #9e0c29 100%)'
                : 'linear-gradient(180deg, #182232 0%, #0f1624 100%)',
              border: `1px solid ${isMuted ? '#ff2a55' : 'rgba(255, 255, 255, 0.1)'}`,
              color: isMuted ? '#ffffff' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              fontWeight: 800,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              boxShadow: isMuted ? '0 0 10px rgba(255, 42, 85, 0.5)' : 'inset 0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>VOL</span>
          </button>

          {/* VOL - */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.VOLUME_DOWN, 'Volume -')}
            className="lookaremote-btn retro-btn"
            style={{
              width: '100%',
              flex: 1,
              borderRadius: '6px 6px 20px 20px',
              background: activePressedBtn === 'Volume -'
                ? 'linear-gradient(180deg, #008ba3 0%, #00e5ff 100%)'
                : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--color-neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activePressedBtn === 'Volume -'
                ? 'inset 0 3px 6px rgba(0,0,0,0.8)'
                : '0 3px 0 #07090f, 0 4px 8px rgba(0,0,0,0.6)',
            }}
          >
            <ChevronDown size={30} />
          </button>
        </div>

        {/* CENTER: 3D 5-WAY CIRCULAR DPAD DISH */}
        <div
          className="neo-raised-lg"
          style={{
            position: 'relative',
            width: '175px',
            height: '175px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #182233 0%, #0d131f 100%)',
            border: '2px solid rgba(0, 229, 255, 0.35)',
            boxShadow: 'var(--neo-shadow-raised-lg), inset 0 0 20px rgba(0, 229, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* UP */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.DPAD_UP, 'Cima ▲')}
            className="lookaremote-btn retro-btn"
            style={{
              position: 'absolute',
              top: '6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '58px',
              height: '44px',
              background: activePressedBtn === 'Cima ▲' ? 'rgba(0, 229, 255, 0.3)' : 'transparent',
              borderRadius: '14px 14px 0 0',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-neon-cyan)',
            }}
          >
            <ChevronUp size={32} />
          </button>

          {/* DOWN */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.DPAD_DOWN, 'Baixo ▼')}
            className="lookaremote-btn retro-btn"
            style={{
              position: 'absolute',
              bottom: '6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '58px',
              height: '44px',
              background: activePressedBtn === 'Baixo ▼' ? 'rgba(0, 229, 255, 0.3)' : 'transparent',
              borderRadius: '0 0 14px 14px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-neon-cyan)',
            }}
          >
            <ChevronDown size={32} />
          </button>

          {/* LEFT */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.DPAD_LEFT, 'Esquerda ◀')}
            className="lookaremote-btn retro-btn"
            style={{
              position: 'absolute',
              left: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '44px',
              height: '58px',
              background: activePressedBtn === 'Esquerda ◀' ? 'rgba(0, 229, 255, 0.3)' : 'transparent',
              borderRadius: '14px 0 0 14px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-neon-cyan)',
            }}
          >
            <ChevronLeft size={32} />
          </button>

          {/* RIGHT */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.DPAD_RIGHT, 'Direita ▶')}
            className="lookaremote-btn retro-btn"
            style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '44px',
              height: '58px',
              background: activePressedBtn === 'Direita ▶' ? 'rgba(0, 229, 255, 0.3)' : 'transparent',
              borderRadius: '0 14px 14px 0',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-neon-cyan)',
            }}
          >
            <ChevronRight size={32} />
          </button>

          {/* 3D METALLIC CENTER OK BUTTON */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.OK_ENTER, 'OK / Enter')}
            className="lookaremote-btn retro-btn"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: activePressedBtn === 'OK / Enter'
                ? 'linear-gradient(180deg, #008ba3 0%, #00e5ff 100%)'
                : 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #007791 100%)',
              border: '2px solid #00f0ff',
              color: '#040d1a',
              fontFamily: 'var(--font-display)',
              fontSize: '1.1rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activePressedBtn === 'OK / Enter'
                ? 'var(--neo-shadow-button-cyan-pressed)'
                : 'var(--neo-shadow-button-cyan)',
            }}
          >
            OK
          </button>
        </div>

        {/* RIGHT: 3D CHANNEL ROCKER SWITCH */}
        <div
          className="neo-raised"
          style={{
            width: '68px',
            height: '100%',
            borderRadius: '26px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px',
            boxShadow: 'var(--neo-shadow-raised-lg)',
            border: '1.5px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* CH + */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.CHANNEL_UP, 'Canal +')}
            className="lookaremote-btn retro-btn"
            style={{
              width: '100%',
              flex: 1,
              borderRadius: '20px 20px 6px 6px',
              background: activePressedBtn === 'Canal +'
                ? 'linear-gradient(180deg, #008ba3 0%, #00e5ff 100%)'
                : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--color-neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activePressedBtn === 'Canal +'
                ? 'inset 0 3px 6px rgba(0,0,0,0.8)'
                : '0 3px 0 #07090f, 0 4px 8px rgba(0,0,0,0.6)',
            }}
          >
            <ChevronUp size={30} />
          </button>

          {/* CH GUIDE PIVOT BUTTON */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.INFO, 'Guia/Info')}
            className="lookaremote-btn retro-btn"
            style={{
              width: '90%',
              padding: '6px 4px',
              margin: '6px 0',
              borderRadius: '10px',
              background: 'linear-gradient(180deg, #182232 0%, #0f1624 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              fontWeight: 800,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            <Radio size={16} />
            <span>CH</span>
          </button>

          {/* CH - */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.CHANNEL_DOWN, 'Canal -')}
            className="lookaremote-btn retro-btn"
            style={{
              width: '100%',
              flex: 1,
              borderRadius: '6px 6px 20px 20px',
              background: activePressedBtn === 'Canal -'
                ? 'linear-gradient(180deg, #008ba3 0%, #00e5ff 100%)'
                : 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--color-neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activePressedBtn === 'Canal -'
                ? 'inset 0 3px 6px rgba(0,0,0,0.8)'
                : '0 3px 0 #07090f, 0 4px 8px rgba(0,0,0,0.6)',
            }}
          >
            <ChevronDown size={30} />
          </button>
        </div>
      </div>

      {/* 4. NAVIGATION ROW: VOLTAR, HOME, 123 NUMPAD */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => sendTvCmd(TvCommand.BACK, 'Voltar')}
          className="lookaremote-btn retro-btn"
          style={{
            flex: 1,
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(180deg, #222d42 0%, #171f2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            fontFamily: 'var(--font-display)',
            fontSize: '0.8rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          <RotateCcw size={16} />
          VOLTAR
        </button>

        <button
          type="button"
          onClick={() => sendTvCmd(TvCommand.HOME, 'Home')}
          className="lookaremote-btn retro-btn"
          style={{
            flex: 1.2,
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #007791 100%)',
            border: '1px solid #00f0ff',
            color: '#040d1a',
            fontFamily: 'var(--font-display)',
            fontSize: '0.85rem',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: 'var(--neo-shadow-button-cyan)',
          }}
        >
          <Home size={18} />
          HOME
        </button>

        <button
          type="button"
          onClick={() => {
            haptics.buttonClick();
            setShowNumpadModal(true);
          }}
          className="lookaremote-btn retro-btn"
          style={{
            flex: 1,
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(180deg, #222d42 0%, #171f2e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            fontFamily: 'var(--font-display)',
            fontSize: '0.8rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: 'var(--neo-shadow-button-slate)',
          }}
        >
          <Hash size={16} />
          123 NUM
        </button>
      </div>

      {/* 5. STREAMING APPS + AIR MOUSE SHORTCUT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {[
            { name: 'Netflix', color: '#ff2a55', bg: 'linear-gradient(180deg, #e50914 0%, #8a060d 100%)', cmd: TvCommand.APP_NETFLIX },
            { name: 'YouTube', color: '#ff0000', bg: 'linear-gradient(180deg, #ff3333 0%, #b30000 100%)', cmd: TvCommand.APP_YOUTUBE },
            { name: 'Prime', color: '#00a8e1', bg: 'linear-gradient(180deg, #00b4d8 0%, #0077b6 100%)', cmd: TvCommand.APP_PRIME },
            { name: 'Disney+', color: '#113ccf', bg: 'linear-gradient(180deg, #3a68ff 0%, #113ccf 100%)', cmd: TvCommand.APP_DISNEY },
          ].map((app) => (
            <button
              key={app.name}
              type="button"
              onClick={() => sendTvCmd(app.cmd, app.name)}
              className="lookaremote-btn retro-btn"
              style={{
                height: '34px',
                borderRadius: '8px',
                background: app.bg,
                border: `1px solid ${app.color}`,
                color: '#ffffff',
                fontFamily: 'var(--font-display)',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: `0 3px 0 #05080e, 0 4px 8px rgba(0,0,0,0.6)`,
              }}
            >
              {app.name}
            </button>
          ))}
        </div>

        {/* 3D AIR MOUSE HOT BUTTON */}
        <button
          type="button"
          onClick={() => {
            haptics.buttonClick();
            onSelectMode('airmouse');
          }}
          className="lookaremote-btn retro-btn"
          style={{
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(180deg, #ff007f 0%, #b30059 100%)',
            border: '1.5px solid #ff007f',
            color: '#ffffff',
            fontFamily: 'var(--font-display)',
            fontSize: '0.85rem',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 0 #660033, 0 6px 16px rgba(255, 0, 127, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.4)',
          }}
        >
          <Sparkles size={17} />
          <span>ATIVAR AIR MOUSE (GIROSCÓPIO 120HZ)</span>
        </button>
      </div>

      {/* 6. 3D NUMPAD MODAL POPUP */}
      {showNumpadModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(2, 4, 8, 0.9)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 100,
          }}
        >
          <div
            className="neo-raised-lg"
            style={{
              width: '100%',
              maxWidth: '320px',
              borderRadius: '20px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="retro-embossed-text" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-neon-cyan)' }}>
                TECLADO NUMÉRICO DE CANAIS
              </span>
              <button
                type="button"
                onClick={() => setShowNumpadModal(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', touchAction: 'manipulation' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { label: '1', cmd: TvCommand.DIGIT_1 },
                { label: '2', cmd: TvCommand.DIGIT_2 },
                { label: '3', cmd: TvCommand.DIGIT_3 },
                { label: '4', cmd: TvCommand.DIGIT_4 },
                { label: '5', cmd: TvCommand.DIGIT_5 },
                { label: '6', cmd: TvCommand.DIGIT_6 },
                { label: '7', cmd: TvCommand.DIGIT_7 },
                { label: '8', cmd: TvCommand.DIGIT_8 },
                { label: '9', cmd: TvCommand.DIGIT_9 },
                { label: 'PREV', cmd: TvCommand.PREV_CHANNEL },
                { label: '0', cmd: TvCommand.DIGIT_0 },
                { label: 'INFO', cmd: TvCommand.INFO },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => sendTvCmd(btn.cmd, btn.label)}
                  className="lookaremote-btn retro-btn"
                  style={{
                    height: '50px',
                    borderRadius: '12px',
                    background: 'linear-gradient(180deg, #222d42 0%, #161e2e 100%)',
                    border: '1.5px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    boxShadow: 'var(--neo-shadow-button-slate)',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowNumpadModal(false)}
              className="lookaremote-btn retro-btn"
              style={{
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(180deg, #182232 0%, #0f1624 100%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-display)',
                fontSize: '0.85rem',
                fontWeight: 800,
                boxShadow: 'var(--neo-shadow-button-slate)',
              }}
            >
              FECHAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
