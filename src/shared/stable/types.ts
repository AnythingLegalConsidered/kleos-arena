// Stable domain types — the persistent player roster and economy (CONCEPT:
// Personnages & progression, Progression persistante). Pure data, shared between
// the client UI and the authoritative server. Gladiators fold down to the sim's
// UnitSpec at battle time, so the sim stays untouched.

import type { Attributes, WeaponArchetype } from "../sim";

/** The three developable attributes, as a key. */
export type AttributeKey = "force" | "agility" | "resilience";

/** Perk ladder progress per attribute: number of steps bought (0..MAX). */
export type PerkLadders = Record<AttributeKey, number>;

export type Gladiator = {
  id: string;
  name: string;
  /** Base attribute points (what attribute spends raise). */
  attributes: Attributes;
  /** The attribute this gladiator levels cheaper (CONCEPT: aptitude aléatoire). */
  aptitude: AttributeKey;
  /** Weapon archetype rolled at recruitment — drives silhouette and role. */
  weapon: WeaponArchetype;
  /** Mini-branch progress per attribute. */
  perks: PerkLadders;
  /** Carried injury 0..1; raised by fights (Phase 4), cleared by paying to heal. */
  injury: number;
};

export type Stable = {
  /** Schema version, so stored blobs can be migrated or rejected. */
  version: number;
  ownerId: string;
  name: string;
  gold: number;
  favor: number;
  roster: Gladiator[];
};

/** Outcome of a spend action — the caller owns the (mutated) stable. */
export type ActionResult = { ok: true } | { ok: false; error: string };
