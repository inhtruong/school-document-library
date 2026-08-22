import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TOAST_KEYS } from "@/lib/toast-messages";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Incorrect email or password.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";

    try {
      await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirectTo: `/?toast=${TOAST_KEYS.loggedIn}`,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        const message = ERROR_MESSAGES[err.type] ?? "Something went wrong. Please try again.";
        // Auth failure is an action outcome (not a field-format validation
        // issue like a malformed email), so it gets a toast too, matching
        // the register-duplicate-email pattern — alongside the inline box.
        redirect(`/login?error=${encodeURIComponent(message)}&notify=1`);
      }
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16 sm:py-24">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Log in</h1>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form action={login} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="login-email">
          Email
          <Input id="login-email" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="login-password">
          Password
          <Input
            id="login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <Button type="submit">Log in</Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-ink underline underline-offset-2">
          Register
        </Link>
      </p>
    </div>
  );
}
