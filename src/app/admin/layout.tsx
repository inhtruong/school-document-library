import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AdminNav, type AdminNavItem } from "@/components/admin/AdminNav";
import { requireRole } from "@/lib/auth/authorize";

/**
 * FEAT-15A: the one place `/admin/*` authorization is enforced — every
 * current and future Admin page (dashboard, audit log, and the FEAT-15B/C/D/E
 * CRUD pages to come) is automatically protected by nesting under this
 * layout, using the same `requireRole("ADMIN")` every other protected page
 * already uses (no second authorization system). `/admin/audit-log`'s own
 * existing `requireRole("ADMIN")` call becomes redundant but harmless —
 * left in place rather than removed, since this layout's job is to guard
 * new pages, not to refactor a working one.
 */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireRole("ADMIN");

  const [tAdmin, tAdminNav] = await Promise.all([getTranslations("admin"), getTranslations("admin.nav")]);

  const items: AdminNavItem[] = [
    { href: "/admin", label: tAdminNav("dashboard") },
    { href: "/moderation", label: tAdminNav("moderation") },
    { href: "/admin/audit-log", label: tAdminNav("auditLog") },
    { href: "/admin/taxonomy", label: tAdminNav("taxonomy") },
    { href: "/admin/users", label: tAdminNav("users") },
    { href: "/admin/documents", label: tAdminNav("documents"), disabled: true },
    { href: "/admin/reports", label: tAdminNav("reports"), disabled: true },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 sm:py-10 lg:flex-row lg:items-start">
      <aside className="lg:sticky lg:top-20 lg:w-56 lg:shrink-0">
        <p className="font-display text-lg font-semibold tracking-tight text-ink">{tAdmin("dashboardTitle")}</p>
        <Link
          href="/"
          className="mt-1 inline-block text-sm text-muted underline underline-offset-2 transition-colors hover:text-ink"
        >
          {tAdmin("backToSite")}
        </Link>
        <div className="mt-4">
          <AdminNav items={items} comingSoonLabel={tAdminNav("comingSoon")} ariaLabel={tAdmin("dashboardTitle")} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
