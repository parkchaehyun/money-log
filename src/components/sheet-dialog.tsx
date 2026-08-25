"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

export function SheetDialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <SheetDialogContent title={title} onClose={onClose} footer={footer}>
      {children}
    </SheetDialogContent>
  );
}

function SheetDialogContent({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="sheet-dialog m-0 mt-auto max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] w-full max-w-none overflow-hidden rounded-t-2xl border border-line bg-surface p-0 text-ink sm:m-auto sm:max-h-[min(720px,calc(100dvh-3rem))] sm:max-w-lg sm:rounded-2xl"
    >
      <div className="flex max-h-[inherit] min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4 sm:px-6">
          <h2 id={titleId} className="text-xl font-semibold tracking-[-0.02em]">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition hover:bg-surface-soft hover:text-ink"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {children}
        </div>
        {footer ? (
          <footer className="shrink-0 border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
