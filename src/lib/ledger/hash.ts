/** Deterministic content hash for ledger integrity (browser + Node safe). */
export function hashLedgerContent(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return `lh${(h >>> 0).toString(16)}`;
}

export function hashLedgerPayload(payload: Record<string, unknown>): string {
  return hashLedgerContent(JSON.stringify(payload));
}
