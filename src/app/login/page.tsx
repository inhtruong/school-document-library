import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isSafeCallbackUrl } from "@/lib/auth/callback-url";
import type { ErrorCode } from "@/lib/errors/error-codes";
import { translateErrorCode } from "@/lib/errors/translate-error";
import { TOAST_KEYS } from "@/lib/toast-messages";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

const ERROR_CODES: Record<string, ErrorCode> = {
  CredentialsSignin: "AUTH_INVALID_CREDENTIALS",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, callbackUrl } = await searchParams;
  const safeCallbackUrl = isSafeCallbackUrl(callbackUrl) ? callbackUrl : null;
  const tAuth = await getTranslations("auth");

  async function login(formData: FormData) {
    "use server";

    const destination = safeCallbackUrl ?? "/";
    const separator = destination.includes("?") ? "&" : "?";

    try {
      await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirectTo: `${destination}${separator}toast=${TOAST_KEYS.loggedIn}`,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        const code = ERROR_CODES[err.type] ?? "UNEXPECTED_ERROR";
        const message = await translateErrorCode(code);
        // Auth failure is an action outcome (not a field-format validation
        // issue like a malformed email), so it gets a toast too, matching
        // the register-duplicate-email pattern — alongside the inline box.
        const retryParams = new URLSearchParams({ error: message, notify: "1" });
        if (safeCallbackUrl) retryParams.set("callbackUrl", safeCallbackUrl);
        redirect(`/login?${retryParams.toString()}`);
      }
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16 sm:py-24">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{tAuth("login")}</h1>

      {error ? (
        <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form action={login} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="login-email">
          {tAuth("email")}
          <Input id="login-email" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="login-password">
          {tAuth("password")}
          <Input
            id="login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <Button type="submit">{tAuth("login")}</Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {tAuth("noAccount")}{" "}
        <Link href="/register" className="text-ink underline underline-offset-2">
          {tAuth("register")}
        </Link>
      </p>
    </div>
  );
}
