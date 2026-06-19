import type { BattleConfig } from '../sim';
import type { AttributeKey, Gladiator } from '../stable';

export const DAILY_ARENA_VERSION = 1;

export type GodId = 'ares' | 'athena' | 'hermes' | 'nike';

export type GodDefinition = {
  id: GodId;
  name: string;
  attribute: AttributeKey | 'all';
  bonus: number;
  description: string;
};

export type TeamSnapshot = {
  id: string;
  ownerId: string;
  name: string;
  kind: 'player' | 'bot';
  roster: Gladiator[];
};

export type Qualifier = {
  opponent: TeamSnapshot;
  config: BattleConfig;
  winnerId: string;
  won: boolean;
  ticks: number;
};

export type ArenaEntry = {
  team: TeamSnapshot;
  qualifier: Qualifier;
};

export type BracketMatch = {
  round: number;
  index: number;
  seed: number;
  teamAId: string;
  teamBId: string;
  winnerId: string;
  ticks: number;
};

export type Standing = {
  rank: number;
  teamId: string;
  ownerId: string;
  name: string;
  kind: TeamSnapshot['kind'];
};

export type ArenaSettlement = {
  ownerId: string;
  rank: number;
  gold: number;
  favor: number;
  injuries: Record<string, number>;
};

export type DailyArena = {
  version: number;
  day: string;
  godId: GodId;
  status: 'open' | 'resolved';
  postId: string | null;
  entries: ArenaEntry[];
  matches: BracketMatch[];
  standings: Standing[];
  settlements: ArenaSettlement[];
};
