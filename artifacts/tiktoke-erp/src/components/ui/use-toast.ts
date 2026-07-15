import * as React from "react"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive"
}

// Minimal implementation to fix the build quickly
export function useToast() {
  const [toasts, setToasts] = React.useState<any[]>([]);

  const toast = React.useCallback(
    ({ ...props }: any) => {
      setToasts((prev) => [...prev, { id: Math.random().toString(), ...props }]);
      // Fallback to sonner for actual displaying to save implementation time
      // The parent uses sonner toast in App.tsx
      import("sonner").then((mod) => {
        if (props.variant === "destructive") {
          mod.toast.error(props.title, { description: props.description });
        } else {
          mod.toast.success(props.title, { description: props.description });
        }
      });
    },
    []
  )

  return {
    toast,
    toasts,
  }
}
