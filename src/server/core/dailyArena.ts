import { redis } from '@devvit/web/server';
import {
  DAILY_ARENA_VERSION,
  createDailyArena,
  enterArena,
  godById,
  resolveArena,
  snapshotStable,
  utcDay,
} from '../../shared/daily';
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
import { applyArenaSettlement } from './stableStore';

const GHOSTS_KEY = 'arena:ghosts';
const LATEST_RESOLVED_KEY = 'arena:latest-resolved';
const POST_CLAIMS_KEY = 'arena:post-claims';

export type ArenaStatus = {
  arena: DailyArena;
  entry: ArenaEntry | null;
  latestSettlement: ArenaSettlement | null;
  participantCount: number;
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
  return {
    arena,
    entry,
    latestSettlement: await getLatestSettlement(username),
    participantCount: entries.length,
  };
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
  const arena = await loadDailyArena(day);
  if (arena.status === 'open') {
    arena.entries = await loadEntries(day);
    resolveArena(arena);
    await saveArena(arena);
    await redis.set(LATEST_RESOLVED_KEY, day);
  }

  await Promise.all(
    arena.settlements.map((settlement) => applyArenaSettlement(day, settlement))
  );
  return arena;
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
