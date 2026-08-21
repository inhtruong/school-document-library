import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerStudent } from "@/lib/auth/register";

type RegisterPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { error } = await searchParams;

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
      redirect(`/register?error=${encodeURIComponent(result.error)}`);
    }

    try {
      await signIn("credentials", { email, password, redirectTo: "/" });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/login");
      }
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16 sm:py-24">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-2 text-sm text-muted">Register as a student to get started.</p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form action={register} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="register-name">
          Name
          <Input id="register-name" name="name" type="text" required autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="register-email">
          Email
          <Input id="register-email" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="register-password">
          Password
          <Input
            id="register-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <Button type="submit">Create account</Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}
