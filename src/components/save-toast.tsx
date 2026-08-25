"use client";

import { createPortal } from "react-dom";

type SaveToastProps = {
  message: string | null;
};

export function SaveToast({ message }: SaveToastProps) {
  if (!message || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[60] flex justify-center px-6">
      <div
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-success px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(25,115,78,0.25)]"
      >
        <span className="grid size-5 place-items-center rounded-full bg-white/20">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="size-3.5"
          >
            <path
              d="M5 10.5l3 3L15 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {message}
      </div>
    </div>,
    document.body
  );
}
