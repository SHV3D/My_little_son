import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    if (typeof window === 'undefined') return;
    const win = window as any;
    if (win.caches && typeof win.caches.keys === 'function') {
      win.caches.keys().then((names: string[]) => {
        return Promise.all(names.map((name) => win.caches.delete(name)));
      }).finally(() => {
        win.location.reload();
      });
    } else {
      win.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          data-testid="error-boundary-fallback"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: '#ECEEE6',
            color: '#1E2A20',
            fontFamily: "'Geologica', system-ui, sans-serif",
            textAlign: 'center',
          }}
        >
          <img
            src="/apple-touch-icon.png"
            alt="My little son"
            style={{ width: '96px', height: '96px', borderRadius: '24px', marginBottom: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
          />
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#23372A' }}>
            Что-то пошло не так
          </h2>
          <p style={{ fontSize: '14px', color: '#6A7D70', margin: '0 0 24px 0', maxWidth: '280px' }}>
            Приложение перезагрузится и обновит кэш
          </p>
          <button
            onClick={this.handleReload}
            style={{
              backgroundColor: '#23372A',
              color: '#D4F27A',
              border: 'none',
              borderRadius: '16px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(35, 55, 42, 0.15)',
            }}
          >
            Перезагрузить
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
