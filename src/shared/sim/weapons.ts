import type { WeaponArchetype, WeaponStats } from "./types";

// Tuning table for the four v1 archetypes. Trade-offs are intentional:
// spear = reach, sword_shield = sustain + mitigation, axe = burst, bow = range.
const WEAPONS: Record<WeaponArchetype, WeaponStats> = {
  spear: { archetype: "spear", range: 26, cooldownTicks: 22, baseDamage: 9, damageReduction: 0 },
  sword_shield: { archetype: "sword_shield", range: 16, cooldownTicks: 16, baseDamage: 7, damageReduction: 3 },
  axe: { archetype: "axe", range: 16, cooldownTicks: 30, baseDamage: 16, damageReduction: 0 },
  bow: { archetype: "bow", range: 120, cooldownTicks: 34, baseDamage: 8, damageReduction: 0 },
};

export function weaponStats(archetype: WeaponArchetype): WeaponStats {
  return WEAPONS[archetype];
}
