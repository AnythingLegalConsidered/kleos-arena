import { redis } from '@devvit/web/server';
import { createDefaultStable, parseStable } from '../../shared/stable';
import { applySettlement, type ArenaSettlement } from '../../shared/daily';
import type { ActionResult, Stable } from '../../shared/stable';
import { SETTLEMENT_ATTEMPTS, delay } from './settlement';

export function stableKey(username: string): string {
  return `stable:${username}`;
}

export async function loadStable(username: string): Promise<Stable | null> {
  return parseStable(await redis.get(stableKey(username)));
}

export async function loadOrCreateStable(username: string): Promise<Stable> {
  const existing = await loadStable(username);
  if (existing) return existing;
  const fresh = createDefaultStable(username, username);
  await saveStable(fresh);
  return fresh;
}

export async function saveStable(stable: Stable): Promise<void> {
  await redis.set(stableKey(stable.ownerId), JSON.stringify(stable));
}

// Stable spends (gold) must read-modify-write under WATCH: the same key is
// credited transactionally by settlements, so a plain load-mutate-save would
// silently drop a concurrent payout (lost-update, DEBT-001). A rejected
// mutation (ok === false) writes nothing; an aborted EXEC retries.
export async function mutateStableAtomically(
  username: string,
  mutate: (stable: Stable) => ActionResult
): Promise<{ result: ActionResult; stable: Stable }> {
  await loadOrCreateStable(username);
  for (let attempt = 0; attempt < SETTLEMENT_ATTEMPTS; attempt++) {
    const transaction = await redis.watch(stableKey(username));
    const stable = await loadOrCreateStable(username);
    const result = mutate(stable);
    if (!result.ok) {
      await transaction.unwatch();
      return { result, stable };
    }
    await transaction.multi();
    await transaction.set(stableKey(username), JSON.stringify(stable));
    const results = await transaction.exec();
    if (results && results.length === 1) return { result, stable };
    await delay(50);
  }
  throw new Error('stable is busy');
}

export async function applyArenaSettlement(
  day: string,
  settlement: ArenaSettlement
): Promise<boolean> {
  const claimKey = `arena:settled:${day}`;
  // Claim and credit must commit in the same MULTI: a crash between the two
  // would otherwise mark the owner settled without ever applying it (DEBT-001).
  await loadOrCreateStable(settlement.ownerId);
  for (let attempt = 0; attempt < SETTLEMENT_ATTEMPTS; attempt++) {
    const transaction = await redis.watch(
      claimKey,
      stableKey(settlement.ownerId)
    );
    if (await redis.hGet(claimKey, settlement.ownerId)) {
      await transaction.unwatch();
      return false;
    }
    const stable = await loadOrCreateStable(settlement.ownerId);
    applySettlement(stable, settlement);
    await transaction.multi();
    await transaction.hSet(claimKey, { [settlement.ownerId]: 'claimed' });
    await transaction.set(stableKey(settlement.ownerId), JSON.stringify(stable));
    const results = await transaction.exec();
    if (results && results.length === 2) return true;
    await delay(50);
  }
  throw new Error('arena settlement is busy');
}
