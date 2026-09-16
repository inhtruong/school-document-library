import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { AccountMenu } from "@/components/AccountMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MobileMenu } from "@/components/MobileMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { buttonVariants } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/authorize";
import { cn } from "@/lib/utils";
import { listNotifications } from "@/lib/notifications/notification";

/**
 * Header/Background Adjustment: the header's own background is now the
 * brand red (`bg-accent`), so every text/ring color here is the header's
 * OWN override, not the app-wide default. `text-canvas` (pure white,
 * #FFFFFF — the token this pass added for the page background) measures a
 * hair better than the warm-white `paper` token as text directly on
 * #F62440, so it's reused here for "foreground sitting straight on red";
 * `paper` stays reserved for light CHIP backgrounds (the Register button
 * below, and the pre-existing bg-card triggers in NotificationBell/
 * LanguageSwitcher/MobileMenu), matching how the rest of the app already
 * uses `paper`. Hovering still lands on the established `bg-surface` +
 * `text-ink` pairing (a light chip with dark text), which needed no change
 * since it was never red-on-red to begin with. `ring-canvas` replaces
 * `ring-accent` for the same reason a red ring would vanish against a red
 * header.
 */
const navLinkClassName =
  "rounded-lg px-3 py-2 text-sm font-medium text-canvas transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas";

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
  const notificationsPreview = session?.user ? await listNotifications(session.user.id, 1) : null;
  const canUpload = session?.user ? hasRole(session, ["TEACHER", "ADMIN"]) : false;
  const canModerate = session?.user ? hasRole(session, "ADMIN") : false;
  const canViewMyUploads = session?.user ? hasRole(session, "TEACHER") : false;

  const locale = await getLocale();
  const [tNav, tAuth, tLanguage] = await Promise.all([
    getTranslations("navigation"),
    getTranslations("auth"),
    getTranslations("language"),
  ]);
  const menuLabels = {
    saved: tNav("saved"),
    following: tNav("following"),
    profile: tNav("profile"),
    myUploads: tNav("myUploads"),
    moderation: tNav("moderation"),
    auditLog: tNav("auditLog"),
    logout: tAuth("logout"),
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-accent text-canvas">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-canvas"
        >
          <span aria-hidden className="flex h-8 w-8 items-end gap-[3px] rounded-md bg-surface p-[6px]">
            <span className="h-full w-[3px] rounded-full bg-accent" />
            <span className="h-2/3 w-[3px] rounded-full bg-ink/70" />
            <span className="h-4/5 w-[3px] rounded-full bg-ink/30" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-base font-semibold tracking-tight">Stacks</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-canvas">
              {tNav("tagline")}
            </span>
          </span>
        </Link>

        <nav aria-label={tNav("primary")} className="hidden items-center gap-1 md:flex">
          <Link href="/search" className={navLinkClassName}>
            {tNav("documents")}
          </Link>
          {canUpload ? (
            <Link href="/upload" className={navLinkClassName}>
              {tNav("upload")}
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher currentLocale={locale} label={tLanguage("label")} />

          {session?.user && notificationsPreview ? (
            <NotificationBell
              initialNotifications={notificationsPreview.notifications.slice(0, 5)}
              initialUnreadCount={notificationsPreview.unreadCount}
            />
          ) : null}

          {session?.user ? (
            <div className="hidden md:block">
              <AccountMenu
                name={session.user.name ?? session.user.email ?? "Account"}
                email={session.user.email ?? ""}
                role={session.user.role}
                canModerate={canModerate}
                canViewMyUploads={canViewMyUploads}
                labels={menuLabels}
              />
            </div>
          ) : (
            <div className="hidden items-center gap-3 md:flex">
              <Link href="/login" className={navLinkClassName}>
                {tAuth("login")}
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  // Inverted on purpose: the shared default variant is a
                  // solid `bg-accent` button, which would vanish against
                  // this now-red header — swapped to a light chip so the
                  // CTA still reads as the header's one "important" action.
                  "bg-paper text-accent hover:bg-surface hover:text-accent-strong active:bg-surface active:text-accent-strong focus-visible:ring-canvas focus-visible:ring-offset-accent"
                )}
              >
                {tAuth("register")}
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
                canModerate={canModerate}
                canViewMyUploads={canViewMyUploads}
                labels={{ ...menuLabels, documents: tNav("documents"), upload: tNav("upload") }}
                openMenuLabel={tNav("openMenu")}
              />
            ) : (
              <MobileMenu
                isAuthenticated={false}
                labels={{ documents: tNav("documents"), login: tAuth("login"), register: tAuth("register") }}
                openMenuLabel={tNav("openMenu")}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
