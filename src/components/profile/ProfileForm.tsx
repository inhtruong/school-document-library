"use client";

import { useState, type FormEvent } from "react";
import { Calendar, Mail, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { SettingsRow, settingsGroupClassName } from "@/components/profile/settings-row";
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
 * rows in the same settings group, submitted together but only `name` is
 * ever sent.
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
    <form onSubmit={handleSubmit} className={settingsGroupClassName}>
      <SettingsRow icon={User} label="Name" htmlFor="profile-name">
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
        {inlineError ? (
          <p id="profile-name-error" role="alert" className="mt-1.5 text-xs text-destructive">
            {inlineError}
          </p>
        ) : null}
      </SettingsRow>

      <SettingsRow icon={Mail} label="Email">
        <p className="text-sm text-ink">{email}</p>
      </SettingsRow>

      <SettingsRow icon={ShieldCheck} label="Role">
        <Badge variant="soft" className="w-fit">
          {roleLabel}
        </Badge>
      </SettingsRow>

      <SettingsRow icon={Calendar} label="Member since">
        <p className="text-sm text-ink">{memberSince}</p>
      </SettingsRow>

      <div className="flex justify-end px-4 py-3.5">
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
