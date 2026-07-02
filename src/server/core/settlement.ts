// Shared retry knobs for the WATCH/MULTI/EXEC settlement transactions: a
// bounded number of attempts with a short pause between aborted EXECs.
// Extracted from dailyArena.ts / stableStore.ts where they were duplicated
// (DEBT-013). Values unchanged.
export const SETTLEMENT_ATTEMPTS = 20;

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
