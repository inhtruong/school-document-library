"use client";

import Link from "next/link";
import { ChevronDown, FileStack, LogOut, ShieldCheck, Sparkles, Users } from "lucide-react";
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

export type AccountMenuProps = {
  name: string;
  email: string;
  role: Role;
  /** ADMIN only (FEAT-10B) — server-computed by SiteHeader, never inferred client-side from `role` alone. */
  canModerate: boolean;
  /** TEACHER only (FEAT-10C) — server-computed by SiteHeader, same convention as canModerate. */
  canViewMyUploads: boolean;
};

/**
 * Desktop account dropdown (hidden below `md:` — see SiteHeader, which
 * renders MobileMenu instead at narrower widths). Deliberately the ONLY
 * interactive client boundary for the authenticated desktop header: name,
 * email, and role are passed in as plain props already resolved
 * server-side by SiteHeader, so this component does no data fetching of
 * its own. Only real, currently-existing routes are listed — Saved,
 * Following, Profile, and (Admin-only) Moderation all exist today; no
 * placeholder/future routes.
 */
export function AccountMenu({ name, email, role, canModerate, canViewMyUploads }: AccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-sm text-ink outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-[8rem] truncate">{name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
        <span className="sr-only">Open account menu</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate text-sm font-medium text-ink">{name}</span>
          <span className="truncate text-xs font-normal text-muted">{email}</span>
          <Badge variant="soft" className="mt-1 w-fit">
            {role}
          </Badge>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

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
        {canViewMyUploads ? (
          <DropdownMenuItem asChild>
            <Link href="/my-uploads">
              <FileStack className="h-4 w-4 text-muted" aria-hidden />
              My uploads
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canModerate ? (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
