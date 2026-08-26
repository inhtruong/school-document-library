"use server";

import { signOut } from "@/auth";
import { TOAST_KEYS } from "@/lib/toast-messages";

/**
 * Extracted from SiteHeader's inline `"use server"` closure (UI-1) so it can
 * be imported directly by the new client-side AccountMenu/MobileMenu
 * components — a Client Component can't receive an inline server-action
 * closure defined inside a Server Component's JSX, but it can import a
 * named export from a file marked "use server" at the top, which is the
 * standard supported pattern. Purely a location change: same `signOut()`
 * call, same redirect target, same toast key as before.
 */
export async function signOutAction(
  redirectTo: string = `/?toast=${TOAST_KEYS.loggedOut}`
): Promise<void> {
  await signOut({ redirectTo });
}
