import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();

  if (!session.configured) {
    redirect("/setup");
  }
  if (session.userId) {
    redirect("/overview");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-muted/50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex size-11 items-center justify-center rounded-lg bg-primary text-white"
          >
            <span className="text-label-md font-bold">CCM</span>
          </span>
          <h1 className="text-headline-lg font-bold text-tertiary">
            Command Center Medicalbay
          </h1>
          <p className="text-body-md text-muted-text">
            Sign in to your workspace. Access is invite-only.
          </p>
        </header>
        <LoginForm />
      </div>
    </main>
  );
}
