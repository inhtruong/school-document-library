/**
 * Single source of truth for post-redirect success toast keys/text. Server
 * actions append `?toast=<key>` to a redirect URL; `ToastListener` resolves
 * the key to display text client-side. Keeps redirect targets free of
 * arbitrary strings and avoids duplicating message text in multiple places.
 */
export const TOAST_KEYS = {
  accountCreated: "account-created",
  loggedIn: "logged-in",
  loggedOut: "logged-out",
  uploadSuccess: "upload-success",
  uploadPendingReview: "upload-pending-review",
  passwordChanged: "password-changed",
} as const;

export type ToastKey = (typeof TOAST_KEYS)[keyof typeof TOAST_KEYS];

export const TOAST_MESSAGES: Record<ToastKey, string> = {
  [TOAST_KEYS.accountCreated]: "Account created successfully",
  [TOAST_KEYS.loggedIn]: "Logged in successfully",
  [TOAST_KEYS.loggedOut]: "Logged out successfully",
  [TOAST_KEYS.uploadSuccess]: "Document uploaded successfully",
  [TOAST_KEYS.uploadPendingReview]: "Document uploaded successfully and is pending review",
  [TOAST_KEYS.passwordChanged]: "Password changed successfully. Please sign in again.",
};

export function isToastKey(value: string | null): value is ToastKey {
  return value !== null && value in TOAST_MESSAGES;
}

/** Semantic toast variants — mirrors Sonner's toast.success/warning/error calls. */
export type ToastVariant = "success" | "warning" | "error";

export type ResolvedFeedback = { variant: ToastVariant; message: string };

/**
 * Pure classification of the redirect-carried feedback params into the
 * toast(s) to show. Kept side-effect free so it's unit-testable without a
 * DOM; `ToastListener` calls this and dispatches to the matching Sonner API.
 */
export function resolveFeedback(params: {
  toast: string | null;
  error: string | null;
  notify: string | null;
}): ResolvedFeedback[] {
  const actions: ResolvedFeedback[] = [];

  if (isToastKey(params.toast)) {
    actions.push({ variant: "success", message: TOAST_MESSAGES[params.toast] });
  }
  if (params.error && params.notify) {
    actions.push({ variant: "error", message: params.error });
  }

  return actions;
}

/** Tint styling per variant, layered onto the shared toast card in ui/sonner.tsx. */
export const TOAST_VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "!bg-green-50 !border-green-200 !text-green-700",
  warning: "!bg-amber-50 !border-amber-200 !text-amber-700",
  error: "!bg-red-50 !border-red-200 !text-red-700",
};
