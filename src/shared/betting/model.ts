import type { BattleConfig } from '../sim';
import type { Stable } from '../stable';
import type {
  ArenaBet,
  BetPayout,
  FervorByTeam,
  SettledBetContext,
} from './types';

export const BET_STAKES = [10, 25, 50] as const;
export const FERVOR_CAP = 100;
export const FERVOR_MAX_ATTRIBUTE_BONUS = 2;
export const CLOSE_MATCH_RATIO = 0.15;

const MIN_ODDS = 1.2;
const MAX_ODDS = 4;

export function oddsForConfig(config: BattleConfig): {
  oddsA: number;
  oddsB: number;
} {
  const { red, blue } = configStrength(config);
  const total = red + blue;
  return {
    oddsA: round2(clamp(total / Math.max(1, red), MIN_ODDS, MAX_ODDS)),
    oddsB: round2(clamp(total / Math.max(1, blue), MIN_ODDS, MAX_ODDS)),
  };
}

export function fervorFromBets(bets: readonly ArenaBet[]): FervorByTeam {
  const fervor: FervorByTeam = {};
  for (const bet of bets) {
    fervor[bet.teamId] = Math.min(
      FERVOR_CAP,
      (fervor[bet.teamId] ?? 0) + bet.stake
    );
  }
  return fervor;
}

export function applyFervorToConfig(
  config: BattleConfig,
  redFervor: number,
  blueFervor: number
): BattleConfig {
  const strength = configStrength(config);
  const gap = Math.abs(strength.red - strength.blue);
  const relativeGap = gap / Math.max(strength.red, strength.blue, 1);
  if (relativeGap > CLOSE_MATCH_RATIO) return config;

  const redBonus = fervorBonus(redFervor);
  const blueBonus = fervorBonus(blueFervor);
  if (redBonus === 0 && blueBonus === 0) return config;

  return {
    ...config,
    units: config.units.map((unit) => {
      const bonus = unit.teamId === 'red' ? redBonus : blueBonus;
      if (bonus === 0) return unit;
      return {
        ...unit,
        attributes: {
          force: unit.attributes.force + bonus,
          agility: unit.attributes.agility + bonus,
          resilience: unit.attributes.resilience + bonus,
        },
      };
    }),
  };
}

export function settleBets(
  bets: readonly ArenaBet[],
  context: SettledBetContext
): BetPayout[] {
  const payouts: BetPayout[] = [];
  for (const bet of bets) {
    const featured = context.featuredMatches.find(
      (match) => match.id === bet.matchId
    );
    if (!featured) {
      // Skip rather than throw: one unresolvable ticket must not abort the
      // whole day's settlement (DEBT-002).
      console.warn(
        `settleBets: skipping bet ${bet.id}, unknown featured match ${bet.matchId}`
      );
      continue;
    }

    const bracket = context.bracketMatches.find(
      (match) =>
        match.round === 1 &&
        samePair(
          match.teamAId,
          match.teamBId,
          featured.teamA.id,
          featured.teamB.id
        )
    );
    if (!bracket) {
      console.warn(
        `settleBets: skipping bet ${bet.id}, featured match ${bet.matchId} missing from bracket`
      );
      continue;
    }

    payouts.push({
      betId: bet.id,
      ownerId: bet.ownerId,
      gold:
        bracket.winnerId === bet.teamId ? Math.floor(bet.stake * bet.odds) : 0,
    });
  }
  return payouts;
}

export function applyBetPayout(stable: Stable, payout: BetPayout): void {
  if (stable.ownerId !== payout.ownerId)
    throw new Error('bet payout owner mismatch');
  stable.gold += payout.gold;
}

function configStrength(config: BattleConfig): { red: number; blue: number } {
  let red = 0;
  let blue = 0;
  for (const unit of config.units) {
    const value =
      unit.attributes.force +
      unit.attributes.agility +
      unit.attributes.resilience;
    if (unit.teamId === 'red') red += value;
    if (unit.teamId === 'blue') blue += value;
  }
  return { red, blue };
}

function fervorBonus(fervor: number): number {
  return (
    Math.round(
      (clamp(fervor, 0, FERVOR_CAP) / FERVOR_CAP) *
        FERVOR_MAX_ATTRIBUTE_BONUS *
        100
    ) / 100
  );
}

function samePair(a: string, b: string, x: string, y: string): boolean {
  return (a === x && b === y) || (a === y && b === x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
