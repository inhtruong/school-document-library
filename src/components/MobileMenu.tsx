"use client";

import Link from "next/link";
import { FileStack, LogOut, Menu, ShieldCheck, Sparkles, Upload, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/auth/sign-out-action";
import type { Role } from "@prisma/client";

export type MobileMenuProps =
  | { isAuthenticated: false }
  | {
      isAuthenticated: true;
      name: string;
      email: string;
      role: Role;
      canUpload: boolean;
      /** ADMIN only (FEAT-10B) — server-computed by SiteHeader, never inferred client-side from `role` alone. */
      canModerate: boolean;
      /** TEACHER only (FEAT-10C) — server-computed by SiteHeader, same convention as canModerate. */
      canViewMyUploads: boolean;
    };

/**
 * Compact mobile navigation (visible only below `md:` — SiteHeader renders
 * the primary nav links + AccountMenu instead at `md:` and up). The
 * notification bell stays its own always-visible icon on every viewport
 * (see SiteHeader) rather than being duplicated in here, since it's a
 * high-frequency, glanceable action. Consolidates primary nav + account
 * actions behind one trigger so the mobile header never overflows, using
 * the same DropdownMenu primitive as the desktop account menu rather than
 * a second interactive dependency. Keyboard/touch accessible via Radix's
 * built-in menu semantics (Escape to close, arrow keys to move focus, each
 * item is a real ≥44px touch target).
 */
export function MobileMenu(props: MobileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-ink outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-64">
        {props.isAuthenticated ? (
          <>
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="truncate text-sm font-medium text-ink">{props.name}</span>
              <span className="truncate text-xs font-normal text-muted">{props.email}</span>
              <Badge variant="soft" className="mt-1 w-fit">
                {props.role}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuItem asChild>
          <Link href="/search">Documents</Link>
        </DropdownMenuItem>

        {props.isAuthenticated ? (
          <>
            {props.canUpload ? (
              <DropdownMenuItem asChild>
                <Link href="/upload">
                  <Upload className="h-4 w-4 text-muted" aria-hidden />
                  Upload document
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href="/saved">
                <Sparkles className="h-4 w-4 text-muted" aria-hidden />
                Saved
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/following">
                <Users className="h-4 w-4 text-muted" aria-hidden />
                Following
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            {props.canViewMyUploads ? (
              <DropdownMenuItem asChild>
                <Link href="/my-uploads">
                  <FileStack className="h-4 w-4 text-muted" aria-hidden />
                  My uploads
                </Link>
              </DropdownMenuItem>
            ) : null}
            {props.canModerate ? (
              <DropdownMenuItem asChild>
                <Link href="/moderation">
                  <ShieldCheck className="h-4 w-4 text-muted" aria-hidden />
                  Moderation
                </Link>
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-destructive focus:bg-destructive-soft focus:text-destructive"
              onSelect={() => {
                void signOutAction();
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Log out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/login">Log in</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/register" className="font-medium text-accent">
                Register
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
