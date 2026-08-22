"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Toaster as SonnerToaster } from "sonner";
import { TOAST_VARIANT_STYLES } from "@/lib/toast-messages";

/**
 * App is light-only today (no dark-mode toggle, no next-themes anywhere) —
 * theme="light" keeps toasts matching the rest of the UI regardless of the
 * visitor's OS color-scheme preference, instead of Sonner silently switching
 * to its own dark palette.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="light"
      icons={{
        success: <CheckCircle2 aria-hidden className="h-5 w-5 text-green-600" />,
        warning: <AlertTriangle aria-hidden className="h-5 w-5 text-amber-600" />,
        error: <XCircle aria-hidden className="h-5 w-5 text-red-600" />,
      }}
      toastOptions={{
        classNames: {
          toast: "rounded-lg border border-line shadow-lg items-start gap-3",
          title: "text-sm font-medium leading-snug break-words",
          description: "text-sm break-words",
          success: TOAST_VARIANT_STYLES.success,
          warning: TOAST_VARIANT_STYLES.warning,
          error: TOAST_VARIANT_STYLES.error,
        },
      }}
    />
  );
}
