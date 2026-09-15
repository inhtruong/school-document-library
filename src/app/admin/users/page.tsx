import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Users as UsersIcon } from "lucide-react";
import type { Role } from "@prisma/client";
import { UserRoleChangeDialog } from "@/components/admin/UserRoleChangeDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DateTimeFormatter } from "@/i18n/formats";
import { listAdminUsers } from "@/lib/admin/users";
import { requireRole } from "@/lib/auth/authorize";
import { ROLE_VALUES, roleMessageKey } from "@/lib/auth/roles";

type AdminUsersPageProps = {
  searchParams: Promise<{ search?: string; role?: string; page?: string }>;
};

function parseRole(value: string | undefined): Role | undefined {
  return value && (ROLE_VALUES as string[]).includes(value) ? (value as Role) : undefined;
}

function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function pageHref(filter: { search?: string; role?: string }, page: number): string {
  const params = new URLSearchParams();
  if (filter.search) params.set("search", filter.search);
  if (filter.role) params.set("role", filter.role);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

function formatDate(date: Date, format: DateTimeFormatter): string {
  return format.dateTime(date, "dateTimeShort");
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await requireRole("ADMIN");

  const { search: rawSearch, role: rawRole, page: rawPage } = await searchParams;
  const search = rawSearch?.trim() || undefined;
  const role = parseRole(rawRole);
  const page = parsePage(rawPage);
  const filter = { search: rawSearch, role: rawRole };

  const result = await listAdminUsers({ search, role }, page);
  const [tUsers, tRoles, tCommon, tActions, format] = await Promise.all([
    getTranslations("admin.users"),
    getTranslations("common.roles"),
    getTranslations("common"),
    getTranslations("actions"),
    getFormatter(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{tUsers("heading")}</h1>
      <p className="mt-1 text-sm text-muted">{tUsers("subtitle")}</p>

      <form method="GET" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm" htmlFor="user-filter-search">
          {tUsers("searchLabel")}
          <input
            id="user-filter-search"
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder={tUsers("searchPlaceholder")}
            className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="user-filter-role">
          {tUsers("roleFilterLabel")}
          <select
            id="user-filter-role"
            name="role"
            defaultValue={role ?? ""}
            className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">{tUsers("allRoles")}</option>
            {ROLE_VALUES.map((value) => (
              <option key={value} value={value}>
                {tRoles(roleMessageKey(value))}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" variant="outline">
          {tActions("filter")}
        </Button>
      </form>

      <p className="mt-4 text-sm text-muted">{tUsers("userCount", { count: result.total })}</p>

      {result.users.length > 0 ? (
        <>
          <Card className="mt-4 divide-y divide-line overflow-hidden p-0">
            <ul>
              {result.users.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <Link href={`/admin/users/${user.id}`} className="font-medium text-ink hover:text-accent">
                      {user.name}
                    </Link>
                    <p className="mt-0.5 truncate text-sm text-muted">{user.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <Badge variant="outline">{tRoles(roleMessageKey(user.role))}</Badge>
                    <span className="text-xs text-muted">{formatDate(user.createdAt, format)}</span>
                    <UserRoleChangeDialog user={user} isSelf={user.id === session.user.id} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {result.totalPages > 1 ? (
            <nav aria-label={tCommon("pagination")} className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={pageHref(filter, page - 1)}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  page <= 1 ? "pointer-events-none border-line text-muted/50" : "border-line text-ink hover:border-ink/25"
                }`}
              >
                {tCommon("previous")}
              </Link>
              <span className="text-xs text-muted">{tCommon("pageOf", { page, total: result.totalPages })}</span>
              <Link
                href={pageHref(filter, page + 1)}
                aria-disabled={page >= result.totalPages}
                tabIndex={page >= result.totalPages ? -1 : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  page >= result.totalPages
                    ? "pointer-events-none border-line text-muted/50"
                    : "border-line text-ink hover:border-ink/25"
                }`}
              >
                {tCommon("next")}
              </Link>
            </nav>
          ) : null}
        </>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <UsersIcon className="h-5 w-5 text-muted" aria-hidden />
          <p className="text-sm text-muted">{tUsers("noUsers")}</p>
        </div>
      )}
    </div>
  );
}
