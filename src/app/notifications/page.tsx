import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NotificationsList } from "@/components/NotificationsList";
import { loginHrefFor } from "@/lib/auth/document-login-href";
import { listNotifications } from "@/lib/notifications/notification";

type NotificationsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function hrefForPage(page: number): string {
  return page > 1 ? `/notifications?page=${page}` : "/notifications";
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const session = await auth();
  if (!session?.user) redirect(loginHrefFor("/notifications"));

  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);

  const { notifications, total, totalPages, unreadCount } = await listNotifications(session.user.id, page);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Notifications</h1>
      <p className="mt-1 text-sm text-muted">
        {total} {total === 1 ? "notification" : "notifications"}
      </p>

      <NotificationsList initialNotifications={notifications} initialUnreadCount={unreadCount} />

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Link
            href={hrefForPage(page - 1)}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              page <= 1
                ? "pointer-events-none border-line text-muted/50"
                : "border-line text-ink hover:border-ink/25"
            }`}
          >
            Previous
          </Link>

          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <Link
              key={pageNumber}
              href={hrefForPage(pageNumber)}
              aria-current={pageNumber === page ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                pageNumber === page
                  ? "border-accent bg-accent text-paper"
                  : "border-line text-ink hover:border-ink/25"
              }`}
            >
              {pageNumber}
            </Link>
          ))}

          <Link
            href={hrefForPage(page + 1)}
            aria-disabled={page >= totalPages}
            tabIndex={page >= totalPages ? -1 : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              page >= totalPages
                ? "pointer-events-none border-line text-muted/50"
                : "border-line text-ink hover:border-ink/25"
            }`}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
