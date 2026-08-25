"use client";

import { useId, useMemo, useState } from "react";

import { SheetDialog } from "@/components/sheet-dialog";

type SelectionItem = { id: string; label: string; subLabel?: string | null };

type MultiSelectionSheetProps = {
  open: boolean;
  title: string;
  items: SelectionItem[];
  selectedIds: string[];
  onClose: () => void;
  onToggle: (id: string) => void;
  onCreate?: (name: string) => Promise<void>;
  createLabel?: string;
  modeOptions?: { id: string; label: string }[];
  modeValue?: string;
  onModeChange?: (id: string) => void;
  onClear?: () => void;
  clearLabel?: string;
};

export function MultiSelectionSheet(props: MultiSelectionSheetProps) {
  if (!props.open) {
    return null;
  }
  return <MultiSelectionSheetContent {...props} />;
}

function MultiSelectionSheetContent({
  title,
  items,
  selectedIds,
  onClose,
  onToggle,
  onCreate,
  createLabel,
  modeOptions,
  modeValue,
  onModeChange,
  onClear,
  clearLabel,
}: MultiSelectionSheetProps) {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const searchId = useId();
  const createId = useId();
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? items.filter((item) => item.label.toLowerCase().includes(normalized))
      : items;
  }, [items, query]);

  return (
    <SheetDialog
      open
      title={title}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong"
        >
          Done{selectedIds.length ? ` · ${selectedIds.length}` : ""}
        </button>
      }
    >
      <label htmlFor={searchId} className="text-sm font-medium text-ink-soft">
        Search
      </label>
      <input
        id={searchId}
        className="mt-2 w-full rounded-xl border border-line px-4 py-2 text-base transition focus:border-accent"
        placeholder={title}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />

      <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm text-muted">{selectedIds.length} selected</span>
        {onClear && selectedIds.length ? (
          <button type="button" onClick={onClear} className="rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-soft hover:text-ink">
            {clearLabel ?? "Clear"}
          </button>
        ) : null}
      </div>

      {modeOptions && modeValue && onModeChange ? (
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-surface-soft p-1" aria-label="Match mode">
          {modeOptions.map((option) => {
            const isActive = modeValue === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onModeChange(option.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${isActive ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {onCreate && createLabel ? (
        <form
          className="mt-4 border-t border-line pt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const trimmed = newName.trim();
            if (!trimmed || isCreating) return;
            setCreateError(null);
            setIsCreating(true);
            try {
              await onCreate(trimmed);
              setNewName("");
            } catch {
              setCreateError("Couldn’t add.");
            } finally {
              setIsCreating(false);
            }
          }}
        >
          <label htmlFor={createId} className="text-sm font-medium text-ink-soft">{createLabel}</label>
          <div className="mt-2 flex gap-2">
            <input id={createId} className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-base focus:border-accent" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={`New ${title.toLowerCase()}`} />
            <button type="submit" disabled={isCreating || !newName.trim()} className="rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong disabled:bg-muted">
              {isCreating ? "Adding…" : "Add"}
            </button>
          </div>
          {createError ? <p role="alert" className="mt-2 text-sm text-danger">{createError}</p> : null}
        </form>
      ) : null}

      <ul className="mt-4 space-y-1" aria-label={title}>
        {filteredItems.length === 0 ? (
          <li className="px-2 py-4 text-sm text-muted">No matches</li>
        ) : (
          filteredItems.map((item) => {
            const isActive = selectedIds.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onToggle(item.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${isActive ? "bg-ink text-white" : "text-ink-soft hover:bg-surface-soft hover:text-ink"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.label}</span>
                    {item.subLabel ? <span className={`block truncate text-xs ${isActive ? "text-white/75" : "text-muted"}`}>{item.subLabel}</span> : null}
                  </span>
                  <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded border ${isActive ? "border-white/60 bg-white/15" : "border-line-strong"}`}>
                    {isActive ? (
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path d="m5 10 3 3 7-7" />
                      </svg>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </SheetDialog>
  );
}
