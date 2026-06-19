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

export async function applyArenaSettlement(
  day: string,
  settlement: ArenaSettlement
): Promise<boolean> {
  const claimKey = `arena:settled:${day}`;
  const claimed = await redis.hSetNX(claimKey, settlement.ownerId, 'claimed');
  if (claimed === 0) return false;

  try {
    const stable = await loadOrCreateStable(settlement.ownerId);
    applySettlement(stable, settlement);
    await saveStable(stable);
    return true;
  } catch (error) {
    await redis.hDel(claimKey, [settlement.ownerId]);
    throw error;
  }
}
