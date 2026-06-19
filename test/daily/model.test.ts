import { describe, expect, it } from 'vitest';
import {
  GODS,
  battleConfig,
  createBotSnapshot,
  createDailyArena,
  enterArena,
  godForDay,
  resolveArena,
  snapshotStable,
} from '../../src/shared/daily';
import { createDefaultStable } from '../../src/shared/stable';

describe('daily arena', () => {
  it('rotates one global god modifier per UTC day', () => {
    const ids = [0, 1, 2, 3].map((offset) => godForDay(`2026-06-${String(19 + offset).padStart(2, '0')}`).id);
    expect(new Set(ids).size).toBe(GODS.length);
    expect(godForDay('2026-06-19')).toEqual(godForDay('2026-06-23'));
  });

  it('uses a real ghost when available and returns an identical qualifier on retry', () => {
    const arena = createDailyArena('2026-06-19');
    const player = snapshotStable(createDefaultStable('ianis', 'Kleos'));
    const ghost = snapshotStable(createDefaultStable('rival', 'Argive'));

    const first = enterArena(arena, player, [ghost]);
    const retry = enterArena(arena, player, [ghost]);

    expect(first.qualifier.opponent.ownerId).toBe('rival');
    expect(first).toEqual(retry);
    expect(arena.entries).toHaveLength(1);
  });

  it('applies the daily modifier to both sides of the qualifier', () => {
    const teamA = createBotSnapshot('2026-06-19', 0);
    const teamB = createBotSnapshot('2026-06-19', 1);
    const god = GODS.find((candidate) => candidate.id === 'ares')!;
    const config = battleConfig(teamA, teamB, god, 42);

    expect(config.units[0]!.attributes.force).toBeGreaterThan(teamA.roster[0]!.attributes.force);
    expect(config.units[3]!.attributes.force).toBeGreaterThan(teamB.roster[0]!.attributes.force);
  });

  it('fills an empty cold-start bracket with bots and resolves deterministically', () => {
    const first = resolveArena(createDailyArena('2026-06-19'));
    const second = resolveArena(createDailyArena('2026-06-19'));

    expect(first.status).toBe('resolved');
    expect(first.standings).toHaveLength(8);
    expect(first.matches).toHaveLength(7);
    expect(first.standings[0]?.rank).toBe(1);
    expect(first).toEqual(second);
  });

  it('ranks every player and creates one settlement per real entrant', () => {
    const arena = createDailyArena('2026-06-20');
    for (const owner of ['a', 'b', 'c']) {
      enterArena(arena, snapshotStable(createDefaultStable(owner, owner)));
    }

    resolveArena(arena);

    expect(arena.standings).toHaveLength(8);
    expect(arena.settlements).toHaveLength(3);
    expect(arena.settlements.every((settlement) => settlement.gold > 0)).toBe(true);
    expect(arena.settlements.every((settlement) => Object.keys(settlement.injuries).length === 3)).toBe(true);
  });
});
