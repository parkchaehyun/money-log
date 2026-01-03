"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black transition hover:border-black/30 hover:bg-black/5"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </button>
  );
}
