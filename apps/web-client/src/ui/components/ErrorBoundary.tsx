import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LookARemote ErrorBoundary caught unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            width: '100%',
            height: '100dvh',
            backgroundColor: '#070a0f',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            boxSizing: 'border-box',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Cyber background overlay */}
          <div className="cyber-grid-bg" />

          <div
            className="neo-raised-lg"
            style={{
              width: '100%',
              maxWidth: '400px',
              borderRadius: '24px',
              padding: '28px 22px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '16px',
              zIndex: 10,
              border: '1.5px solid rgba(255, 42, 85, 0.4)',
              boxShadow: '0 0 40px rgba(255, 42, 85, 0.2)',
            }}
          >
            {/* 3D Glowing Alert Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(180deg, #ff2a55 0%, #a00726 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(255, 42, 85, 0.6), inset 0 2px 4px rgba(255,255,255,0.4)',
              }}
            >
              <AlertOctagon size={32} color="#ffffff" />
            </div>

            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  margin: '0 0 6px 0',
                  color: '#ffffff',
                }}
              >
                FALHA NO CONTROLADOR
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.4,
                }}
              >
                Ocorreu uma instabilidade na interface ou renderização do controle.
              </p>
            </div>

            {/* Error snippet box */}
            {this.state.error && (
              <div
                className="neo-sunken"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  border: '1px solid rgba(255, 42, 85, 0.3)',
                  color: 'var(--color-neon-red)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  textAlign: 'left',
                  wordBreak: 'break-all',
                  maxHeight: '90px',
                  overflowY: 'auto',
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            {/* Recovery Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '6px' }}>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={this.handleReset}
                leftIcon={<RotateCcw size={16} />}
              >
                RESTAURAR CONTROLE
              </Button>
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={this.handleReload}
                leftIcon={<RefreshCw size={14} />}
              >
                RECARREGAR PÁGINA
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
