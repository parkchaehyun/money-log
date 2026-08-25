"use client";

import { useId, useMemo, useState } from "react";

import { filterAutocompleteItems } from "@/lib/ui-behavior";

type AutocompleteFieldProps<T> = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  items: T[];
  onSelect: (item: T) => void;
  onBlur?: () => void;
  getKey: (item: T) => string;
  getPrimary: (item: T) => string;
  getSecondary?: (item: T) => string | null;
  getTrailing?: (item: T) => string | null;
  maxResults?: number;
};

export function AutocompleteField<T>({
  label,
  placeholder,
  value,
  onChange,
  items,
  onSelect,
  onBlur,
  getKey,
  getPrimary,
  getSecondary,
  getTrailing,
  maxResults = 8,
}: AutocompleteFieldProps<T>) {
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputId = useId();
  const listId = useId();
  const matches = useMemo(
    () => filterAutocompleteItems(items, value, getPrimary, maxResults),
    [getPrimary, items, maxResults, value]
  );
  const open = focused && !dismissed && matches.length > 0;
  const safeIndex = matches.length ? Math.min(activeIndex, matches.length - 1) : 0;

  const choose = (item: T) => {
    onSelect(item);
    setDismissed(true);
  };

  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-medium text-ink-soft">{label}</label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${safeIndex}` : undefined}
          className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-base transition focus:border-accent"
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setDismissed(false);
            setActiveIndex(0);
          }}
          onFocus={() => {
            setFocused(true);
            setDismissed(false);
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          onKeyDown={(event) => {
            if (!matches.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setDismissed(false);
              setActiveIndex((index) => (index + 1) % matches.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setDismissed(false);
              setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              choose(matches[safeIndex]);
            } else if (event.key === "Escape") {
              setDismissed(true);
            }
          }}
          autoComplete="off"
        />
        {open ? (
          <ul id={listId} role="listbox" className="scrollbar-subtle absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
            {matches.map((item, index) => {
              const secondary = getSecondary?.(item);
              const trailing = getTrailing?.(item);
              const active = index === safeIndex;
              return (
                <li
                  id={`${listId}-${index}`}
                  key={getKey(item)}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                  className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${active ? "bg-accent-soft" : "hover:bg-surface-soft"}`}
                >
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-ink">{getPrimary(item)}</span>{secondary ? <span className="block truncate text-xs text-muted">{secondary}</span> : null}</span>
                  {trailing ? <span className="financial-number shrink-0 text-sm font-semibold text-muted">{trailing}</span> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
