export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

// --- stable (Phase 3) ---

import type { AttributeKey, Stable } from './stable';
import type { ArenaSettlement, GodDefinition } from './daily';
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
};

export type ArenaEntryResponse = {
  type: 'arena-entry';
  day: string;
  god: GodDefinition;
  participantCount: number;
  qualifier: ArenaQualifierSummary & { config: BattleConfig };
};

export type ArenaErrorResponse = {
  type: 'error';
  error: string;
};
