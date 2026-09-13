"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { TOAST_KEYS, resolveFeedback, type ToastMessages } from "@/lib/toast-messages";

/**
 * Mounted once in the root layout. Server actions communicate feedback by
 * appending query params to their redirect target:
 *  - `?toast=<key>`        a known success message to show (see toast-messages.ts)
 *  - `?error=<text>`       inline failure text, already rendered by the page itself
 *  - `&notify=1`           alongside `error`, also surface it as a toast
 *                          (reserved for action/system-level failures, not
 *                          field validation, to avoid duplicate messaging)
 *
 * Only `toast`/`notify` are stripped from the URL after firing — `error` is
 * left in place since pages read it server-side to render their inline box.
 */
export default function ToastListener() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const paramsString = searchParams.toString();
  const t = useTranslations("toast");
  const messages: ToastMessages = {
    [TOAST_KEYS.accountCreated]: t("accountCreated"),
    [TOAST_KEYS.loggedIn]: t("loggedIn"),
    [TOAST_KEYS.loggedOut]: t("loggedOut"),
    [TOAST_KEYS.uploadSuccess]: t("uploadSuccess"),
    [TOAST_KEYS.uploadPendingReview]: t("uploadPendingReview"),
    [TOAST_KEYS.passwordChanged]: t("passwordChanged"),
  };

  useEffect(() => {
    const toastKey = searchParams.get("toast");
    const errorText = searchParams.get("error");
    const notify = searchParams.get("notify");

    const actions = resolveFeedback({ toast: toastKey, error: errorText, notify }, messages);
    for (const action of actions) {
      if (action.variant === "warning") toast.warning(action.message);
      else if (action.variant === "error") toast.error(action.message);
      else toast.success(action.message);
    }

    if (toastKey || notify) {
      const nextParams = new URLSearchParams(paramsString);
      nextParams.delete("toast");
      nextParams.delete("notify");
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsString, pathname]);

  return null;
}
