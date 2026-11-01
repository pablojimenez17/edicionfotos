import { Component, type ReactNode, type ErrorInfo } from 'react';
import { toast } from '../stores/toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Lumen ErrorBoundary capturó un fallo no controlado:', error, errorInfo);
    toast.error(`Error no controlado: ${error.message}`);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-zinc-900 border border-rose-500/40 rounded-xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-400">
              <span className="text-2xl">⚠️</span>
              <h1 className="text-lg font-bold">Se ha producido un error inesperado</h1>
            </div>
            <p className="text-sm text-zinc-300">
              Lumen ha interceptado un error no controlado para evitar que la aplicación se congele.
            </p>
            <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-xs font-mono text-rose-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
              {this.state.error?.message || 'Error desconocido'}
              {this.state.error?.stack && `\n\n${this.state.error.stack}`}
            </div>
            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
              >
                Intentar continuar
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Recargar aplicación
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
