import type { BracketMatch, TeamSnapshot } from '../daily/types';

export type FeaturedMatch = {
  id: string;
  teamA: TeamSnapshot;
  teamB: TeamSnapshot;
  oddsA: number;
  oddsB: number;
};

export type ArenaBet = {
  id: string;
  ownerId: string;
  matchId: string;
  teamId: string;
  stake: number;
  odds: number;
};

export type BetPayout = {
  betId: string;
  ownerId: string;
  gold: number;
};

export type FervorByTeam = Record<string, number>;

export type SettledBetContext = {
  featuredMatches: readonly FeaturedMatch[];
  bracketMatches: readonly BracketMatch[];
};
