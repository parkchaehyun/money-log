"use client";

import { SignOutButton } from "./sign-out-button";

export function AppFooter() {
  return (
    <footer className="flex justify-center pb-4 text-xs text-zinc-400">
      <SignOutButton variant="ghost" />
    </footer>
  );
}
