import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown }
> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <html lang="en">
          <body>
            <div data-testid="error-fallback">
              Caught an error: {String(this.state.error)}
            </div>
            <button
              type="button"
              data-testid="retry"
              onClick={() => this.setState({ error: null })}
            >
              Retry
            </button>
          </body>
        </html>
      );
    }
    return this.props.children;
  }
}
