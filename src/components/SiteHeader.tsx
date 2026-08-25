import Link from "next/link";
import { Bell } from "lucide-react";
import { auth } from "@/auth";
import { AccountMenu } from "@/components/AccountMenu";
import { MobileMenu } from "@/components/MobileMenu";
import { buttonVariants } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/authorize";
import { cn } from "@/lib/utils";
import { getUnreadNotificationCount } from "@/lib/notifications/notification";

const navLinkClassName =
  "rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * Server Component end to end — the only client boundaries in the header
 * are the two small, self-contained pieces that genuinely need
 * interactivity (AccountMenu, MobileMenu), each receiving already-fetched
 * data as plain props rather than fetching anything themselves. Scalable
 * by design: new primary destinations become another `navLinkClassName`
 * Link here; new account-scoped items become another DropdownMenuItem in
 * AccountMenu/MobileMenu — neither requires the header bar itself to grow.
 */
export default async function SiteHeader() {
  const session = await auth();
  const unreadCount = session?.user ? await getUnreadNotificationCount(session.user.id) : 0;
  const canUpload = session?.user ? hasRole(session, ["TEACHER", "ADMIN"]) : false;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span aria-hidden className="flex h-8 w-8 items-end gap-[3px] rounded-md bg-surface p-[6px]">
            <span className="h-full w-[3px] rounded-full bg-accent" />
            <span className="h-2/3 w-[3px] rounded-full bg-ink/70" />
            <span className="h-4/5 w-[3px] rounded-full bg-ink/30" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-base font-semibold tracking-tight">Stacks</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
              School library
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          <Link href="/search" className={navLinkClassName}>
            Documents
          </Link>
          {canUpload ? (
            <Link href="/upload" className={navLinkClassName}>
              Upload
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <Link
              href="/notifications"
              aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-ink transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Bell className="h-4 w-4" aria-hidden />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium leading-none text-paper">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          ) : null}

          {session?.user ? (
            <div className="hidden md:block">
              <AccountMenu
                name={session.user.name ?? session.user.email ?? "Account"}
                email={session.user.email ?? ""}
                role={session.user.role}
              />
            </div>
          ) : (
            <div className="hidden items-center gap-3 md:flex">
              <Link href="/login" className={navLinkClassName}>
                Log in
              </Link>
              <Link href="/register" className={cn(buttonVariants({ size: "sm" }))}>
                Register
              </Link>
            </div>
          )}

          <div className="md:hidden">
            {session?.user ? (
              <MobileMenu
                isAuthenticated
                name={session.user.name ?? session.user.email ?? "Account"}
                email={session.user.email ?? ""}
                role={session.user.role}
                canUpload={canUpload}
              />
            ) : (
              <MobileMenu isAuthenticated={false} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
