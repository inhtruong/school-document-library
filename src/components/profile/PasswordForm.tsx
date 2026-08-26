"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Lock } from "lucide-react";
import { SettingsRow, settingsGroupClassName } from "@/components/profile/settings-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signOutAction } from "@/lib/auth/sign-out-action";
import { TOAST_KEYS } from "@/lib/toast-messages";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Cross-field checks (confirm-match, new != current) are re-validated
 * server-side too — this is UX only, not the security boundary.
 *
 * A successful change increments the account's sessionVersion server-side
 * (see change-password.ts), which invalidates this very session too — so
 * on success this signs out immediately and redirects to /login (via the
 * existing signOutAction/Auth.js signOut mechanism) rather than leaving a
 * technically-dead session sitting on the page.
 */
export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= MIN_PASSWORD_LENGTH && confirmPassword.length > 0 && !submitting;

  function clearError() {
    if (error) setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to change password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
      setSubmitting(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    // signOut()'s internal redirect() must not be caught by a try/catch —
    // it works by intentionally throwing, which Next.js's own routing
    // layer catches to perform the navigation (same fire-and-forget
    // pattern AccountMenu/MobileMenu already use for their sign-out).
    void signOutAction(`/login?toast=${TOAST_KEYS.passwordChanged}`);
  }

  return (
    <form onSubmit={handleSubmit} className={settingsGroupClassName}>
      <SettingsRow icon={Lock} label="Current password" htmlFor="current-password">
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            clearError();
          }}
          disabled={submitting}
          aria-describedby={error ? "password-form-error" : undefined}
        />
      </SettingsRow>

      <SettingsRow icon={KeyRound} label="New password" htmlFor="new-password">
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            clearError();
          }}
          disabled={submitting}
          aria-describedby={error ? "password-form-error" : undefined}
        />
      </SettingsRow>

      <SettingsRow icon={KeyRound} label="Confirm new password" htmlFor="confirm-password">
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            clearError();
          }}
          disabled={submitting}
          aria-describedby={error ? "password-form-error" : undefined}
        />
      </SettingsRow>

      {error ? (
        <div className="px-4 py-3">
          <p id="password-form-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        </div>
      ) : null}

      <div className="flex justify-end px-4 py-3.5">
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
