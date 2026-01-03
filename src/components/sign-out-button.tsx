"use client";

import { signOut } from "next-auth/react";

type SignOutButtonProps = {
  label?: string;
  variant?: "default" | "ghost";
  className?: string;
};

export function SignOutButton({
  label = "Sign out",
  variant = "default",
  className,
}: SignOutButtonProps) {
  const base =
    variant === "ghost"
      ? "text-xs font-medium text-zinc-400 transition hover:text-zinc-900"
      : "rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black transition hover:border-black/30 hover:bg-black/5";

  return (
    <button
      type="button"
      className={`${base}${className ? ` ${className}` : ""}`}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      {label}
    </button>
  );
}
