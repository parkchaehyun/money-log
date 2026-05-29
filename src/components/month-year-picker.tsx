"use client";

import { useEffect, useRef, useState } from "react";

type MonthOption = { value: string; label: string };
type YearGroup = { year: number; months: MonthOption[] };

type MonthYearPickerProps = {
  value: string; // "" (custom), "YYYY" (whole year), or "YYYY-MM"
  groups: YearGroup[];
  onSelect: (value: string) => void;
};

// The closed control must show the year (so "May 2026" is unambiguous), while
// the open list shows a clickable year row + plain month rows under it —
// neither of which a native <select>/<optgroup> can do, hence this component.
const triggerLabel = (value: string) => {
  if (!value) return "Custom range";
  if (!value.includes("-")) return value; // whole year
  const [y, m] = value.split("-").map(Number);
  const month = new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
  });
  return `${month} ${y}`;
};

export function MonthYearPicker({
  value,
  groups,
  onSelect,
}: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next: string) => {
    onSelect(next);
    setOpen(false);
  };

  const rowBase =
    "flex w-full items-center justify-between px-4 py-2 text-left text-sm transition";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mt-2 flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
      >
        <span>{triggerLabel(value)}</span>
        <span className="text-xs text-zinc-400">▾</span>
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <li>
            <button
              type="button"
              onClick={() => choose("")}
              className={`${rowBase} ${
                value === "" ? "text-zinc-900" : "text-zinc-500"
              } hover:bg-zinc-50`}
            >
              Custom range
            </button>
          </li>
          {groups.map((group) => {
            const yearValue = String(group.year);
            return (
              <li key={group.year} className="border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => choose(yearValue)}
                  className={`${rowBase} font-semibold hover:bg-zinc-50 ${
                    value === yearValue ? "text-zinc-900" : "text-zinc-700"
                  }`}
                >
                  {group.year}
                </button>
                {group.months.map((month) => (
                  <button
                    key={month.value}
                    type="button"
                    onClick={() => choose(month.value)}
                    className={`${rowBase} pl-8 hover:bg-zinc-50 ${
                      value === month.value
                        ? "font-medium text-zinc-900"
                        : "text-zinc-500"
                    }`}
                  >
                    {month.label}
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
