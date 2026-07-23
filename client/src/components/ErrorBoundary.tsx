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
            The page hit an unexpected error. Try another tab or reload — your practice data is still
            saved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              className="min-h-11 cursor-pointer"
              onClick={() => {
                this.setState({ error: null });
                window.location.hash = "#/";
              }}
              data-testid="button-error-home"
            >
              Back to Home
            </Button>
            <Button
              className="min-h-11 cursor-pointer"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              data-testid="button-error-reload"
            >
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
