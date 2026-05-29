"use client";

import { useMemo, useState } from "react";

import { disassembleHangul } from "@/lib/hangul-search";

type AutocompleteFieldProps<T> = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  /** Full distinct candidate list; filtered client-side as the user types. */
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

  const matches = useMemo(() => {
    const query = disassembleHangul(value.trim());
    if (!query) {
      return [];
    }
    // Rank prefix matches above internal-substring matches; within each tier
    // the incoming order (most-recently-used first) is preserved. Exact
    // matches are kept so a past entry can be reselected to reuse its amount.
    const prefix: T[] = [];
    const substring: T[] = [];
    for (const item of items) {
      const name = disassembleHangul(getPrimary(item));
      if (name.startsWith(query)) {
        prefix.push(item);
      } else if (name.includes(query)) {
        substring.push(item);
      }
    }
    return [...prefix, ...substring].slice(0, maxResults);
  }, [value, items, getPrimary, maxResults]);

  const open = focused && matches.length > 0;

  return (
    <div>
      <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
        {label}
      </label>
      <div className="relative">
        <input
          className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          autoComplete="off"
        />
        {open ? (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto overflow-x-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg">
            {matches.map((item) => {
              const secondary = getSecondary?.(item);
              const trailing = getTrailing?.(item);
              return (
                <li key={getKey(item)}>
                  <button
                    type="button"
                    // Prevent the input's blur from firing before the click.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelect(item);
                      setFocused(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-900">
                        {getPrimary(item)}
                      </span>
                      {secondary ? (
                        <span className="block truncate text-xs text-zinc-400">
                          {secondary}
                        </span>
                      ) : null}
                    </span>
                    {trailing ? (
                      <span className="shrink-0 text-sm font-semibold text-zinc-400">
                        {trailing}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
