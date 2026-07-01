// --- stable (Phase 3) ---

import type { AttributeKey, Stable } from './stable';
import type { ArenaSettlement, GodDefinition, Standing } from './daily';
import type { ArenaBet } from './betting';
import type { BattleConfig } from './sim';

/** Current player's stable, as returned by GET /api/stable. */
export type StableResponse = {
  type: 'stable';
  stable: Stable;
};

/** A spend the client asks the authoritative server to apply. */
export type StableAction =
  | { action: 'attr'; gladiatorId: string; attr: AttributeKey }
  | { action: 'perk'; gladiatorId: string; attr: AttributeKey }
  | { action: 'heal'; gladiatorId: string };

/** Result of POST /api/stable/action: the updated stable, or a rejection. */
export type StableActionResponse =
  | { type: 'stable'; stable: Stable }
  | { type: 'error'; error: string };

// --- daily arena (Phase 4) ---

export type ArenaQualifierSummary = {
  opponentName: string;
  won: boolean;
  ticks: number;
};

export type ArenaStatusResponse = {
  type: 'arena';
  day: string;
  god: GodDefinition;
  status: 'open' | 'resolved';
  postId: string | null;
  participantCount: number;
  qualifier: ArenaQualifierSummary | null;
  result: ArenaSettlement | null;
  /** Today's arena standings (Phase 6). Empty while the arena is still 'open'. */
  standings: Standing[];
  featuredMatches: FeaturedMatchSummary[];
  bets: ArenaBet[];
  latestBetPayout: number | null;
};

export type FeaturedTeamSummary = {
  id: string;
  name: string;
  odds: number;
  fervor: number;
};

export type FeaturedMatchSummary = {
  id: string;
  teamA: FeaturedTeamSummary;
  teamB: FeaturedTeamSummary;
};

export type ArenaEntryResponse = {
  type: 'arena-entry';
  day: string;
  god: GodDefinition;
  participantCount: number;
  /** Consecutive-days streak after counting today's entry (Phase 6). */
  streak: number;
  qualifier: ArenaQualifierSummary & { config: BattleConfig };
};

export type ArenaErrorResponse = {
  type: 'error';
  error: string;
};

export type ArenaBetRequest = {
  matchId: string;
  teamId: string;
  stake: number;
};

export type ArenaBetResponse = {
  type: 'bet';
  bet: ArenaBet;
  gold: number;
};
