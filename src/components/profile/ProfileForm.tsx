"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const NAME_MAX_LENGTH = 100;

type ProfileFormProps = {
  initialName: string;
  email: string;
  roleLabel: string;
  memberSince: string;
};

/**
 * Name is the only editable field — Email/Role/Member since are read-only
 * display rows in the same form (matching the spec's single "Profile
 * information" block), submitted together but only `name` is ever sent.
 */
export function ProfileForm({ initialName, email, roleLabel, memberSince }: ProfileFormProps) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const isEmpty = name.length > 0 && trimmedName.length === 0;
  const inlineError = serverError ?? (isEmpty ? "Name is required" : null);
  const canSubmit = trimmedName.length > 0 && trimmedName.length <= NAME_MAX_LENGTH && !submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setServerError(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to update profile");

      setName(body.data.name);
      toast.success("Profile updated successfully");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm" htmlFor="profile-name">
        Name
        <Input
          id="profile-name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setServerError(null);
          }}
          maxLength={NAME_MAX_LENGTH}
          disabled={submitting}
          autoComplete="name"
          aria-invalid={inlineError ? true : undefined}
          aria-describedby={inlineError ? "profile-name-error" : undefined}
        />
      </label>
      {inlineError ? (
        <p id="profile-name-error" role="alert" className="-mt-2 text-xs text-destructive">
          {inlineError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
        <p className="text-sm text-ink">{email}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Role</span>
        <Badge variant="soft" className="w-fit">
          {roleLabel}
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Member since</span>
        <p className="text-sm text-ink">{memberSince}</p>
      </div>

      <div>
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
