"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "./sign-out-button";

const navItems = [
  { href: "/", label: "Add" },
  { href: "/review", label: "Review" },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-zinc-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl bg-zinc-900 text-xs font-semibold uppercase tracking-[0.2em] text-white">
          ML
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Money Log
          </p>
          <p className="text-sm font-medium text-zinc-900">
            Capture in seconds
          </p>
        </div>
      </div>

      <nav className="flex items-center gap-2 rounded-full bg-zinc-100 p-1 text-sm">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <SignOutButton />
    </header>
  );
}
