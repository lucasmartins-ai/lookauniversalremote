import React, { useState, useEffect, useRef } from 'react';
import { Compass, CheckCircle2, Play, RefreshCw, XCircle } from 'lucide-react';
import { Modal } from '../../ui/components/Modal';
import { Button } from '../../ui/components/Button';
import { haptics } from '../../ui/haptics/hapticEngine';
import { BiasCalibrator, GyroBias } from '../../sensors/BiasCalibrator';
import { ImuSensorPipeline } from '../../sensors/ImuSensorPipeline';

export interface GyroCalibrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  calibrator: BiasCalibrator;
  pipeline: ImuSensorPipeline;
}

type Step = 'intro' | 'calibrating' | 'success' | 'error';

export const GyroCalibrateModal: React.FC<GyroCalibrateModalProps> = ({
  isOpen,
  onClose,
  calibrator,
  pipeline,
}) => {
  const [step, setStep] = useState<Step>('intro');
  const [progress, setProgress] = useState(0);
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [calibratedBias, setCalibratedBias] = useState<GyroBias | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setProgress(0);
      setNoiseLevel(0);
      setErrorMessage('');
      setCalibratedBias(calibrator.getBias());
    } else {
      calibrator.cancelCalibration();
    }
  }, [isOpen, calibrator]);

  const handleStartCalibration = async () => {
    haptics.buttonClick();
    setStep('calibrating');
    setProgress(0);
    setNoiseLevel(0);

    try {
      // Ensure pipeline is permitted & started
      await pipeline.requestPermission();
      pipeline.start();

      const result = await calibrator.startCalibration(
        pipeline,
        120,
        (pct, noise) => {
          if (isMountedRef.current) {
            setProgress(pct);
            setNoiseLevel(noise);
          }
        }
      );

      if (isMountedRef.current) {
        setCalibratedBias(result.bias);
        setStep('success');
        haptics.doublePulse();
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setErrorMessage(err?.message || 'Calibration failed. Please try again.');
        setStep('error');
        haptics.heavyClick();
      }
    }
  };

  const handleCancel = () => {
    calibrator.cancelCalibration();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Gyroscope Bias Calibration"
      footer={
        <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
          {step === 'intro' && (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                CANCEL
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Play size={14} />}
                onClick={handleStartCalibration}
              >
                START CALIBRATION
              </Button>
            </>
          )}

          {step === 'calibrating' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                calibrator.cancelCalibration();
                setStep('intro');
              }}
            >
              ABORT
            </Button>
          )}

          {step === 'success' && (
            <Button variant="primary" size="sm" onClick={onClose}>
              DONE
            </Button>
          )}

          {step === 'error' && (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                CLOSE
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                onClick={handleStartCalibration}
              >
                RETRY
              </Button>
            </>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
        {/* Step: Intro */}
        {step === 'intro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid var(--color-neon-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(0, 240, 255, 0.2)',
              }}
            >
              <Compass size={32} color="var(--color-neon-cyan)" />
            </div>

            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              Zero-Rate Drift Auto-Calibration
            </div>

            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5,
                backgroundColor: 'var(--color-surface-card)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border-subtle)',
                textAlign: 'left',
              }}
            >
              1. Place your phone <strong>flat on a table or stable surface</strong>.<br />
              2. Keep your hands completely off the phone.<br />
              3. Press <strong>Start Calibration</strong> and wait ~1.5 seconds.
            </div>

            {calibrator.isCalibrated() && calibratedBias && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  fontFamily: 'var(--font-mono)',
                  alignSelf: 'flex-start',
                }}
              >
                Current Bias: Yaw={calibratedBias.biasYaw.toFixed(4)} rad/s, Pitch={calibratedBias.biasPitch.toFixed(4)} rad/s, Roll={calibratedBias.biasRoll.toFixed(4)} rad/s
              </div>
            )}
          </div>
        )}

        {/* Step: Calibrating */}
        {step === 'calibrating' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: '3px solid rgba(0, 240, 255, 0.2)',
                borderTopColor: 'var(--color-neon-cyan)',
                animation: 'spin 1s linear infinite',
              }}
            />

            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-neon-cyan)' }}>
              Calibrating... {progress}%
            </div>

            <div style={{ width: '100%', backgroundColor: 'var(--color-surface-card)', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: 'var(--color-neon-cyan)',
                  transition: 'width 0.1s ease',
                  boxShadow: '0 0 8px var(--color-neon-cyan)',
                }}
              />
            </div>

            {/* Stability meter */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: noiseLevel > 0.05 ? 'var(--color-neon-red)' : 'var(--color-neon-green)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>Stability Meter</span>
              <span>{noiseLevel > 0.05 ? '⚠️ Movement Detected!' : '🟢 Stable'}</span>
            </div>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 255, 159, 0.1)',
                border: '1px solid var(--color-neon-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(0, 255, 159, 0.2)',
              }}
            >
              <CheckCircle2 size={32} color="var(--color-neon-green)" />
            </div>

            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-neon-green)' }}>
              Calibration Successful!
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Static gyro bias offsets have been calculated and saved to your device.
            </div>

            {calibratedBias && (
              <div
                style={{
                  width: '100%',
                  backgroundColor: 'var(--color-surface-card)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border-subtle)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div>Yaw Bias: <strong>{(calibratedBias.biasYaw * 1000).toFixed(2)} mrad/s</strong></div>
                <div>Pitch Bias: <strong>{(calibratedBias.biasPitch * 1000).toFixed(2)} mrad/s</strong></div>
                <div>Roll Bias: <strong>{(calibratedBias.biasRoll * 1000).toFixed(2)} mrad/s</strong></div>
              </div>
            )}
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 0, 85, 0.1)',
                border: '1px solid var(--color-neon-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(255, 0, 85, 0.2)',
              }}
            >
              <XCircle size={32} color="var(--color-neon-red)" />
            </div>

            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-neon-red)' }}>
              Calibration Failed
            </div>

            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-text-secondary)',
                backgroundColor: 'rgba(255, 0, 85, 0.05)',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 0, 85, 0.2)',
              }}
            >
              {errorMessage}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
