"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { UserCog } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ROLE_VALUES, roleMessageKey } from "@/lib/auth/roles";

type UserRoleChangeDialogProps = {
  user: { id: string; name: string; email: string; role: Role };
  /** The signed-in Admin's own row — hides the control entirely (FEAT-15C: self-role-change is blocked both client- and server-side). */
  isSelf: boolean;
};

/** Dialog + fetch + toast + router.refresh() — same recipe as TaxonomyCrudDialogs.tsx. */
export function UserRoleChangeDialog({ user, isSelf }: UserRoleChangeDialogProps) {
  const router = useRouter();
  const t = useTranslations("admin.users");
  const tRoles = useTranslations("common.roles");
  const tActions = useTranslations("actions");
  const tErrors = useTranslations("errors.codes");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isSelf) return null;

  function resetAndClose() {
    setOpen(false);
    setRole(user.role);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role === user.role) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to update role");

      setOpen(false);
      toast.success(t("roleUpdated", { name: user.name }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tErrors("failedUpdateUserRole"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <UserCog className="h-4 w-4" aria-hidden />
          {t("changeRole")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("changeRoleTitle")}</DialogTitle>
            <DialogDescription>{t("changeRoleDescription", { name: user.name, email: user.email })}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted">
              {t("currentRole")}: <span className="font-medium text-ink">{tRoles(roleMessageKey(user.role))}</span>
            </p>
            <label className="flex flex-col gap-1.5 text-sm" htmlFor="new-role">
              {t("newRoleLabel")}
              <select
                id="new-role"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                disabled={submitting}
                className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {ROLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {tRoles(roleMessageKey(value))}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                {tActions("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting || role === user.role}>
              {submitting ? t("saving") : tActions("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
