// Keep the first row for each (case-insensitive) key, preserving input order,
// up to `limit`. Used to collapse search results to distinct merchants /
// income sources while keeping the most recent match per name.
export function dedupeByKey<T>(
  rows: T[],
  key: (row: T) => string,
  limit: number
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    const k = key(row).toLowerCase();
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    result.push(row);
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}
