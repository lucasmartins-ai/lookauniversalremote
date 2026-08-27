import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Camera, RefreshCw, Zap, ZapOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../ui/components/Button';
import { haptics } from '../../ui/haptics/hapticEngine';

export interface QrScannerViewProps {
  onScan: (decodedText: string) => void;
  onError?: (err: Error) => void;
}

export const QrScannerView: React.FC<QrScannerViewProps> = ({ onScan, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const isScanningRef = useRef(false);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Initialize Code Reader
  useEffect(() => {
    codeReaderRef.current = new BrowserQRCodeReader();

    // Enumerate video devices
    BrowserQRCodeReader.listVideoInputDevices()
      .then((videoDevices) => {
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          // Prefer back / environment camera
          const backCam = videoDevices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          setSelectedDeviceId(backCam ? backCam.deviceId : videoDevices[0]!.deviceId);
        }
      })
      .catch((err) => {
        console.warn('Failed to enumerate cameras:', err);
      });

    return () => {
      stopScanning();
    };
  }, []);

  const stopScanning = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // Ignored
      }
      controlsRef.current = null;
    }
  }, []);

  // Start Scanner on device change
  const startScanning = useCallback(
    async (deviceId: string) => {
      stopScanning();
      setErrorMsg(null);
      isScanningRef.current = false;
      setIsSuccess(false);

      if (!videoRef.current || !codeReaderRef.current) return;

      try {
        const controls = await codeReaderRef.current.decodeFromVideoDevice(
          deviceId || undefined,
          videoRef.current,
          (result, error) => {
            if (result && !isScanningRef.current) {
              const text = result.getText();
              if (text && text.trim().length > 0) {
                isScanningRef.current = true;
                setIsSuccess(true);
                haptics.pairSuccess();
                onScan(text.trim());

                setTimeout(() => {
                  isScanningRef.current = false;
                  setIsSuccess(false);
                }, 3500);
              }
            }
            if (error && error.name !== 'NotFoundException') {
              // Ignore non-fatal frame scanning errors
            }
          }
        );

        controlsRef.current = controls;
        setHasPermission(true);

        // Check torch capabilities
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          const track = stream.getVideoTracks()[0];
          if (track) {
            const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
            setHasTorch(Boolean(capabilities.torch));
          }
        }
      } catch (err: any) {
        console.error('Error starting video stream:', err);
        setHasPermission(false);
        setErrorMsg(err.message || 'Falha ao acessar a câmera. Verifique as permissões.');
        onError?.(err);
      }
    },
    [onScan, onError, stopScanning]
  );

  useEffect(() => {
    if (selectedDeviceId) {
      startScanning(selectedDeviceId);
    } else {
      startScanning('');
    }
    return () => stopScanning();
  }, [selectedDeviceId, startScanning, stopScanning]);

  // Toggle Camera
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

  // Toggle Torch
  const handleToggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    haptics.buttonClick();
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
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
          marginTop: '20px',
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
            fontSize: '0.85rem',
            color: isSuccess ? 'var(--color-neon-green)' : 'var(--color-neon-cyan)',
            fontWeight: isSuccess ? 800 : 600,
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {isSuccess ? (
            <>
              <CheckCircle2 size={16} /> QR CODE DETECTADO! CONECTANDO...
            </>
          ) : (
            'APONTE PARA O QR CODE DO COMPUTADOR'
          )}
        </p>
      </div>

      {/* Control Bar (Torch / Flip Camera) */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {hasTorch && (
          <Button
            variant="secondary"
            size="md"
            onClick={handleToggleTorch}
            aria-label="Toggle Flashlight"
            style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0 }}
          >
            {torchOn ? <Zap size={20} color="var(--color-neon-amber)" /> : <ZapOff size={20} />}
          </Button>
        )}

        {devices.length > 1 && (
          <Button
            variant="secondary"
            size="md"
            onClick={handleSwitchCamera}
            aria-label="Switch Camera"
            style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0 }}
          >
            <Camera size={20} color="var(--color-neon-cyan)" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => startScanning(selectedDeviceId)}
          leftIcon={<RefreshCw size={16} />}
        >
          RETRY
        </Button>
      </div>

      {/* Camera Permission / Error Warning */}
      {errorMsg && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            right: '20px',
            zIndex: 30,
            padding: '12px 16px',
            backgroundColor: 'rgba(255, 23, 68, 0.15)',
            border: '1px solid var(--color-neon-red)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--color-neon-red)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <AlertCircle size={20} />
          <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
