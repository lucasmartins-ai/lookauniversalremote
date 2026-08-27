import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Camera, RefreshCw, Zap, ZapOff, AlertCircle, CheckCircle2, Clipboard, ArrowRight } from 'lucide-react';
import { Button } from '../../ui/components/Button';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface QrScannerViewProps {
  onScan: (decodedText: string) => void;
  onError?: (err: Error) => void;
  onSwitchToManual?: () => void;
}

export const QrScannerView: React.FC<QrScannerViewProps> = ({ onScan, onError, onSwitchToManual }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const isSuccessRef = useRef(false);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isMediaSupported, setIsMediaSupported] = useState<boolean>(true);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Handle successful QR detection
  const handleDetectedCode = useCallback(
    (text: string) => {
      if (!text || text.trim().length === 0 || isSuccessRef.current) return;
      const cleanText = text.trim();
      isSuccessRef.current = true;
      setIsSuccess(true);
      haptics.pairSuccess();
      onScan(cleanText);

      setTimeout(() => {
        isSuccessRef.current = false;
        setIsSuccess(false);
      }, 1800);
    },
    [onScan]
  );

  // Stop video stream & detection loop
  const stopScanning = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Native BarcodeDetector + Canvas ZXing Loop
  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video || isSuccessRef.current) {
      animationFrameRef.current = requestAnimationFrame(runDetectionLoop);
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      // 1. Try native ultra-fast BarcodeDetector if available
      const hasNativeBarcodeDetector =
        typeof window !== 'undefined' && 'BarcodeDetector' in window;

      if (hasNativeBarcodeDetector) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          detector
            .detect(video)
            .then((barcodes: any[]) => {
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleDetectedCode(barcodes[0].rawValue);
              }
            })
            .catch(() => {
              // Fallback to ZXing canvas reader on next tick
            });
        } catch {
          // Ignored
        }
      }

      // 2. Fallback ZXing Canvas multi-pass detection (every ~150ms)
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx && codeReaderRef.current && video.videoWidth > 0 && !isSuccessRef.current) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          // Pass 1: Standard Image
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = (codeReaderRef.current as any).decodeBitmap?.(imgData);
          if (result && result.getText()) {
            handleDetectedCode(result.getText());
          }
        } catch {
          // Pass 2: Inverted Contrast for Neon/Dark QR Codes
          try {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - (data[i] ?? 0);         // R
              data[i + 1] = 255 - (data[i + 1] ?? 0); // G
              data[i + 2] = 255 - (data[i + 2] ?? 0); // B
            }
            ctx.putImageData(imgData, 0, 0);
            const resultInverted = (codeReaderRef.current as any).decodeBitmap?.(imgData);
            if (resultInverted && resultInverted.getText()) {
              handleDetectedCode(resultInverted.getText());
            }
          } catch {
            // Frame did not contain a valid QR code yet
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(runDetectionLoop);
  }, [handleDetectedCode]);

  // Start Camera Stream with Environment / Back Camera Priority
  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopScanning();
      setErrorMsg(null);
      isSuccessRef.current = false;
      setIsSuccess(false);

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsMediaSupported(false);
        setHasPermission(false);
        setErrorMsg('Acesso à câmera requer contexto HTTPS ou Localhost no iOS Safari.');
        return;
      }

      setIsMediaSupported(true);

      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
              },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setHasPermission(true);

        // Check torch capabilities
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
          setHasTorch(Boolean(capabilities.torch));
        }

        // Now enumerate devices to populate camera selector with populated labels
        if (navigator?.mediaDevices?.enumerateDevices) {
          const allDevs = await navigator.mediaDevices.enumerateDevices();
          const videoDevs = allDevs.filter((d) => d.kind === 'videoinput');
          setDevices(videoDevs);

          if (!deviceId && videoDevs.length > 0) {
            const currentTrackId = track?.getSettings()?.deviceId;
            if (currentTrackId) {
              setSelectedDeviceId(currentTrackId);
            }
          }
        }

        // Start High-speed Frame Loop
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(runDetectionLoop);
      } catch (err: any) {
        console.error('Failed to initialize camera:', err);
        setHasPermission(false);
        setErrorMsg(err.message || 'Falha ao acessar a câmera. Verifique as permissões.');
        onError?.(err);
      }
    },
    [stopScanning, runDetectionLoop, onError]
  );

  // Initialize Code Reader & Start Camera
  useEffect(() => {
    codeReaderRef.current = new BrowserQRCodeReader();
    startCamera(selectedDeviceId || undefined);

    return () => {
      stopScanning();
    };
  }, [selectedDeviceId, startCamera, stopScanning]);

  // Switch Camera
  const handleSwitchCamera = () => {
    if (devices.length <= 1) return;
    haptics.buttonClick();
    const currentIdx = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIdx = (currentIdx + 1) % devices.length;
    const nextDev = devices[nextIdx];
    if (nextDev) {
      setSelectedDeviceId(nextDev.deviceId);
    }
  };

  // Toggle Torch / Flashlight
  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    haptics.buttonClick();
    const track = streamRef.current.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const newTorch = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: newTorch }],
        });
        setTorchOn(newTorch);
      } catch (e) {
        console.warn('Torch constraint error:', e);
      }
    }
  };

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      haptics.buttonClick();
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 0) {
        handleDetectedCode(text.trim());
      }
    } catch {
      setShowManualInput(true);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        overflow: 'hidden',
      }}
    >
      {/* Video Viewfinder */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: hasPermission ? 1 : 0.2,
        }}
      />

      {/* Cyber Reticle Overlay */}
      <div
        style={{
          position: 'relative',
          width: '260px',
          height: '260px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* Corner Accents */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '32px',
            height: '32px',
            borderTop: isSuccess ? '3px solid var(--color-neon-green)' : '3px solid var(--color-neon-cyan)',
            borderLeft: isSuccess ? '3px solid var(--color-neon-green)' : '3px solid var(--color-neon-cyan)',
            filter: isSuccess ? 'drop-shadow(0 0 8px var(--color-neon-green))' : 'drop-shadow(0 0 6px var(--color-neon-cyan))',
            transition: 'all 0.3s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '32px',
            height: '32px',
            borderTop: isSuccess ? '3px solid var(--color-neon-green)' : '3px solid var(--color-neon-cyan)',
            borderRight: isSuccess ? '3px solid var(--color-neon-green)' : '3px solid var(--color-neon-cyan)',
            filter: isSuccess ? 'drop-shadow(0 0 8px var(--color-neon-green))' : 'drop-shadow(0 0 6px var(--color-neon-cyan))',
            transition: 'all 0.3s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '32px',
            height: '32px',
            borderBottom: isSuccess ? '3px solid var(--color-neon-green)' : '3px solid var(--color-neon-cyan)',
            borderLeft: isSuccess ? '3px solid var(--color-neon-green)' : '3px solid var(--color-neon-cyan)',
            filter: isSuccess ? 'drop-shadow(0 0 8px var(--color-neon-green))' : 'drop-shadow(0 0 6px var(--color-neon-cyan))',
            transition: 'all 0.3s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '32px',
            height: '32px',
            borderBottom: isSuccess ? '3px solid var(--color-neon-green)' : '3px solid var(--color-neon-cyan)',
            borderRight: isSuccess ? '3px solid var(--color-neon-green)' : '3px solid var(--color-neon-cyan)',
            filter: isSuccess ? 'drop-shadow(0 0 8px var(--color-neon-green))' : 'drop-shadow(0 0 6px var(--color-neon-cyan))',
            transition: 'all 0.3s ease',
          }}
        />

        {/* Animated Laser Scanline */}
        {!isSuccess && (
          <div
            className="animate-scanline"
            style={{
              position: 'absolute',
              left: '8px',
              right: '8px',
              top: 0,
              height: '2px',
              backgroundColor: 'var(--color-neon-cyan)',
              boxShadow: '0 0 12px var(--color-neon-cyan), 0 0 20px var(--color-neon-cyan)',
            }}
          />
        )}

        {/* Center Target Dot */}
        <div
          style={{
            width: isSuccess ? '16px' : '6px',
            height: isSuccess ? '16px' : '6px',
            borderRadius: '50%',
            backgroundColor: isSuccess ? 'var(--color-neon-green)' : 'rgba(0, 229, 255, 0.6)',
            boxShadow: isSuccess ? '0 0 12px var(--color-neon-green)' : 'none',
            transition: 'all 0.3s ease',
          }}
        />
      </div>

      {/* Guidance Text / Success Banner */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          marginTop: '16px',
          textAlign: 'center',
          padding: '8px 16px',
          borderRadius: '20px',
          backgroundColor: isSuccess ? 'rgba(0, 255, 102, 0.2)' : 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          border: isSuccess ? '1.5px solid var(--color-neon-green)' : '1px solid var(--color-border-subtle)',
          boxShadow: isSuccess ? '0 0 16px rgba(0, 255, 102, 0.3)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            color: isSuccess ? 'var(--color-neon-green)' : 'var(--color-neon-cyan)',
            fontWeight: isSuccess ? 800 : 600,
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            margin: 0,
          }}
        >
          {isSuccess ? (
            <>
              <CheckCircle2 size={16} /> QR CODE DETECTADO! CONECTANDO...
            </>
          ) : (
            'APONTE A CÂMERA PARA O QR CODE'
          )}
        </p>
      </div>

      {/* Control Bar (Torch / Flip Camera / Paste Link) */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {hasTorch && (
          <Button
            variant="secondary"
            size="md"
            onClick={handleToggleTorch}
            aria-label="Toggle Flashlight"
            style={{ borderRadius: '50%', width: '44px', height: '44px', padding: 0 }}
          >
            {torchOn ? <Zap size={18} color="var(--color-neon-amber)" /> : <ZapOff size={18} />}
          </Button>
        )}

        {devices.length > 1 && (
          <Button
            variant="secondary"
            size="md"
            onClick={handleSwitchCamera}
            aria-label="Switch Camera"
            style={{ borderRadius: '50%', width: '44px', height: '44px', padding: 0 }}
          >
            <Camera size={18} color="var(--color-neon-cyan)" />
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={handlePasteClipboard}
          leftIcon={<Clipboard size={14} />}
          style={{ borderRadius: '20px', fontSize: '0.75rem' }}
        >
          COLAR CÓDIGO
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => startCamera(selectedDeviceId || undefined)}
          leftIcon={<RefreshCw size={14} />}
          style={{ borderRadius: '20px', fontSize: '0.75rem' }}
        >
          RECARREGAR
        </Button>
      </div>

      {/* Camera Permission / Insecure Context / Error Card */}
      {errorMsg && (
        <div
          className="neo-raised"
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            zIndex: 30,
            padding: '14px 16px',
            backgroundColor: 'rgba(12, 18, 28, 0.94)',
            border: '1.5px solid var(--color-neon-amber)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            color: '#ffffff',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 14px rgba(255, 192, 30, 0.25)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertCircle size={18} color="var(--color-neon-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--color-neon-amber)' }}>
                {!isMediaSupported ? 'CÂMERA INDISPONÍVEL (HTTP)' : 'FALHA NA CÂMERA'}
              </span>
              <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', lineHeight: 1.35 }}>
                {errorMsg}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
            {onSwitchToManual && (
              <Button
                variant="primary"
                size="sm"
                onClick={onSwitchToManual}
                style={{ fontSize: '0.74rem', fontWeight: 800 }}
              >
                IR PARA CONEXÃO MANUAL (IP)
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowManualInput(true)}
              style={{ fontSize: '0.74rem' }}
            >
              DIGITAR LINK/TOKEN
            </Button>
          </div>
        </div>
      )}

      {/* Manual Code Input Modal */}
      {showManualInput && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 40,
            backgroundColor: 'rgba(5, 10, 16, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            gap: '16px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, color: 'var(--color-neon-cyan)', fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>
              DIGITE O LINK OU HASH DO QR CODE
            </h4>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="http://192.168.1.x:8765/#h=... ou #h=..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-neon-cyan)',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                rightIcon={<ArrowRight size={14} />}
                onClick={() => {
                  if (manualCode.trim()) {
                    handleDetectedCode(manualCode.trim());
                    setShowManualInput(false);
                  }
                }}
              >
                CONECTAR
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowManualInput(false)}>
                CANCELAR
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
