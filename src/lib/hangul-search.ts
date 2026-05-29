import { disassemble } from "es-hangul";

// Disassemble text to its jamo (자모) sequence so partial Hangul composition
// matches as the user types: 월 (ㅇ → 우 → 워 → 월) decomposes such that each
// intermediate syllable is a prefix of the target. Lowercased so English /
// number matching stays case-insensitive; non-Hangul passes through unchanged.
export const disassembleHangul = (value: string) =>
  disassemble(value.toLowerCase());
