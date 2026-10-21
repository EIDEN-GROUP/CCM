"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

/**
 * Sign-in form.
 *
 * CCM is invite-only: there is no sign-up path. A password reset request is
 * handled by the Supabase reset email, and the workspace owner controls who
 * receives an invitation.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The `next` parameter is validated: a crafted link must not be able to
  // send a person who has just signed in off to somebody else's site.
  const next = safeInternalPath(searchParams.get("next"), "/overview");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Deliberately generic: revealing whether an account exists would
        // turn the sign-in form into an account enumeration oracle.
        setError("Those credentials were not accepted.");
        setPending(false);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setError("Sign-in is not available right now. Please try again shortly.");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-card"
      noValidate
    >
      <Field label="Work email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@medicalbay.ma"
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-error/30 bg-error-surface/60 px-3 py-2 text-body-sm text-error-ink"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" fullWidth disabled={pending}>
        {pending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-body-sm text-muted-text">
        No account yet? Ask a workspace owner to invite you from Audit &amp;
        Security.
      </p>
    </form>
  );
}
