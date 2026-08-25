import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Card } from '../ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-4">
          <Card className="max-w-lg w-full text-center p-8">
            <h2 className="text-2xl font-display font-bold text-danger mb-2">Terjadi Kesalahan Tampilan</h2>
            <p className="text-sm text-ink-soft mb-6">
              {this.state.error?.message || 'Gagal memuat komponen antarmuka.'}
            </p>
            <Button
              variant="primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Muat Ulang Halaman
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}