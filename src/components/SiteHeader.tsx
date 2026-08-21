import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";

export default async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-3 rounded-sm">
          <span aria-hidden className="flex h-8 w-8 items-end gap-[3px] rounded-md bg-surface p-[6px]">
            <span className="h-full w-[3px] rounded-full bg-accent" />
            <span className="h-2/3 w-[3px] rounded-full bg-ink/70" />
            <span className="h-4/5 w-[3px] rounded-full bg-ink/30" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-base font-semibold tracking-tight">Stacks</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              School library
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/search"
            className="rounded-full border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-ink/25 hover:text-ink"
          >
            All documents
          </Link>

          {session?.user ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 text-sm text-ink transition-colors hover:text-accent"
              >
                <span className="max-w-[9rem] truncate">
                  {session.user.name ?? session.user.email}
                </span>
                <Badge variant="soft">{session.user.role}</Badge>
              </Link>

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="text-sm text-muted transition-colors hover:text-ink"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-accent"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
