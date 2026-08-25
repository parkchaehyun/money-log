"use client";

import { signIn } from "next-auth/react";
import { useId, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const callbackUrl =
      new URLSearchParams(window.location.search).get("callbackUrl") ?? "/";

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = result?.url ?? callbackUrl;
  }

  return (
    <main className="app-canvas min-h-screen px-4 py-10 text-ink sm:px-6 sm:py-14">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">Money Log</h1>
          <p className="mt-2 text-sm text-muted">Sign in</p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="surface-panel p-5 sm:p-6"
        >
          <label htmlFor={emailId} className="text-sm font-medium text-ink-soft">
            Email
          </label>
          <input
            id={emailId}
            className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base transition focus:border-accent"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor={passwordId} className="mt-5 block text-sm font-medium text-ink-soft">
            Password
          </label>
          <input
            id={passwordId}
            className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base transition focus:border-accent"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error ? (
            <p role="alert" className="mt-4 text-sm text-danger">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:bg-muted"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-muted">Private access</p>
      </div>
    </main>
  );
}
