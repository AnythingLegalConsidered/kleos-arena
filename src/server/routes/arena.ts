import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type {
  ArenaEntryResponse,
  ArenaErrorResponse,
  ArenaStatusResponse,
} from '../../shared/api';
import { godById } from '../../shared/daily';
import { enterCurrentArena, getCurrentArenaStatus } from '../core/dailyArena';
import { loadOrCreateStable } from '../core/stableStore';

export const arena = new Hono();

arena.get('/', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const status = await getCurrentArenaStatus(username);
  const qualifier = status.entry
    ? {
        opponentName: status.entry.qualifier.opponent.name,
        won: status.entry.qualifier.won,
        ticks: status.entry.qualifier.ticks,
      }
    : null;

  return c.json<ArenaStatusResponse>({
    type: 'arena',
    day: status.arena.day,
    god: godById(status.arena.godId),
    status: status.arena.status,
    postId: status.arena.postId,
    participantCount: status.participantCount,
    qualifier,
    result: status.latestSettlement,
  });
});

arena.post('/enter', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const stable = await loadOrCreateStable(username);
  try {
    const {
      arena: daily,
      entry,
      participantCount,
    } = await enterCurrentArena(stable);
    return c.json<ArenaEntryResponse>({
      type: 'arena-entry',
      day: daily.day,
      god: godById(daily.godId),
      participantCount,
      qualifier: {
        opponentName: entry.qualifier.opponent.name,
        won: entry.qualifier.won,
        ticks: entry.qualifier.ticks,
        config: entry.qualifier.config,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'failed to enter arena';
    return c.json<ArenaErrorResponse>({ type: 'error', error: message }, 409);
  }
});
