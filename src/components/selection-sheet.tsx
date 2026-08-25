"use client";

import { useId, useMemo, useState } from "react";

import { SheetDialog } from "@/components/sheet-dialog";

type SelectionItem = {
  id: string;
  label: string;
  subLabel?: string | null;
};

type SelectionSheetProps = {
  open: boolean;
  title: string;
  items: SelectionItem[];
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate?: (name: string) => Promise<void>;
  createLabel?: string;
  createPlaceholder?: string;
  clearLabel?: string;
  onClear?: () => void;
};

export function SelectionSheet(props: SelectionSheetProps) {
  if (!props.open) {
    return null;
  }
  return <SelectionSheetContent {...props} />;
}

function SelectionSheetContent({
  title,
  items,
  selectedId,
  onClose,
  onSelect,
  onCreate,
  createLabel,
  createPlaceholder,
  clearLabel,
  onClear,
}: SelectionSheetProps) {
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
    <SheetDialog open title={title} onClose={onClose}>
      <label htmlFor={searchId} className="text-sm font-medium text-ink-soft">
        Search
      </label>
      <input
        id={searchId}
        className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-2 text-base transition focus:border-accent"
        placeholder={title}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />

      {onCreate && createLabel ? (
        <form
          className="mt-4 border-t border-line pt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const trimmed = newName.trim();
            if (!trimmed || isCreating) {
              return;
            }
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
          <label htmlFor={createId} className="text-sm font-medium text-ink-soft">
            {createLabel}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id={createId}
              className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-base transition focus:border-accent"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={createPlaceholder ?? `New ${title.toLowerCase()}`}
            />
            <button
              type="submit"
              disabled={isCreating || !newName.trim()}
              className="rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:bg-muted"
            >
              {isCreating ? "Adding…" : "Add"}
            </button>
          </div>
          {createError ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {createError}
            </p>
          ) : null}
        </form>
      ) : null}

      {onClear ? (
        <button
          type="button"
          onClick={() => {
            onClear();
            onClose();
          }}
          className="mt-4 w-full rounded-xl border border-dashed border-line-strong px-4 py-2 text-left text-sm font-medium text-muted transition hover:border-ink hover:text-ink"
        >
          {clearLabel ?? "Clear"}
        </button>
      ) : null}

      <ul className="mt-4 space-y-1" aria-label={title}>
        {filteredItems.length === 0 ? (
          <li className="px-2 py-4 text-sm text-muted">No matches</li>
        ) : (
          filteredItems.map((item) => {
            const isActive = item.id === selectedId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${
                    isActive
                      ? "bg-ink text-white"
                      : "text-ink-soft hover:bg-surface-soft hover:text-ink"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.label}</span>
                    {item.subLabel ? (
                      <span className={`block truncate text-xs ${isActive ? "text-white/75" : "text-muted"}`}>
                        {item.subLabel}
                      </span>
                    ) : null}
                  </span>
                  {isActive ? <span className="text-xs text-white/75">Selected</span> : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </SheetDialog>
  );
}
