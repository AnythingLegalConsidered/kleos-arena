import type { UnitSpec, UnitState } from "./types";
import { weaponStats } from "./weapons";

// Attribute → derived-stat coefficients. Kept small and linear so builds stay
// legible (CONCEPT: attributs lisibles qui stack).
const BASE_HP = 60;
const HP_PER_RESILIENCE = 12;
const BASE_SPEED = 18; // world units per second
const SPEED_PER_AGILITY = 1.6;
const DAMAGE_PER_FORCE = 2.2;
const REDUCTION_PER_RESILIENCE = 0.6;
const DODGE_PER_AGILITY = 0.012;
const MAX_DODGE = 0.35;

export function spawnUnit(spec: UnitSpec): UnitState {
  const weapon = weaponStats(spec.weapon);
  const { force, agility, resilience } = spec.attributes;
  const maxHp = BASE_HP + resilience * HP_PER_RESILIENCE;
  return {
    id: spec.id,
    teamId: spec.teamId,
    weapon,
    position: { x: spec.position.x, y: spec.position.y },
    hp: maxHp,
    maxHp,
    moveSpeed: BASE_SPEED + agility * SPEED_PER_AGILITY,
    attackDamage: weapon.baseDamage + force * DAMAGE_PER_FORCE,
    damageReduction: weapon.damageReduction + resilience * REDUCTION_PER_RESILIENCE,
    dodgeChance: Math.min(MAX_DODGE, agility * DODGE_PER_AGILITY),
    cooldown: 0,
    alive: true,
  };
}
