"use client";

import { useId, useMemo, useState } from "react";

import { SheetDialog } from "@/components/sheet-dialog";

type PaymentSelectionItem = {
  id: string;
  label: string;
  subLabel?: string | null;
  type: "CARD" | "CASH_TRANSFER";
};

type PaymentSelectionSheetProps = {
  open: boolean;
  items: PaymentSelectionItem[];
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
};

export function PaymentSelectionSheet(props: PaymentSelectionSheetProps) {
  if (!props.open) return null;
  return <PaymentSelectionSheetContent {...props} />;
}

function PaymentSelectionSheetContent({ items, selectedId, onClose, onSelect, onCreate }: PaymentSelectionSheetProps) {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const searchId = useId();
  const createId = useId();
  const cash = items.find((item) => item.type === "CASH_TRANSFER");
  const cards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const cardItems = items.filter((item) => item.type === "CARD");
    return normalized
      ? cardItems.filter((item) => item.label.toLowerCase().includes(normalized))
      : cardItems;
  }, [items, query]);
  const select = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <SheetDialog open title="Payment method" onClose={onClose}>
      {cash ? (
        <button
          type="button"
          aria-pressed={cash.id === selectedId}
          onClick={() => select(cash.id)}
          className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium ${cash.id === selectedId ? "bg-ink text-white" : "bg-surface-soft text-ink hover:bg-accent-soft"}`}
        >
          Cash
          {cash.id === selectedId ? <span className="text-xs text-white/75">Selected</span> : null}
        </button>
      ) : null}

      <div className="mt-4 border-t border-line pt-4">
        <label htmlFor={searchId} className="text-sm font-medium text-ink-soft">Cards</label>
        <input id={searchId} className="mt-2 w-full rounded-xl border border-line px-4 py-2 text-base focus:border-accent" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus={!cash} />
      </div>

      <form
        className="mt-4"
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
        <label htmlFor={createId} className="sr-only">New card</label>
        <div className="flex gap-2">
          <input id={createId} className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-base focus:border-accent" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="New card" />
          <button type="submit" disabled={isCreating || !newName.trim()} className="rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong disabled:bg-muted">
            {isCreating ? "Adding…" : "Add"}
          </button>
        </div>
        {createError ? <p role="alert" className="mt-2 text-sm text-danger">{createError}</p> : null}
      </form>

      <ul className="mt-4 space-y-1" aria-label="Cards">
        {cards.length === 0 ? <li className="px-2 py-4 text-sm text-muted">No matches</li> : cards.map((item) => {
          const active = item.id === selectedId;
          return (
            <li key={item.id}>
              <button type="button" aria-pressed={active} onClick={() => select(item.id)} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm ${active ? "bg-ink text-white" : "text-ink-soft hover:bg-surface-soft"}`}>
                <span className="min-w-0"><span className="block truncate font-medium">{item.label}</span>{item.subLabel ? <span className={`block truncate text-xs ${active ? "text-white/75" : "text-muted"}`}>{item.subLabel}</span> : null}</span>
                {active ? <span className="text-xs text-white/75">Selected</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </SheetDialog>
  );
}
