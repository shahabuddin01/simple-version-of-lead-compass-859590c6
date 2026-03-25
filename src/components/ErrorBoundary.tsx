import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.PROD) {
      // Production: minimal logging
      console.error("[CRM Error]", error.message);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <span className="text-3xl">⚠️</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Please try reloading the page.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => { sessionStorage.clear(); localStorage.clear(); window.location.href = "/"; }}
                className="rounded-md border border-input bg-background px-6 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                Clear Data & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
