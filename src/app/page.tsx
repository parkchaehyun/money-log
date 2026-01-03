import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/server/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Money Log
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Home</h1>
          <p className="text-sm text-zinc-600">
            Signed in as {session.user.email ?? "unknown"}
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-semibold">Quick Add</h2>
            <p className="mt-2 text-sm text-zinc-600">
              This is where the fast entry screen will live.
            </p>
            <Link
              className="mt-4 inline-flex items-center text-sm font-medium text-zinc-900"
              href="/quick-add"
            >
              Go to Quick Add (coming soon)
            </Link>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-semibold">Dashboard</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Year to month breakdowns and card efficiency metrics.
            </p>
            <Link
              className="mt-4 inline-flex items-center text-sm font-medium text-zinc-900"
              href="/dashboard"
            >
              View dashboard (coming soon)
            </Link>
          </div>
        </section>

        <div>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
