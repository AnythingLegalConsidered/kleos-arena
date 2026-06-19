import type { Attributes, BattleConfig, TeamId, UnitSpec, Vec2, WeaponArchetype } from '../../shared/sim';

// Fixed seed for instant combat. Deterministic: same seed + same teams always
// replays the same battle (CONCEPT: combat instant déterministe).
export const DEMO_SEED = 0x6b1e05;

// Spawn slots: the player's three gladiators (left) and the bot's (right). Lines
// are kept close in X and spread in Y so the fought-over space sits near the
// canvas aspect ratio — the renderer fits it big with little waste.
export const PLAYER_POSITIONS: Vec2[] = [
  { x: -100, y: -78 },
  { x: -100, y: 0 },
  { x: -125, y: 78 },
];
const BOT_POSITIONS: Vec2[] = [
  { x: 100, y: -78 },
  { x: 100, y: 0 },
  { x: 125, y: 78 },
];

// The placeholder enemy for instant combat until Phase 4 wires the daily arena /
// ghosts. Contrasting builds so the silhouettes read distinct.
export function botTeam(): UnitSpec[] {
  return [
    unit('bot-axe', 'blue', BOT_POSITIONS[0]!, 'axe', { force: 10, agility: 4, resilience: 3 }),
    unit('bot-guard', 'blue', BOT_POSITIONS[1]!, 'sword_shield', { force: 4, agility: 3, resilience: 9 }),
    unit('bot-bow', 'blue', BOT_POSITIONS[2]!, 'bow', { force: 5, agility: 9, resilience: 2 }),
  ];
}

// Standalone showcase 3v3, used when the Arena is opened without a stable.
export function demoBattleConfig(): BattleConfig {
  const red: UnitSpec[] = [
    unit('red-spear', 'red', PLAYER_POSITIONS[0]!, 'spear', { force: 6, agility: 5, resilience: 4 }),
    unit('red-guard', 'red', PLAYER_POSITIONS[1]!, 'sword_shield', { force: 4, agility: 3, resilience: 9 }),
    unit('red-bow', 'red', PLAYER_POSITIONS[2]!, 'bow', { force: 5, agility: 9, resilience: 2 }),
  ];
  return { seed: DEMO_SEED, units: [...red, ...botTeam()] };
}

function unit(
  id: string,
  teamId: TeamId,
  position: Vec2,
  weapon: WeaponArchetype,
  attributes: Attributes
): UnitSpec {
  return { id, teamId, attributes, weapon, position };
}
