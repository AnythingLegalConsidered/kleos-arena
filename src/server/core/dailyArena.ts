import { redis } from '@devvit/web/server';
import {
  DAILY_ARENA_VERSION,
  createDailyArena,
  createFeaturedMatches,
  enterArena,
  godById,
  resolveArena,
  snapshotStable,
  utcDay,
} from '../../shared/daily';
import {
  BET_STAKES,
  applyBetPayout,
  fervorFromBets,
  settleBets,
} from '../../shared/betting';
import type {
  ArenaBet,
  BetPayout,
  FeaturedMatch,
  FervorByTeam,
} from '../../shared/betting';
import type {
  ArenaEntry,
  ArenaSettlement,
  DailyArena,
  GodId,
  TeamSnapshot,
} from '../../shared/daily';
import type { BattleConfig, UnitSpec, WeaponArchetype } from '../../shared/sim';
import { parseStable } from '../../shared/stable';
import type { Stable } from '../../shared/stable';
import { createPost } from './post';
import {
  applyArenaSettlement,
  loadOrCreateStable,
  saveStable,
  stableKey,
} from './stableStore';

const GHOSTS_KEY = 'arena:ghosts';
const LATEST_RESOLVED_KEY = 'arena:latest-resolved';
const POST_CLAIMS_KEY = 'arena:post-claims';
const BETTING_LOCK_TTL_MS = 120_000;

export type ArenaStatus = {
  arena: DailyArena;
  entry: ArenaEntry | null;
  latestSettlement: ArenaSettlement | null;
  participantCount: number;
  featuredMatches: FeaturedMatch[];
  bets: ArenaBet[];
  fervor: FervorByTeam;
  latestBetPayout: number | null;
};

export async function getCurrentArenaStatus(
  username: string,
  now = new Date()
): Promise<ArenaStatus> {
  const day = utcDay(now);
  const arena = await loadDailyArena(day);
  const entries =
    arena.status === 'resolved' ? arena.entries : await loadEntries(day);
  const entry =
    entries.find((candidate) => candidate.team.ownerId === username) ?? null;
  const featuredMatches =
    arena.status === 'open'
      ? await ensureFeaturedMatches(
          day,
          entries.map((candidate) => candidate.team),
          await loadGhosts(),
          arena.godId
        )
      : await loadFeaturedMatches(day);
  const bets = await loadBets(day);
  return {
    arena,
    entry,
    latestSettlement: await getLatestSettlement(username),
    participantCount: entries.length,
    featuredMatches,
    bets: bets.filter((bet) => bet.ownerId === username),
    fervor: fervorFromBets(bets),
    latestBetPayout: await getLatestBetPayout(username),
  };
}

export async function placeCurrentBet(
  username: string,
  matchId: string,
  teamId: string,
  stake: number,
  now = new Date()
): Promise<{ bet: ArenaBet; gold: number }> {
  if (!BET_STAKES.some((allowed) => allowed === stake))
    throw new Error('invalid stake');

  const day = utcDay(now);
  return withBettingLock(day, async () => {
    const arena = await loadDailyArena(day);
    if (arena.status !== 'open') throw new Error('betting is closed');

    const entries = await loadEntries(day);
    const featured = await ensureFeaturedMatches(
      day,
      entries.map((entry) => entry.team),
      await loadGhosts(),
      arena.godId
    );
    const match = featured.find((candidate) => candidate.id === matchId);
    if (!match) throw new Error('unknown featured match');
    if (match.teamA.ownerId === username || match.teamB.ownerId === username)
      throw new Error('cannot bet on your own match');

    const odds =
      teamId === match.teamA.id
        ? match.oddsA
        : teamId === match.teamB.id
          ? match.oddsB
          : null;
    if (odds === null) throw new Error('unknown featured team');

    const field = betField(username, matchId);
    await loadOrCreateStable(username);
    const transaction = await redis.watch(betsKey(day), stableKey(username));
    const existing = parseArenaBet(await redis.hGet(betsKey(day), field));
    const stable = await loadOrCreateStable(username);
    if (existing) {
      await transaction.unwatch();
      return { bet: existing, gold: stable.gold };
    }

    if (stable.gold < stake) {
      await transaction.unwatch();
      throw new Error('not enough gold');
    }
    const bet: ArenaBet = {
      id: `${day}:${field}`,
      ownerId: username,
      matchId,
      teamId,
      stake,
      odds,
    };

    stable.gold -= stake;
    await transaction.multi();
    await transaction.hSet(betsKey(day), { [field]: JSON.stringify(bet) });
    await transaction.set(stableKey(username), JSON.stringify(stable));
    const results = await transaction.exec();
    if (results.length !== 2) throw new Error('betting is busy');
    return { bet, gold: stable.gold };
  });
}

export async function enterCurrentArena(
  stable: Stable,
  now = new Date()
): Promise<{ arena: DailyArena; entry: ArenaEntry; participantCount: number }> {
  const day = utcDay(now);
  const arena = await loadDailyArena(day);
  if (arena.status !== 'open') throw new Error('arena is resolved');

  const existing = parseArenaEntry(
    await redis.hGet(entriesKey(day), stable.ownerId)
  );
  if (existing) {
    return {
      arena,
      entry: existing,
      participantCount: await redis.hLen(entriesKey(day)),
    };
  }

  arena.entries = await loadEntries(day);
  const ghosts = await loadGhosts();
  const team = snapshotStable(stable);
  const entry = enterArena(arena, team, ghosts);
  const inserted = await redis.hSetNX(
    entriesKey(day),
    stable.ownerId,
    JSON.stringify(entry)
  );
  const persisted =
    inserted === 1
      ? entry
      : parseArenaEntry(await redis.hGet(entriesKey(day), stable.ownerId));
  if (!persisted) throw new Error('failed to persist arena entry');

  await redis.hSet(GHOSTS_KEY, { [stable.ownerId]: JSON.stringify(team) });
  return {
    arena,
    entry: persisted,
    participantCount: await redis.hLen(entriesKey(day)),
  };
}

export async function resolveDailyArena(day: string): Promise<DailyArena> {
  return withBettingLock(day, async () => {
    const arena = await loadDailyArena(day);
    const entries = await loadEntries(day);
    const featuredMatches =
      arena.status === 'open'
        ? await ensureFeaturedMatches(
            day,
            entries.map((entry) => entry.team),
            await loadGhosts(),
            arena.godId
          )
        : await loadFeaturedMatches(day);
    const bets = await loadBets(day);
    if (arena.status === 'open') {
      arena.entries = entries;
      resolveArena(arena, {
        featuredMatches,
        fervor: fervorFromBets(bets),
      });
      await saveArena(arena);
      await redis.set(LATEST_RESOLVED_KEY, day);
    }

    await Promise.all(
      arena.settlements.map((settlement) =>
        applyArenaSettlement(day, settlement)
      )
    );
    if (bets.length > 0) {
      const payouts = settleBets(bets, {
        featuredMatches,
        bracketMatches: arena.matches,
      });
      for (const payout of payouts) await applyBetSettlement(day, payout);
    }
    return arena;
  });
}

export async function openDailyArena(day: string): Promise<DailyArena> {
  const arena = await loadDailyArena(day);
  if (arena.postId) return arena;

  const claimed = await redis.hSetNX(POST_CLAIMS_KEY, day, 'creating');
  if (claimed === 0) {
    const claimedPostId = await redis.hGet(POST_CLAIMS_KEY, day);
    if (claimedPostId && claimedPostId !== 'creating') {
      arena.postId = claimedPostId;
      await saveArena(arena);
      return arena;
    }
    throw new Error(`daily arena post ${day} is already being created`);
  }

  const god = godById(arena.godId);
  let createdPostId: string | null = null;
  try {
    const post = await createPost(`KLEOS · Arène du ${day} · ${god.name}`);
    createdPostId = post.id;
    await redis.hSet(POST_CLAIMS_KEY, { [day]: createdPostId });
    arena.postId = createdPostId;
    await saveArena(arena);
    return arena;
  } catch (error) {
    if (!createdPostId) await redis.hDel(POST_CLAIMS_KEY, [day]);
    throw error;
  }
}

export async function runDailyTick(
  now = new Date()
): Promise<{ resolved: DailyArena; opened: DailyArena }> {
  const today = utcDay(now);
  const previous = utcDay(
    new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000)
  );
  const resolved = await resolveDailyArena(previous);
  const opened = await openDailyArena(today);
  return { resolved, opened };
}

async function getLatestSettlement(
  username: string
): Promise<ArenaSettlement | null> {
  const day = await redis.get(LATEST_RESOLVED_KEY);
  if (!day) return null;
  const arena = parseDailyArena(await redis.get(arenaKey(day)));
  return (
    arena?.settlements.find((settlement) => settlement.ownerId === username) ??
    null
  );
}

async function getLatestBetPayout(username: string): Promise<number | null> {
  const day = await redis.get(LATEST_RESOLVED_KEY);
  if (!day) return null;
  const payouts = Object.values(await redis.hGetAll(payoutsKey(day)))
    .map(parseBetPayout)
    .filter((payout): payout is BetPayout => payout !== null)
    .filter((payout) => payout.ownerId === username);
  if (payouts.length === 0) return null;
  return payouts.reduce((total, payout) => total + payout.gold, 0);
}

async function ensureFeaturedMatches(
  day: string,
  entrants: readonly TeamSnapshot[],
  ghosts: readonly TeamSnapshot[],
  godId: GodId
): Promise<FeaturedMatch[]> {
  const existing = await loadFeaturedMatches(day);
  if (existing.length > 0) return existing;

  const featured = createFeaturedMatches(
    day,
    [...entrants, ...ghosts],
    godById(godId)
  );
  await redis.set(featuredKey(day), JSON.stringify(featured), { nx: true });
  const persisted = await loadFeaturedMatches(day);
  return persisted.length > 0 ? persisted : featured;
}

async function loadFeaturedMatches(day: string): Promise<FeaturedMatch[]> {
  const value = parseJson(await redis.get(featuredKey(day)));
  if (!Array.isArray(value) || !value.every(isFeaturedMatch)) return [];
  return value;
}

async function loadBets(day: string): Promise<ArenaBet[]> {
  return Object.values(await redis.hGetAll(betsKey(day)))
    .map(parseArenaBet)
    .filter((bet): bet is ArenaBet => bet !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function applyBetSettlement(
  day: string,
  payout: BetPayout
): Promise<boolean> {
  const value = JSON.stringify(payout);
  const claimed = await redis.hSetNX(payoutsKey(day), payout.betId, value);
  if (claimed === 0) return false;

  try {
    if (payout.gold > 0) {
      const stable = await loadOrCreateStable(payout.ownerId);
      applyBetPayout(stable, payout);
      await saveStable(stable);
    }
    return true;
  } catch (error) {
    await redis.hDel(payoutsKey(day), [payout.betId]);
    throw error;
  }
}

async function withBettingLock<T>(
  day: string,
  action: () => Promise<T>
): Promise<T> {
  const key = `arena:betting-lock:${day}`;
  const token = `${Date.now()}:${Math.random()}`;
  let acquired = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await redis.set(key, token, {
      nx: true,
      expiration: new Date(Date.now() + BETTING_LOCK_TTL_MS),
    });
    if (result === 'OK') {
      acquired = true;
      break;
    }
    await delay(50);
  }
  if (!acquired) throw new Error('betting is busy');

  try {
    return await action();
  } finally {
    if ((await redis.get(key)) === token) await redis.del(key);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function loadDailyArena(day: string): Promise<DailyArena> {
  const key = arenaKey(day);
  const stored = parseDailyArena(await redis.get(key));
  if (stored) return stored;

  const fresh = createDailyArena(day);
  await redis.set(key, JSON.stringify(fresh), { nx: true });
  return parseDailyArena(await redis.get(key)) ?? fresh;
}

async function saveArena(arena: DailyArena): Promise<void> {
  await redis.set(arenaKey(arena.day), JSON.stringify(arena));
}

async function loadEntries(day: string): Promise<ArenaEntry[]> {
  const stored = await redis.hGetAll(entriesKey(day));
  return Object.values(stored)
    .map(parseArenaEntry)
    .filter((entry): entry is ArenaEntry => entry !== null)
    .sort((a, b) => a.team.id.localeCompare(b.team.id));
}

async function loadGhosts(): Promise<TeamSnapshot[]> {
  const stored = await redis.hGetAll(GHOSTS_KEY);
  return Object.values(stored)
    .map(parseTeamSnapshot)
    .filter((team): team is TeamSnapshot => team !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function arenaKey(day: string): string {
  return `arena:${day}`;
}

function entriesKey(day: string): string {
  return `arena:entries:${day}`;
}

function featuredKey(day: string): string {
  return `arena:featured:${day}`;
}

function betsKey(day: string): string {
  return `arena:bets:${day}`;
}

function payoutsKey(day: string): string {
  return `arena:bet-payouts:${day}`;
}

function betField(username: string, matchId: string): string {
  return `${username}:${matchId}`;
}

function parseDailyArena(json: string | null | undefined): DailyArena | null {
  const value = parseJson(json);
  if (!isRecord(value)) return null;
  if (value.version !== DAILY_ARENA_VERSION) return null;
  if (typeof value.day !== 'string' || !isGodId(value.godId)) return null;
  if (value.status !== 'open' && value.status !== 'resolved') return null;
  if (value.postId !== null && typeof value.postId !== 'string') return null;
  if (!Array.isArray(value.entries) || !value.entries.every(isArenaEntry))
    return null;
  if (!Array.isArray(value.matches) || !value.matches.every(isBracketMatch))
    return null;
  if (!Array.isArray(value.standings) || !value.standings.every(isStanding))
    return null;
  if (
    !Array.isArray(value.settlements) ||
    !value.settlements.every(isSettlement)
  )
    return null;
  return {
    version: value.version,
    day: value.day,
    godId: value.godId,
    status: value.status,
    postId: value.postId,
    entries: value.entries,
    matches: value.matches,
    standings: value.standings,
    settlements: value.settlements,
  };
}

function parseArenaEntry(json: string | null | undefined): ArenaEntry | null {
  const value = parseJson(json);
  return isArenaEntry(value) ? value : null;
}

function parseTeamSnapshot(
  json: string | null | undefined
): TeamSnapshot | null {
  const value = parseJson(json);
  return isTeamSnapshot(value) ? value : null;
}

function parseArenaBet(json: string | null | undefined): ArenaBet | null {
  const value = parseJson(json);
  return isArenaBet(value) ? value : null;
}

function parseBetPayout(json: string | null | undefined): BetPayout | null {
  const value = parseJson(json);
  return isBetPayout(value) ? value : null;
}

function parseJson(json: string | null | undefined): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isArenaEntry(value: unknown): value is ArenaEntry {
  return (
    isRecord(value) &&
    isTeamSnapshot(value.team) &&
    isQualifier(value.qualifier)
  );
}

function isFeaturedMatch(value: unknown): value is FeaturedMatch {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isTeamSnapshot(value.teamA) &&
    isTeamSnapshot(value.teamB) &&
    typeof value.oddsA === 'number' &&
    typeof value.oddsB === 'number'
  );
}

function isArenaBet(value: unknown): value is ArenaBet {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.ownerId === 'string' &&
    typeof value.matchId === 'string' &&
    typeof value.teamId === 'string' &&
    typeof value.stake === 'number' &&
    typeof value.odds === 'number'
  );
}

function isBetPayout(value: unknown): value is BetPayout {
  return (
    isRecord(value) &&
    typeof value.betId === 'string' &&
    typeof value.ownerId === 'string' &&
    typeof value.gold === 'number'
  );
}

function isTeamSnapshot(value: unknown): value is TeamSnapshot {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' ||
    typeof value.ownerId !== 'string' ||
    typeof value.name !== 'string'
  ) {
    return false;
  }
  if (value.kind !== 'player' && value.kind !== 'bot') return false;
  if (!Array.isArray(value.roster)) return false;
  return (
    parseStable(
      JSON.stringify({
        version: 1,
        ownerId: value.ownerId,
        name: value.name,
        gold: 0,
        favor: 0,
        roster: value.roster,
      })
    ) !== null
  );
}

function isQualifier(value: unknown): value is ArenaEntry['qualifier'] {
  return (
    isRecord(value) &&
    isTeamSnapshot(value.opponent) &&
    isBattleConfig(value.config) &&
    typeof value.winnerId === 'string' &&
    typeof value.won === 'boolean' &&
    typeof value.ticks === 'number'
  );
}

function isBattleConfig(value: unknown): value is BattleConfig {
  return (
    isRecord(value) &&
    typeof value.seed === 'number' &&
    Array.isArray(value.units) &&
    value.units.every(isUnitSpec) &&
    (value.maxTicks === undefined || typeof value.maxTicks === 'number')
  );
}

function isUnitSpec(value: unknown): value is UnitSpec {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.teamId !== 'string')
    return false;
  if (
    !isWeapon(value.weapon) ||
    !isRecord(value.position) ||
    !isRecord(value.attributes)
  )
    return false;
  return (
    typeof value.position.x === 'number' &&
    typeof value.position.y === 'number' &&
    typeof value.attributes.force === 'number' &&
    typeof value.attributes.agility === 'number' &&
    typeof value.attributes.resilience === 'number'
  );
}

function isBracketMatch(
  value: unknown
): value is DailyArena['matches'][number] {
  return (
    isRecord(value) &&
    typeof value.round === 'number' &&
    typeof value.index === 'number' &&
    typeof value.seed === 'number' &&
    typeof value.teamAId === 'string' &&
    typeof value.teamBId === 'string' &&
    typeof value.winnerId === 'string' &&
    typeof value.ticks === 'number'
  );
}

function isStanding(value: unknown): value is DailyArena['standings'][number] {
  return (
    isRecord(value) &&
    typeof value.rank === 'number' &&
    typeof value.teamId === 'string' &&
    typeof value.ownerId === 'string' &&
    typeof value.name === 'string' &&
    (value.kind === 'player' || value.kind === 'bot')
  );
}

function isSettlement(value: unknown): value is ArenaSettlement {
  return (
    isRecord(value) &&
    typeof value.ownerId === 'string' &&
    typeof value.rank === 'number' &&
    typeof value.gold === 'number' &&
    typeof value.favor === 'number' &&
    isRecord(value.injuries) &&
    Object.values(value.injuries).every((injury) => typeof injury === 'number')
  );
}

function isGodId(value: unknown): value is GodId {
  return (
    value === 'ares' ||
    value === 'athena' ||
    value === 'hermes' ||
    value === 'nike'
  );
}

function isWeapon(value: unknown): value is WeaponArchetype {
  return (
    value === 'spear' ||
    value === 'sword_shield' ||
    value === 'axe' ||
    value === 'bow'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
