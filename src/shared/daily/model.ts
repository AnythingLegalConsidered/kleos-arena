import { simulate } from '../sim';
import type { BattleConfig, BattleResult, UnitSpec, Vec2 } from '../sim';
import { createDefaultStable, gladiatorToUnitSpec } from '../stable';
import type { Gladiator, Stable } from '../stable';
import {
  DAILY_ARENA_VERSION,
  type ArenaEntry,
  type ArenaSettlement,
  type BracketMatch,
  type DailyArena,
  type GodDefinition,
  type GodId,
  type Qualifier,
  type Standing,
  type TeamSnapshot,
} from './types';

export const GODS: readonly GodDefinition[] = [
  {
    id: 'ares',
    name: 'Arès',
    attribute: 'force',
    bonus: 2,
    description: '+2 Force pour tous',
  },
  {
    id: 'athena',
    name: 'Athéna',
    attribute: 'resilience',
    bonus: 2,
    description: '+2 Résilience pour tous',
  },
  {
    id: 'hermes',
    name: 'Hermès',
    attribute: 'agility',
    bonus: 2,
    description: '+2 Agilité pour tous',
  },
  {
    id: 'nike',
    name: 'Niké',
    attribute: 'all',
    bonus: 1,
    description: '+1 à tous les attributs',
  },
];

const RED_POSITIONS: readonly Vec2[] = [
  { x: -100, y: -78 },
  { x: -100, y: 0 },
  { x: -125, y: 78 },
];

const BLUE_POSITIONS: readonly Vec2[] = [
  { x: 100, y: -78 },
  { x: 100, y: 0 },
  { x: 125, y: 78 },
];

const MIN_BRACKET_SIZE = 8;

export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function godForDay(day: string): GodDefinition {
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const index = ((dayNumber % GODS.length) + GODS.length) % GODS.length;
  return GODS[index] ?? GODS[0]!;
}

export function godById(id: GodId): GodDefinition {
  return GODS.find((god) => god.id === id) ?? GODS[0]!;
}

export function createDailyArena(day: string): DailyArena {
  return {
    version: DAILY_ARENA_VERSION,
    day,
    godId: godForDay(day).id,
    status: 'open',
    postId: null,
    entries: [],
    matches: [],
    standings: [],
    settlements: [],
  };
}

export function snapshotStable(stable: Stable): TeamSnapshot {
  return {
    id: `player:${stable.ownerId}`,
    ownerId: stable.ownerId,
    name: stable.name,
    kind: 'player',
    roster: cloneRoster(stable.roster),
  };
}

export function createBotSnapshot(day: string, index: number): TeamSnapshot {
  const ownerId = `bot:${day}:${index}`;
  const stable = createDefaultStable(ownerId, `Maison ${index + 1}`);
  return {
    id: ownerId,
    ownerId,
    name: stable.name,
    kind: 'bot',
    roster: cloneRoster(stable.roster),
  };
}

export function enterArena(
  arena: DailyArena,
  team: TeamSnapshot,
  ghosts: readonly TeamSnapshot[] = []
): ArenaEntry {
  const existing = arena.entries.find(
    (entry) => entry.team.ownerId === team.ownerId
  );
  if (existing) return existing;
  if (arena.status !== 'open') throw new Error('arena is resolved');

  const candidates = [...arena.entries.map((entry) => entry.team), ...ghosts]
    .filter((candidate) => candidate.ownerId !== team.ownerId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const seed = hashSeed(`${arena.day}:qualifier:${team.ownerId}`);
  const opponent =
    candidates[seed % candidates.length] ??
    createBotSnapshot(arena.day, seed % 32);
  const qualifier = runQualifier(team, opponent, godById(arena.godId), seed);
  const entry = { team, qualifier };
  arena.entries.push(entry);
  return entry;
}

export function resolveArena(arena: DailyArena): DailyArena {
  if (arena.status === 'resolved') return arena;

  const teams = arena.entries.map((entry) => entry.team);
  const bracketSize = nextPowerOfTwo(Math.max(MIN_BRACKET_SIZE, teams.length));
  for (let i = teams.length; i < bracketSize; i++)
    teams.push(createBotSnapshot(arena.day, i));
  shuffleDeterministically(teams, hashSeed(`${arena.day}:bracket`));

  const totalRounds = Math.log2(bracketSize);
  const eliminatedRound = new Map<string, number>();
  const injuries = new Map<string, Record<string, number>>();
  let roundTeams = teams;
  const matches: BracketMatch[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const winners: TeamSnapshot[] = [];
    for (let index = 0; index < roundTeams.length; index += 2) {
      const teamA = roundTeams[index]!;
      const teamB = roundTeams[index + 1]!;
      const seed = hashSeed(
        `${arena.day}:round:${round}:match:${index / 2}:${teamA.id}:${teamB.id}`
      );
      const config = battleConfig(teamA, teamB, godById(arena.godId), seed);
      const result = simulate(config);
      const winner = pickWinner(teamA, teamB, result, seed);
      const loser = winner.id === teamA.id ? teamB : teamA;
      eliminatedRound.set(loser.id, round);
      mergeInjuries(injuries, teamA, result);
      mergeInjuries(injuries, teamB, result);
      winners.push(winner);
      matches.push({
        round,
        index: index / 2,
        seed,
        teamAId: teamA.id,
        teamBId: teamB.id,
        winnerId: winner.id,
        ticks: result.ticks,
      });
    }
    roundTeams = winners;
  }

  const champion = roundTeams[0]!;
  eliminatedRound.set(champion.id, totalRounds + 1);
  const standings = buildStandings(teams, eliminatedRound, totalRounds);
  arena.matches = matches;
  arena.standings = standings;
  arena.settlements = standings
    .filter((standing) => standing.kind === 'player')
    .map((standing) =>
      settlementFor(standing, injuries.get(standing.teamId) ?? {})
    );
  arena.status = 'resolved';
  return arena;
}

export function battleConfig(
  teamA: TeamSnapshot,
  teamB: TeamSnapshot,
  god: GodDefinition,
  seed: number
): BattleConfig {
  const red = teamUnits(teamA, 'red', RED_POSITIONS, god);
  const blue = teamUnits(teamB, 'blue', BLUE_POSITIONS, god);
  return { seed, units: [...red, ...blue] };
}

export function applySettlement(
  stable: Stable,
  settlement: ArenaSettlement
): void {
  if (stable.ownerId !== settlement.ownerId)
    throw new Error('settlement owner mismatch');
  stable.gold += settlement.gold;
  stable.favor += settlement.favor;
  for (const gladiator of stable.roster) {
    gladiator.injury = Math.max(
      gladiator.injury,
      settlement.injuries[gladiator.id] ?? 0
    );
  }
}

function runQualifier(
  team: TeamSnapshot,
  opponent: TeamSnapshot,
  god: GodDefinition,
  seed: number
): Qualifier {
  const config = battleConfig(team, opponent, god, seed);
  const result = simulate(config);
  const winner = pickWinner(team, opponent, result, seed);
  return {
    opponent,
    config,
    winnerId: winner.id,
    won: winner.id === team.id,
    ticks: result.ticks,
  };
}

function teamUnits(
  team: TeamSnapshot,
  teamId: string,
  positions: readonly Vec2[],
  god: GodDefinition
): UnitSpec[] {
  return team.roster.map((gladiator, index) => {
    const unit = gladiatorToUnitSpec(
      gladiator,
      teamId,
      positions[index] ?? positions[positions.length - 1]!
    );
    return { ...unit, attributes: modifiedAttributes(unit, god) };
  });
}

function modifiedAttributes(
  unit: UnitSpec,
  god: GodDefinition
): UnitSpec['attributes'] {
  const attributes = { ...unit.attributes };
  if (god.attribute === 'all') {
    attributes.force += god.bonus;
    attributes.agility += god.bonus;
    attributes.resilience += god.bonus;
  } else {
    attributes[god.attribute] += god.bonus;
  }
  return attributes;
}

function pickWinner(
  teamA: TeamSnapshot,
  teamB: TeamSnapshot,
  result: BattleResult,
  seed: number
): TeamSnapshot {
  if (result.winner === 'red') return teamA;
  if (result.winner === 'blue') return teamB;

  const redHp = totalHp(result, teamA);
  const blueHp = totalHp(result, teamB);
  if (redHp !== blueHp) return redHp > blueHp ? teamA : teamB;
  return (seed & 1) === 0 ? teamA : teamB;
}

function totalHp(result: BattleResult, team: TeamSnapshot): number {
  return team.roster.reduce(
    (sum, gladiator) => sum + (result.finalHp[gladiator.id] ?? 0),
    0
  );
}

function mergeInjuries(
  all: Map<string, Record<string, number>>,
  team: TeamSnapshot,
  result: BattleResult
): void {
  if (team.kind !== 'player') return;
  const current = all.get(team.id) ?? {};
  const firstFrame = result.frames[0];
  for (const gladiator of team.roster) {
    const initial = firstFrame?.units.find((unit) => unit.id === gladiator.id);
    const maxHp = initial?.hp ?? 1;
    const finalHp = result.finalHp[gladiator.id] ?? 0;
    const foughtForTeam = result.frames.some((frame) =>
      frame.units.some((unit) => unit.id === gladiator.id)
    );
    if (!foughtForTeam) continue;
    const injury =
      Math.round(Math.min(1, Math.max(0, 1 - finalHp / maxHp)) * 100) / 100;
    current[gladiator.id] = Math.max(current[gladiator.id] ?? 0, injury);
  }
  all.set(team.id, current);
}

function buildStandings(
  teams: TeamSnapshot[],
  eliminatedRound: Map<string, number>,
  totalRounds: number
): Standing[] {
  return teams
    .map((team) => {
      const round = eliminatedRound.get(team.id) ?? 0;
      const rank = round > totalRounds ? 1 : 2 ** (totalRounds - round) + 1;
      return {
        rank,
        teamId: team.id,
        ownerId: team.ownerId,
        name: team.name,
        kind: team.kind,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.teamId.localeCompare(b.teamId));
}

function settlementFor(
  standing: Standing,
  injuries: Record<string, number>
): ArenaSettlement {
  const gold =
    standing.rank === 1
      ? 100
      : standing.rank <= 2
        ? 70
        : standing.rank <= 4
          ? 45
          : 25;
  const favor = standing.rank === 1 ? 2 : standing.rank <= 3 ? 1 : 0;
  return {
    ownerId: standing.ownerId,
    rank: standing.rank,
    gold,
    favor,
    injuries,
  };
}

function shuffleDeterministically<T>(items: T[], seed: number): void {
  let state = seed || 0x9e3779b9;
  for (let i = items.length - 1; i > 0; i--) {
    state = xorshift(state);
    const j = state % (i + 1);
    const value = items[i]!;
    items[i] = items[j]!;
    items[j] = value;
  }
}

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

function cloneRoster(roster: readonly Gladiator[]): Gladiator[] {
  return roster.map((gladiator) => ({
    ...gladiator,
    attributes: { ...gladiator.attributes },
    perks: { ...gladiator.perks },
  }));
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function xorshift(value: number): number {
  let state = value >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}
