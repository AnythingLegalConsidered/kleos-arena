import { redis } from '@devvit/web/server';
import { createDefaultStable, parseStable } from '../../shared/stable';
import { applySettlement, type ArenaSettlement } from '../../shared/daily';
import type { Stable } from '../../shared/stable';

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

const SETTLEMENT_ATTEMPTS = 20;

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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
