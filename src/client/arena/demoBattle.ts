import type { Attributes, BattleConfig, TeamId, UnitSpec, WeaponArchetype } from '../../shared/sim';

// Fixed showcase fight used by the Arena scene until Phase 3/4 wires real
// rosters. Coordinates live in the sim's open world space (centered on 0,0); the
// renderer fits them to the canvas. Deterministic: this seed always replays the
// same battle.
export const DEMO_SEED = 0x6b1e05;

// A 3v3 with deliberately contrasting builds so the placeholder shapes read as
// distinct silhouettes (CONCEPT: arme = identité visuelle et mécanique).
export function demoBattleConfig(): BattleConfig {
  // Lines are kept close in X and spread in Y so the fought-over space stays
  // near the canvas aspect ratio — the renderer fits it big with little waste.
  const units: UnitSpec[] = [
    // Red stable advances from the left.
    unit('red-spear', 'red', -100, -78, 'spear', { force: 6, agility: 5, resilience: 4 }),
    unit('red-guard', 'red', -100, 0, 'sword_shield', { force: 4, agility: 3, resilience: 9 }),
    unit('red-bow', 'red', -125, 78, 'bow', { force: 5, agility: 9, resilience: 2 }),
    // Blue stable advances from the right.
    unit('blue-axe', 'blue', 100, -78, 'axe', { force: 10, agility: 4, resilience: 3 }),
    unit('blue-guard', 'blue', 100, 0, 'sword_shield', { force: 4, agility: 3, resilience: 9 }),
    unit('blue-bow', 'blue', 125, 78, 'bow', { force: 5, agility: 9, resilience: 2 }),
  ];
  return { seed: DEMO_SEED, units };
}

function unit(
  id: string,
  teamId: TeamId,
  x: number,
  y: number,
  weapon: WeaponArchetype,
  attributes: Attributes
): UnitSpec {
  return { id, teamId, attributes, weapon, position: { x, y } };
}
