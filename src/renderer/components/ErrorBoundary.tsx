import React, { Component } from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-bg-base text-text-primary p-8">
          <div className="w-14 h-14 rounded-2xl bg-status-error/10 flex items-center justify-center mb-4">
            <span className="text-3xl">⚠</span>
          </div>
          <h1 className="text-lg font-medium mb-2">오류가 발생했습니다</h1>
          <p className="text-sm text-text-secondary max-w-md text-center mb-4">
            예기치 않은 오류가 발생했습니다. 앱을 다시 로드해 보세요.
          </p>
          <pre className="text-xs text-text-muted bg-bg-card border border-border-subtle rounded-card p-3 max-w-lg overflow-auto max-h-32 mb-6 w-full">
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-button text-sm font-medium cursor-pointer transition-all"
          >
            앱 다시 로드
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
