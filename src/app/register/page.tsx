import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerStudent } from "@/lib/auth/register";
import { translateErrorCode } from "@/lib/errors/translate-error";
import { TOAST_KEYS } from "@/lib/toast-messages";

type RegisterPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { error } = await searchParams;
  const tAuth = await getTranslations("auth");

  async function register(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await registerStudent({
      name: String(formData.get("name") ?? ""),
      email,
      password,
    });

    if (!result.success) {
      const message = await translateErrorCode(result.error);
      const notify = result.status !== 400 ? "&notify=1" : "";
      redirect(`/register?error=${encodeURIComponent(message)}${notify}`);
    }

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: `/?toast=${TOAST_KEYS.accountCreated}`,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        const message = encodeURIComponent(await translateErrorCode("AUTH_SIGNIN_AFTER_REGISTER_FAILED"));
        redirect(`/login?error=${message}&notify=1`);
      }
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16 sm:py-24">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{tAuth("createAccountHeading")}</h1>
      <p className="mt-2 text-sm text-muted">{tAuth("createAccountSubtitle")}</p>

      {error ? (
        <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form action={register} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="register-name">
          {tAuth("name")}
          <Input id="register-name" name="name" type="text" required autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="register-email">
          {tAuth("email")}
          <Input id="register-email" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="register-password">
          {tAuth("password")}
          <Input
            id="register-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <Button type="submit">{tAuth("createAccountButton")}</Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {tAuth("haveAccount")}{" "}
        <Link href="/login" className="text-ink underline underline-offset-2">
          {tAuth("login")}
        </Link>
      </p>
    </div>
  );
}
