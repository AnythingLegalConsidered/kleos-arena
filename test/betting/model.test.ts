import { describe, expect, it } from 'vitest';
import {
  FERVOR_MAX_ATTRIBUTE_BONUS,
  applyBetPayout,
  applyFervorToConfig,
  fervorFromBets,
  oddsForConfig,
  settleBets,
} from '../../src/shared/betting';
import { GODS, battleConfig, createBotSnapshot } from '../../src/shared/daily';
import { simulate } from '../../src/shared/sim';
import { createDefaultStable } from '../../src/shared/stable';

describe('betting and fervor', () => {
  it('offers a higher payout to the weaker team', () => {
    const outsider = createBotSnapshot('2026-06-19', 0);
    const favorite = createBotSnapshot('2026-06-19', 1);
    for (const gladiator of outsider.roster) {
      gladiator.attributes = { force: 2, agility: 2, resilience: 2 };
    }
    for (const gladiator of favorite.roster) {
      gladiator.attributes = { force: 12, agility: 12, resilience: 12 };
    }

    const config = battleConfig(outsider, favorite, GODS[0]!, 42);
    const odds = oddsForConfig(config);

    expect(odds.oddsA).toBeGreaterThan(odds.oddsB);
  });

  it('caps fervor and only buffs an initially close fight', () => {
    const teamA = createBotSnapshot('2026-06-19', 0);
    const teamB = createBotSnapshot('2026-06-19', 1);
    teamB.roster = teamA.roster.map((gladiator, index) => ({
      ...gladiator,
      id: `mirror-${index}`,
      attributes: { ...gladiator.attributes },
      perks: { ...gladiator.perks },
    }));
    const config = battleConfig(teamA, teamB, GODS[1]!, 7);

    const capped = applyFervorToConfig(config, 1_000, 0);
    const red = capped.units.find((unit) => unit.teamId === 'red')!;
    const original = config.units.find((unit) => unit.id === red.id)!;

    expect(red.attributes.force - original.attributes.force).toBe(
      FERVOR_MAX_ATTRIBUTE_BONUS
    );
    expect(
      fervorFromBets([
        {
          id: 'a',
          ownerId: 'bettor',
          matchId: 'm',
          teamId: teamA.id,
          stake: 75,
          odds: 2,
        },
        {
          id: 'b',
          ownerId: 'bettor-2',
          matchId: 'm',
          teamId: teamA.id,
          stake: 75,
          odds: 2,
        },
      ])[teamA.id]
    ).toBe(100);
  });

  it('cannot overturn a large initial strength gap', () => {
    const outsider = createBotSnapshot('2026-06-19', 0);
    const favorite = createBotSnapshot('2026-06-19', 1);
    for (const gladiator of outsider.roster) {
      gladiator.attributes = { force: 1, agility: 1, resilience: 1 };
    }
    for (const gladiator of favorite.roster) {
      gladiator.attributes = { force: 30, agility: 30, resilience: 30 };
    }
    const config = battleConfig(outsider, favorite, GODS[2]!, 99);
    const fervent = applyFervorToConfig(config, 100, 0);

    expect(fervent).toBe(config);
    expect(simulate(config).winner).toBe('blue');
    expect(simulate(fervent).winner).toBe('blue');
  });

  it('credits a winning payout to the bettor stable', () => {
    const teamA = createBotSnapshot('2026-06-19', 0);
    const teamB = createBotSnapshot('2026-06-19', 1);
    const market = {
      id: 'featured-0',
      teamA,
      teamB,
      oddsA: 2.4,
      oddsB: 1.6,
    };
    const bet = {
      id: 'ticket',
      ownerId: 'bettor',
      matchId: market.id,
      teamId: teamA.id,
      stake: 25,
      odds: market.oddsA,
    };
    const [payout] = settleBets([bet], {
      featuredMatches: [market],
      bracketMatches: [
        {
          round: 1,
          index: 0,
          seed: 42,
          teamAId: teamA.id,
          teamBId: teamB.id,
          winnerId: teamA.id,
          ticks: 120,
        },
      ],
    });
    const stable = createDefaultStable('bettor', 'Bettor');
    const initialGold = stable.gold;

    applyBetPayout(stable, payout!);

    expect(payout!.gold).toBe(Math.floor(bet.stake * bet.odds));
    expect(stable.gold).toBe(initialGold + payout!.gold);
  });
});
