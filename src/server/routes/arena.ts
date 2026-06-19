import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type {
  ArenaBetRequest,
  ArenaBetResponse,
  ArenaEntryResponse,
  ArenaErrorResponse,
  ArenaStatusResponse,
} from '../../shared/api';
import { godById } from '../../shared/daily';
import {
  enterCurrentArena,
  getCurrentArenaStatus,
  placeCurrentBet,
} from '../core/dailyArena';
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
    featuredMatches: status.featuredMatches
      .filter(
        (match) =>
          match.teamA.ownerId !== username && match.teamB.ownerId !== username
      )
      .map((match) => ({
        id: match.id,
        teamA: {
          id: match.teamA.id,
          name: match.teamA.name,
          odds: match.oddsA,
          fervor: status.fervor[match.teamA.id] ?? 0,
        },
        teamB: {
          id: match.teamB.id,
          name: match.teamB.name,
          odds: match.oddsB,
          fervor: status.fervor[match.teamB.id] ?? 0,
        },
      })),
    bets: status.bets,
    latestBetPayout: status.latestBetPayout,
  });
});

arena.post('/bet', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const request = parseBetRequest(await c.req.json().catch(() => null));
  if (!request) {
    return c.json<ArenaErrorResponse>(
      { type: 'error', error: 'invalid bet' },
      400
    );
  }

  try {
    const result = await placeCurrentBet(
      username,
      request.matchId,
      request.teamId,
      request.stake
    );
    return c.json<ArenaBetResponse>({ type: 'bet', ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed to bet';
    return c.json<ArenaErrorResponse>({ type: 'error', error: message }, 409);
  }
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

function parseBetRequest(value: unknown): ArenaBetRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('matchId' in value) || typeof value.matchId !== 'string') return null;
  if (!('teamId' in value) || typeof value.teamId !== 'string') return null;
  if (!('stake' in value) || typeof value.stake !== 'number') return null;
  return {
    matchId: value.matchId,
    teamId: value.teamId,
    stake: value.stake,
  };
}
