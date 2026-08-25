"use client";

import { SignOutButton } from "./sign-out-button";

export function AppFooter() {
  return (
    <footer className="flex justify-center pb-2 text-xs text-muted">
      <SignOutButton variant="ghost" />
    </footer>
  );
}
