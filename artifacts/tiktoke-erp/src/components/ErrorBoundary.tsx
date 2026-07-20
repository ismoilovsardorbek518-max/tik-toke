import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface State { hasError: boolean; message: string; }
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: "" };
  static getDerivedStateFromError(e: Error): State {
    return { hasError: true, message: e.message };
  }
  render() {
    if (this.state.hasError)
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold">Kutilmagan xato yuz berdi</h2>
          <p className="text-sm text-muted-foreground max-w-sm">{this.state.message}</p>
          <Button onClick={() => window.location.reload()}>Qayta yuklash</Button>
        </div>
      );
    return this.props.children;
  }
}
