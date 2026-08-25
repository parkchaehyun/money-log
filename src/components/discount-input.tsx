"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const formatter = new Intl.NumberFormat("ko-KR");
const ratePresets = [5, 10, 20, 30];

export type DiscountMode = "amount" | "percent" | "paid";

export type DiscountInputMeta = {
  error: string | null;
  mode: DiscountMode;
};

type DiscountInputProps = {
  grossValue: string;
  discountValue: string;
  onValueChange: (value: string, meta: DiscountInputMeta) => void;
  className?: string;
  compact?: boolean;
  label?: string;
  showSummary?: boolean;
};

const parseWholeNumber = (value: string) => {
  const parsed = Number.parseInt(value || "0", 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sanitizeWholeNumber = (value: string) => value.replace(/[^\d]/g, "");

const sanitizePercentage = (value: string) => {
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = cleaned.split(".");
  if (decimalParts.length === 0) {
    return whole;
  }
  return `${whole}.${decimalParts.join("").slice(0, 1)}`;
};

const formatWholeNumber = (value: string) => {
  if (!value) {
    return "";
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? "" : formatter.format(parsed);
};

const formatRate = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const calculateDiscount = ({
  mode,
  grossCents,
  discountValue,
  calculationInput,
}: {
  mode: DiscountMode;
  grossCents: number;
  discountValue: string;
  calculationInput: string;
}) => {
  if (mode === "amount") {
    const discountCents = parseWholeNumber(discountValue);
    const error =
      discountCents > 0 && grossCents <= 0
        ? "Enter an amount before adding a discount."
        : grossCents > 0 && discountCents > grossCents
          ? "Discount cannot exceed the amount."
          : null;

    return {
      discountValue: sanitizeWholeNumber(discountValue),
      error,
    };
  }

  if (!calculationInput) {
    return { discountValue: "", error: null };
  }

  if (mode === "percent") {
    const rate = Number.parseFloat(calculationInput);
    if (!Number.isFinite(rate)) {
      return { discountValue: "", error: null };
    }
    if (rate > 100) {
      return {
        discountValue:
          grossCents > 0
            ? String(Math.round((grossCents * rate) / 100))
            : "",
        error: "Discount rate cannot exceed 100%.",
      };
    }
    if (grossCents <= 0) {
      return {
        discountValue: "",
        error: "Enter an amount to calculate the discount.",
      };
    }
    return {
      discountValue: String(Math.round((grossCents * rate) / 100)),
      error: null,
    };
  }

  const paidCents = parseWholeNumber(calculationInput);
  if (grossCents <= 0) {
    return {
      discountValue: "",
      error: "Enter an amount to calculate the discount.",
    };
  }
  if (paidCents > grossCents) {
    return {
      discountValue: "",
      error: "Paid amount cannot exceed the original amount.",
    };
  }
  return {
    discountValue: String(grossCents - paidCents),
    error: null,
  };
};

export function DiscountInput({
  grossValue,
  discountValue,
  onValueChange,
  className,
  compact = false,
  label = "Discount",
  showSummary = true,
}: DiscountInputProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [mode, setMode] = useState<DiscountMode>("amount");
  const [calculationInput, setCalculationInput] = useState("");
  const skipNextDerivedUpdate = useRef(false);
  const onValueChangeRef = useRef(onValueChange);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  const grossCents = parseWholeNumber(grossValue);
  const discountCents = parseWholeNumber(discountValue);

  const calculation = useMemo(
    () =>
      calculateDiscount({
        mode,
        grossCents,
        discountValue,
        calculationInput,
      }),
    [calculationInput, discountValue, grossCents, mode]
  );

  useEffect(() => {
    if (skipNextDerivedUpdate.current) {
      skipNextDerivedUpdate.current = false;
      return;
    }
    onValueChangeRef.current(calculation.discountValue, {
      error: calculation.error,
      mode,
    });
  }, [calculation.discountValue, calculation.error, mode]);

  const changeMode = (nextMode: DiscountMode) => {
    if (nextMode === mode) {
      return;
    }

    let nextCalculationInput = "";
    if (nextMode === "percent") {
      nextCalculationInput =
        grossCents > 0 && discountCents > 0
          ? formatRate((discountCents / grossCents) * 100)
          : "";
    } else if (nextMode === "paid") {
      nextCalculationInput =
        grossCents > 0 ? String(Math.max(0, grossCents - discountCents)) : "";
    }

    const currentAmountCalculation = calculateDiscount({
      mode: "amount",
      grossCents,
      discountValue,
      calculationInput: "",
    });
    const nextCalculation = calculateDiscount({
      mode: nextMode,
      grossCents,
      discountValue,
      calculationInput: nextCalculationInput,
    });

    const preserveCurrentDiscount = !currentAmountCalculation.error;
    setCalculationInput(nextCalculationInput);
    skipNextDerivedUpdate.current = preserveCurrentDiscount;
    setMode(nextMode);
    onValueChangeRef.current(
      preserveCurrentDiscount
        ? discountValue
        : nextCalculation.discountValue,
      {
        error: nextCalculation.error,
        mode: nextMode,
      }
    );
  };

  const displayedValue =
    mode === "amount"
      ? formatWholeNumber(discountValue)
      : mode === "paid"
        ? formatWholeNumber(calculationInput)
        : calculationInput;
  const paidCents = Math.max(0, grossCents - discountCents);
  const effectiveRate =
    grossCents > 0 && discountCents > 0
      ? formatRate((discountCents / grossCents) * 100)
      : null;
  const inputPadding = mode === "percent" ? "pl-4 pr-10" : "pl-9 pr-4";
  const inputSizing = compact
    ? "rounded-xl py-2 text-sm"
    : "rounded-2xl py-3 text-base font-semibold";

  return (
    <div className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={inputId} className="text-xs font-medium text-ink-soft">
          {label}
        </label>
        <div
          role="radiogroup"
          aria-label="Discount input type"
          className="grid grid-cols-3 rounded-xl bg-surface-soft p-1"
        >
          {[
            { id: "amount" as const, label: "₩ Off" },
            { id: "percent" as const, label: "% Off" },
            { id: "paid" as const, label: "Paid" },
          ].map((option) => {
            const selected = option.id === mode;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => changeMode(option.id)}
                className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition motion-reduce:transition-none ${
                  selected
                    ? "bg-surface text-ink shadow-sm"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-2">
        {mode !== "percent" ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
            ₩
          </span>
        ) : null}
        <input
          id={inputId}
          inputMode={mode === "percent" ? "decimal" : "numeric"}
          aria-label={
            mode === "amount"
              ? "Discount amount"
              : mode === "percent"
                ? "Discount percentage"
                : "Paid amount"
          }
          aria-invalid={Boolean(calculation.error)}
          aria-describedby={calculation.error ? errorId : undefined}
          className={`w-full border bg-surface text-ink transition placeholder:text-muted motion-reduce:transition-none focus:border-accent ${
            calculation.error ? "border-danger" : "border-line"
          } ${inputPadding} ${inputSizing}`}
          placeholder="0"
          value={displayedValue}
          onChange={(event) => {
            if (mode === "amount") {
              const nextValue = sanitizeWholeNumber(event.target.value);
              const nextCalculation = calculateDiscount({
                mode,
                grossCents,
                discountValue: nextValue,
                calculationInput: "",
              });
              onValueChangeRef.current(nextCalculation.discountValue, {
                error: nextCalculation.error,
                mode,
              });
              return;
            }
            setCalculationInput(
              mode === "percent"
                ? sanitizePercentage(event.target.value)
                : sanitizeWholeNumber(event.target.value)
            );
          }}
        />
        {mode === "percent" ? (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
            %
          </span>
        ) : null}
      </div>

      {mode === "percent" ? (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Common discount rates">
          {ratePresets.map((rate) => {
            const selected = Number.parseFloat(calculationInput) === rate;
            return (
              <button
                key={rate}
                type="button"
                aria-pressed={selected}
                onClick={() => setCalculationInput(String(rate))}
                className={`min-h-9 min-w-14 rounded-full px-3 text-xs font-semibold transition motion-reduce:transition-none ${
                  selected
                    ? "bg-ink text-surface"
                    : "bg-surface-soft text-ink-soft hover:text-ink"
                }`}
              >
                {rate}%
              </button>
            );
          })}
        </div>
      ) : null}

      {calculation.error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
          {calculation.error}
        </p>
      ) : null}

      {showSummary && grossCents > 0 && !calculation.error ? (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-soft"
          aria-live="polite"
        >
          <span>
            Saved{" "}
            <strong className="financial-number font-semibold text-ink">
              ₩{formatter.format(discountCents)}
            </strong>
            {effectiveRate ? ` · ${effectiveRate}%` : ""}
          </span>
          <span>
            Paid{" "}
            <strong className="financial-number text-sm font-semibold text-ink">
              ₩{formatter.format(paidCents)}
            </strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}
