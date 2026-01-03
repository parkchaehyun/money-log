"use client";

import { useEffect, useMemo, useState } from "react";

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

export function SelectionSheet({
  open,
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

  useEffect(() => {
    if (!open) {
      setQuery("");
      setNewName("");
      setIsCreating(false);
    }
  }, [open]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) =>
      item.label.toLowerCase().includes(normalized)
    );
  }, [items, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 sm:items-center sm:pb-0">
      <div
        className="absolute inset-0 bg-black/40"
        role="button"
        tabIndex={-1}
        onClick={onClose}
        aria-label="Close selector"
      />
      <div className="relative w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
              Select
            </p>
            <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500 hover:text-zinc-900"
          >
            Close
          </button>
        </div>

        <input
          className="mt-4 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
          placeholder={`Search ${title.toLowerCase()}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        {onCreate && createLabel ? (
          <form
            className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const trimmed = newName.trim();
              if (!trimmed) {
                return;
              }
              setIsCreating(true);
              await onCreate(trimmed);
              setIsCreating(false);
              setNewName("");
            }}
          >
            <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">
              {createLabel}
            </label>
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={createPlaceholder ?? `New ${title.toLowerCase()}`}
              />
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition disabled:bg-zinc-400"
              >
                Add
              </button>
            </div>
          </form>
        ) : null}

        {onClear ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="mt-4 w-full rounded-2xl border border-dashed border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
          >
            {clearLabel ?? "Clear selection"}
          </button>
        ) : null}

        <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl border border-zinc-100 bg-zinc-50/60 p-2">
          {filteredItems.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No matches yet.</p>
          ) : (
            <ul className="space-y-2">
              {filteredItems.map((item) => {
                const isActive = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item.id);
                        onClose();
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                        isActive
                          ? "bg-zinc-900 text-white"
                          : "bg-white text-zinc-700 hover:text-zinc-900"
                      }`}
                    >
                      <div>
                        <p className="font-medium">{item.label}</p>
                        {item.subLabel ? (
                          <p
                            className={`text-xs ${
                              isActive ? "text-white/70" : "text-zinc-400"
                            }`}
                          >
                            {item.subLabel}
                          </p>
                        ) : null}
                      </div>
                      {isActive ? (
                        <span className="text-xs uppercase tracking-[0.3em] text-white/70">
                          Selected
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
