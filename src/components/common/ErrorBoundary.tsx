import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '../ui/primitives';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Studify ErrorBoundary] Uncaught runtime exception caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReload = (): void => {
    window.location.reload();
  };

  public handleGoHome = (): void => {
    window.location.href = '/';
  };

  public toggleDetails = (): void => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas p-4 text-ink">
          <div className="w-full max-w-md rounded-3xl border border-line-strong bg-surface-solid p-6 text-center shadow-2xl sm:p-8" role="alert">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-soft text-gold">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-semibold text-ink">Something went wrong</h2>
            <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-ink-muted">
              This screen hit an error. Your decks and progress are saved on this device, so nothing is lost.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button variant="primary" icon={RotateCcw} onClick={this.handleReset}>
                Try again
              </Button>
              <Button icon={Home} onClick={this.handleGoHome}>
                Go to Today
              </Button>
            </div>

            {this.state.error && (
              <div className="mt-5 text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  aria-expanded={this.state.showDetails}
                  className="mx-auto block text-xs text-ink-subtle transition-colors hover:text-ink cursor-pointer"
                >
                  {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
                </button>
                {this.state.showDetails && (
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-line bg-canvas p-3 font-mono text-[11px] text-ink-muted">
                    <p className="font-semibold text-danger">{this.state.error.toString()}</p>
                    {this.state.errorInfo && (
                      <pre className="mt-1 whitespace-pre-wrap text-[10px] text-ink-subtle">{this.state.errorInfo.componentStack}</pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
