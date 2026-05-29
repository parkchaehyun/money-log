import { disassemble } from "es-hangul";

// Match on the jamo (자모) level so partial Hangul composition matches as the
// user types: e.g. typing 월 (ㅇ → 우 → 워 → 월) matches "월요일" at every step,
// because each intermediate syllable disassembles to a prefix of the target.
// Non-Hangul text passes through unchanged, so English/number matching still
// works (lowercased for case-insensitivity).
const normalize = (value: string) => disassemble(value.toLowerCase());

export function hangulIncludes(text: string, query: string): boolean {
  const q = normalize(query);
  if (!q) {
    return false;
  }
  return normalize(text).includes(q);
}
