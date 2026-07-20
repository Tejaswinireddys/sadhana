import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center"
          data-testid="error-boundary"
        >
          <h1 className="font-serif text-2xl">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            The page hit an unexpected error. Try reloading — your practice data is still saved.
          </p>
          <Button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            data-testid="button-error-reload"
          >
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
