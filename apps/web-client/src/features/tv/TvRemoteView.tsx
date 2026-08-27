import React, { useState } from 'react';
import { ProtocolBridge } from '../../transport/ProtocolBridge';
import { AppSettings } from '../settings/useSettings';
import { haptics } from '../../ui/haptics/hapticEngine';
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
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showNumpadModal, setShowNumpadModal] = useState(false);
  const [inputText, setInputText] = useState('');
  const [lastActionFeedback, setLastActionFeedback] = useState<string>('Controle Pronto');
  const [activePressedBtn, setActivePressedBtn] = useState<string | null>(null);

  // Send TV command with dual-transport dispatch (WebRTC/WebSocket + HTTP fallback)
  const sendTvCmd = (cmd: TvCommandValue, label: string) => {
    haptics.buttonClick();
    setLastActionFeedback(`Enviado: ${label}`);
    setActivePressedBtn(label);
    setTimeout(() => setActivePressedBtn(null), 200);

    // 1. Send via real-time protocol bridge (DataChannel / WebSocket)
    bridge.sendTvCommand({
      commandCode: cmd,
      targetDevice: selectedTvDevice,
    });

    // 2. Dual-dispatch via direct HTTP API for 100% reliability
    try {
      const host = window.location.hostname || '192.168.1.105';
      fetch(`http://${host}:8765/api/tv-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command_code: cmd,
          target_device: selectedTvDevice,
        }),
      }).catch(() => {});
    } catch {}
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    haptics.heavyClick();
    setLastActionFeedback(`Buscando: "${text}"`);
    bridge.sendTvTextInput(text);

    try {
      const host = window.location.hostname || '192.168.1.105';
      fetch(`http://${host}:8765/api/tv-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_device: selectedTvDevice }),
      }).catch(() => {});
    } catch {}

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
          bridge.sendTvTextInput(transcript);
          haptics.heavyClick();
        }
      };

      recognition.onerror = () => setLastActionFeedback('Erro na voz');
      recognition.start();
    } catch (err) {
      console.warn('Speech error:', err);
    }
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
        padding: '8px 12px 14px 12px',
        backgroundColor: '#04060a',
        color: '#ffffff',
        overflow: 'hidden',
        touchAction: 'manipulation',
        userSelect: 'none',
      }}
    >
      {/* 1. TOP HEADER & ACTIVE FEEDBACK BADGE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* TV Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '16px',
              backgroundColor: 'rgba(0, 255, 102, 0.15)',
              border: '1px solid var(--color-neon-green)',
              color: 'var(--color-neon-green)',
              fontSize: '0.725rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-neon-green)',
                boxShadow: '0 0 8px var(--color-neon-green)',
              }}
            />
            <span>TCL TV (192.168.1.102)</span>
          </div>

          {/* Action Feedback Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
              border: '1px solid var(--color-neon-cyan)',
              color: 'var(--color-neon-cyan)',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              maxWidth: '160px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <CheckCircle2 size={13} />
            <span>{lastActionFeedback}</span>
          </div>

          {/* Controls: Power, Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => {
                setIsPowerOn(!isPowerOn);
                sendTvCmd(TvCommand.POWER, 'Power');
              }}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: isPowerOn ? 'rgba(255, 23, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                border: `1.5px solid ${isPowerOn ? 'var(--color-neon-red)' : 'var(--color-border-subtle)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isPowerOn ? 'var(--color-neon-red)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                touchAction: 'manipulation',
                boxShadow: isPowerOn ? '0 0 10px rgba(255, 23, 68, 0.4)' : 'none',
              }}
              aria-label="Power"
            >
              <Power size={17} />
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Mode Switcher: TV / PC / CONSOLE */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              haptics.buttonClick();
              setSelectedTvDevice(TargetDeviceType.ANDROID_GOOGLE_TV);
            }}
            style={{
              flex: 1.2,
              padding: '6px 4px',
              borderRadius: '7px',
              backgroundColor: 'rgba(0, 229, 255, 0.22)',
              border: '1px solid var(--color-neon-cyan)',
              color: 'var(--color-neon-cyan)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.725rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <Tv size={14} />
            <span>SMART TV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('trackpad');
            }}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '7px',
              backgroundColor: 'transparent',
              border: '1px solid transparent',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.725rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <Monitor size={14} />
            <span>PC / MAC</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.buttonClick();
              onSelectMode('gamepad');
            }}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '7px',
              backgroundColor: 'transparent',
              border: '1px solid transparent',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.725rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <Gamepad2 size={14} />
            <span>CONSOLE</span>
          </button>
        </div>
      </div>

      {/* 2. TEXT SEARCH BAR */}
      <form
        onSubmit={handleSendText}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#0c121d',
          padding: '4px 8px 4px 12px',
          borderRadius: '20px',
          border: '1px solid var(--color-neon-cyan)',
          flexShrink: 0,
        }}
      >
        <Search size={15} color="var(--color-neon-cyan)" />
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
          <Mic size={17} />
        </button>
        <button
          type="submit"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 229, 255, 0.3)',
            border: '1px solid var(--color-neon-cyan)',
            color: 'var(--color-neon-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          <Send size={12} />
        </button>
      </form>

      {/* 3. PHYSICAL REMOTE CORE (VOL ROCKER + 5-WAY DPAD + CH ROCKER) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flex: 1,
          maxHeight: '250px',
          margin: '4px 0',
        }}
      >
        {/* LEFT: VOLUME ROCKER */}
        <div
          style={{
            width: '64px',
            height: '100%',
            borderRadius: '24px',
            backgroundColor: '#0c121c',
            border: '1.5px solid rgba(0, 229, 255, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
          }}
        >
          {/* VOL + */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.VOLUME_UP, 'Volume +')}
            style={{
              width: '100%',
              flex: 1,
              borderRadius: '20px 20px 6px 6px',
              backgroundColor: activePressedBtn === 'Volume +' ? 'rgba(0, 229, 255, 0.4)' : 'transparent',
              border: 'none',
              color: 'var(--color-neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
              fontSize: '1.4rem',
              fontWeight: 800,
            }}
          >
            <ChevronUp size={28} />
          </button>

          {/* MUTE */}
          <button
            type="button"
            onClick={() => {
              setIsMuted(!isMuted);
              sendTvCmd(TvCommand.MUTE, isMuted ? 'Desmudo' : 'Mudo');
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '10px',
              backgroundColor: isMuted ? 'rgba(255, 23, 68, 0.35)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${isMuted ? 'var(--color-neon-red)' : 'transparent'}`,
              color: isMuted ? 'var(--color-neon-red)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              fontWeight: 700,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              touchAction: 'manipulation',
            }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>VOL</span>
          </button>

          {/* VOL - */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.VOLUME_DOWN, 'Volume -')}
            style={{
              width: '100%',
              flex: 1,
              borderRadius: '6px 6px 20px 20px',
              backgroundColor: activePressedBtn === 'Volume -' ? 'rgba(0, 229, 255, 0.4)' : 'transparent',
              border: 'none',
              color: 'var(--color-neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
              fontSize: '1.4rem',
              fontWeight: 800,
            }}
          >
            <ChevronDown size={28} />
          </button>
        </div>

        {/* CENTER: 5-WAY CIRCULAR DPAD */}
        <div
          style={{
            position: 'relative',
            width: '170px',
            height: '170px',
            borderRadius: '50%',
            backgroundColor: '#0c121c',
            border: '2px solid rgba(0, 229, 255, 0.45)',
            boxShadow: '0 8px 25px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,229,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* UP */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.DPAD_UP, 'Cima ▲')}
            style={{
              position: 'absolute',
              top: '4px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '56px',
              height: '42px',
              backgroundColor: activePressedBtn === 'Cima ▲' ? 'rgba(0, 229, 255, 0.3)' : 'transparent',
              borderRadius: '12px 12px 0 0',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <ChevronUp size={30} color="var(--color-neon-cyan)" />
          </button>

          {/* DOWN */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.DPAD_DOWN, 'Baixo ▼')}
            style={{
              position: 'absolute',
              bottom: '4px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '56px',
              height: '42px',
              backgroundColor: activePressedBtn === 'Baixo ▼' ? 'rgba(0, 229, 255, 0.3)' : 'transparent',
              borderRadius: '0 0 12px 12px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <ChevronDown size={30} color="var(--color-neon-cyan)" />
          </button>

          {/* LEFT */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.DPAD_LEFT, 'Esquerda ◀')}
            style={{
              position: 'absolute',
              left: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '42px',
              height: '56px',
              backgroundColor: activePressedBtn === 'Esquerda ◀' ? 'rgba(0, 229, 255, 0.3)' : 'transparent',
              borderRadius: '12px 0 0 12px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <ChevronLeft size={30} color="var(--color-neon-cyan)" />
          </button>

          {/* RIGHT */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.DPAD_RIGHT, 'Direita ▶')}
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '42px',
              height: '56px',
              backgroundColor: activePressedBtn === 'Direita ▶' ? 'rgba(0, 229, 255, 0.3)' : 'transparent',
              borderRadius: '0 12px 12px 0',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <ChevronRight size={30} color="var(--color-neon-cyan)" />
          </button>

          {/* CENTER OK BUTTON */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.OK_ENTER, 'OK / Enter')}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: activePressedBtn === 'OK / Enter' ? 'var(--color-neon-cyan)' : 'rgba(0, 229, 255, 0.25)',
              border: '2.5px solid var(--color-neon-cyan)',
              color: activePressedBtn === 'OK / Enter' ? '#000000' : '#ffffff',
              fontFamily: 'var(--font-mono)',
              fontSize: '1rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 16px var(--color-neon-cyan-glow)',
              touchAction: 'manipulation',
              transition: 'all 0.1s ease',
            }}
          >
            OK
          </button>
        </div>

        {/* RIGHT: CHANNEL ROCKER */}
        <div
          style={{
            width: '64px',
            height: '100%',
            borderRadius: '24px',
            backgroundColor: '#0c121c',
            border: '1.5px solid rgba(0, 229, 255, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
          }}
        >
          {/* CH + */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.CHANNEL_UP, 'Canal +')}
            style={{
              width: '100%',
              flex: 1,
              borderRadius: '20px 20px 6px 6px',
              backgroundColor: activePressedBtn === 'Canal +' ? 'rgba(0, 229, 255, 0.4)' : 'transparent',
              border: 'none',
              color: 'var(--color-neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
              fontSize: '1.4rem',
              fontWeight: 800,
            }}
          >
            <ChevronUp size={28} />
          </button>

          {/* CH GUIDE */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.INFO, 'Guia/Info')}
            style={{
              padding: '6px 8px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              fontWeight: 700,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              touchAction: 'manipulation',
            }}
          >
            <Radio size={16} />
            <span>CH</span>
          </button>

          {/* CH - */}
          <button
            type="button"
            onClick={() => sendTvCmd(TvCommand.CHANNEL_DOWN, 'Canal -')}
            style={{
              width: '100%',
              flex: 1,
              borderRadius: '6px 6px 20px 20px',
              backgroundColor: activePressedBtn === 'Canal -' ? 'rgba(0, 229, 255, 0.4)' : 'transparent',
              border: 'none',
              color: 'var(--color-neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
              fontSize: '1.4rem',
              fontWeight: 800,
            }}
          >
            <ChevronDown size={28} />
          </button>
        </div>
      </div>

      {/* 4. NAVIGATION ROW: VOLTAR, HOME, 123 NUMPAD */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => sendTvCmd(TvCommand.BACK, 'Voltar')}
          style={{
            flex: 1,
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#ffffff',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          <RotateCcw size={15} />
          VOLTAR
        </button>

        <button
          type="button"
          onClick={() => sendTvCmd(TvCommand.HOME, 'Home')}
          style={{
            flex: 1.2,
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(0, 229, 255, 0.2)',
            border: '1.5px solid var(--color-neon-cyan)',
            color: 'var(--color-neon-cyan)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            touchAction: 'manipulation',
            boxShadow: '0 0 12px rgba(0, 229, 255, 0.25)',
          }}
        >
          <Home size={17} />
          HOME
        </button>

        <button
          type="button"
          onClick={() => {
            haptics.buttonClick();
            setShowNumpadModal(true);
          }}
          style={{
            flex: 1,
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#ffffff',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          <Hash size={15} />
          123
        </button>
      </div>

      {/* 5. STREAMING APPS + AIR MOUSE BUTTON */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {[
            { name: 'Netflix', color: '#E50914', cmd: TvCommand.APP_NETFLIX },
            { name: 'YouTube', color: '#FF0000', cmd: TvCommand.APP_YOUTUBE },
            { name: 'Prime', color: '#00A8E1', cmd: TvCommand.APP_PRIME },
            { name: 'Disney+', color: '#113CCF', cmd: TvCommand.APP_DISNEY },
          ].map((app) => (
            <button
              key={app.name}
              type="button"
              onClick={() => sendTvCmd(app.cmd, app.name)}
              style={{
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: `1.5px solid ${app.color}`,
                color: '#ffffff',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {app.name}
            </button>
          ))}
        </div>

        {/* Big Air Mouse Button */}
        <button
          type="button"
          onClick={() => {
            haptics.buttonClick();
            onSelectMode('airmouse');
          }}
          style={{
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 0, 127, 0.18)',
            border: '1.5px solid var(--color-neon-pink)',
            color: 'var(--color-neon-pink)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 0 14px rgba(255, 0, 127, 0.3)',
            touchAction: 'manipulation',
          }}
        >
          <Sparkles size={16} />
          <span>ATIVAR AIR MOUSE (GIROSCÓPIO)</span>
        </button>
      </div>

      {/* 6. NUMPAD MODAL POPUP */}
      {showNumpadModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '300px',
              backgroundColor: '#0a0f16',
              borderRadius: '20px',
              border: '1.5px solid var(--color-neon-cyan)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 10px 40px rgba(0, 229, 255, 0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-neon-cyan)' }}>
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
                  style={{
                    height: '48px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowNumpadModal(false)}
              style={{
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                touchAction: 'manipulation',
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
