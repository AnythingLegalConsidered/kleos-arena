// Stable logic: recruitment, the spend economy, perk/attribute progression, and
// the fold-down to the sim. All pure and deterministic (RNG is seeded), so both
// Verify lines — "managing changes the next sim" and "state restores identically"
// — are checked headlessly in test/stable/.

import type { Attributes, UnitSpec, Vec2, WeaponArchetype } from "../sim";
import { createRng, type Rng } from "../sim";
import type { ActionResult, AttributeKey, Gladiator, Stable } from "./types";

export const STABLE_VERSION = 1;

const START_GOLD = 120;
const START_FAVOR = 3;
const ROSTER_SIZE = 3;

const ATTR_KEYS: readonly AttributeKey[] = ["force", "agility", "resilience"];
const WEAPON_POOL: readonly WeaponArchetype[] = ["spear", "sword_shield", "axe", "bow"];
const NAME_POOL: readonly string[] = [
  "Lykos", "Argos", "Theron", "Kastor", "Pyrrhos", "Nestor",
  "Diomedes", "Glaukos", "Aias", "Idomeneus", "Eumelos", "Talos",
];

// Attribute spends: pricier as the stat grows, half price in the gladiator's gift.
const ATTR_BASE_COST = 18;
const ATTR_COST_PER_LEVEL = 3;
const APTITUDE_FACTOR = 0.5;

// Perk ladders: PERK_MAX steps per attribute, each adding a cumulative effective
// bonus and gated behind the previous step (CONCEPT: petites échelles de perks).
export const PERK_MAX = 3;
const PERK_LADDER: readonly number[] = [0, 2, 5, 9]; // bonus by steps owned
const PERK_STEP_COST: readonly number[] = [0, 40, 80, 140]; // cost to reach step i

const HEAL_COST_AT_FULL = 60;
const INJURY_ATTR_PENALTY = 0.35; // max fraction shaved off base attributes when fully injured

// --- creation -------------------------------------------------------------

/** Deterministic starting stable for an owner (same owner → same fresh roster). */
export function createDefaultStable(ownerId: string, name: string): Stable {
  const rng = createRng(hashSeed(ownerId));
  const roster: Gladiator[] = [];
  for (let i = 0; i < ROSTER_SIZE; i++) roster.push(recruit(rng, `${ownerId}-g${i}`));
  return { version: STABLE_VERSION, ownerId, name, gold: START_GOLD, favor: START_FAVOR, roster };
}

/** Roll a fresh gladiator: random aptitude, random weapon, modest base attributes. */
export function recruit(rng: Rng, id: string): Gladiator {
  const aptitude = ATTR_KEYS[rng.int(ATTR_KEYS.length)] ?? "force";
  const weapon = WEAPON_POOL[rng.int(WEAPON_POOL.length)] ?? "sword_shield";
  const name = NAME_POOL[rng.int(NAME_POOL.length)] ?? "Xenos";
  const attributes: Attributes = {
    force: 3 + rng.int(4),
    agility: 3 + rng.int(4),
    resilience: 3 + rng.int(4),
  };
  attributes[aptitude] += 1; // a small head start in their gift
  return {
    id,
    name,
    attributes,
    aptitude,
    weapon,
    perks: { force: 0, agility: 0, resilience: 0 },
    injury: 0,
  };
}

// --- economy --------------------------------------------------------------

export function attributeCost(g: Gladiator, attr: AttributeKey): number {
  const raw = ATTR_BASE_COST + ATTR_COST_PER_LEVEL * g.attributes[attr];
  return Math.round(raw * (attr === g.aptitude ? APTITUDE_FACTOR : 1));
}

export function buyAttributePoint(stable: Stable, gladiatorId: string, attr: AttributeKey): ActionResult {
  const g = find(stable, gladiatorId);
  if (!g) return { ok: false, error: "unknown gladiator" };
  const cost = attributeCost(g, attr);
  if (stable.gold < cost) return { ok: false, error: "not enough gold" };
  stable.gold -= cost;
  g.attributes[attr] += 1;
  return { ok: true };
}

/** Cost of the next perk step on an attribute, or null if the ladder is maxed. */
export function perkCost(g: Gladiator, attr: AttributeKey): number | null {
  const steps = g.perks[attr];
  if (steps >= PERK_MAX) return null;
  return PERK_STEP_COST[steps + 1] ?? null;
}

export function buyPerk(stable: Stable, gladiatorId: string, attr: AttributeKey): ActionResult {
  const g = find(stable, gladiatorId);
  if (!g) return { ok: false, error: "unknown gladiator" };
  const cost = perkCost(g, attr);
  if (cost === null) return { ok: false, error: "perk ladder maxed" };
  if (stable.gold < cost) return { ok: false, error: "not enough gold" };
  stable.gold -= cost;
  g.perks[attr] += 1;
  return { ok: true };
}

export function healCost(g: Gladiator): number {
  return Math.round(clamp01(g.injury) * HEAL_COST_AT_FULL);
}

export function heal(stable: Stable, gladiatorId: string): ActionResult {
  const g = find(stable, gladiatorId);
  if (!g) return { ok: false, error: "unknown gladiator" };
  if (g.injury <= 0) return { ok: false, error: "nothing to heal" };
  const cost = healCost(g);
  if (stable.gold < cost) return { ok: false, error: "not enough gold" };
  stable.gold -= cost;
  g.injury = 0;
  return { ok: true };
}

// --- fold-down to the sim -------------------------------------------------

/** Base attributes shaped by perks (bonus) and injury (penalty). */
export function effectiveAttributes(g: Gladiator): Attributes {
  const factor = 1 - INJURY_ATTR_PENALTY * clamp01(g.injury);
  const eff = (k: AttributeKey): number =>
    Math.max(1, Math.round(g.attributes[k] * factor) + (PERK_LADDER[g.perks[k]] ?? 0));
  return { force: eff("force"), agility: eff("agility"), resilience: eff("resilience") };
}

/** Convert a gladiator into a sim battle input — the only bridge to the sim. */
export function gladiatorToUnitSpec(g: Gladiator, teamId: string, position: Vec2): UnitSpec {
  return { id: g.id, teamId, attributes: effectiveAttributes(g), weapon: g.weapon, position };
}

// --- persistence ----------------------------------------------------------

/** Parse a stored blob, returning null if it is absent, malformed, or stale. */
export function parseStable(json: string | null | undefined): Stable | null {
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return isStable(parsed) ? parsed : null;
}

function isStable(o: unknown): o is Stable {
  if (typeof o !== "object" || o === null) return false;
  if (!("version" in o) || o.version !== STABLE_VERSION) return false;
  if (!("ownerId" in o) || typeof o.ownerId !== "string") return false;
  if (!("name" in o) || typeof o.name !== "string") return false;
  if (!("gold" in o) || typeof o.gold !== "number") return false;
  if (!("favor" in o) || typeof o.favor !== "number") return false;
  if (!("roster" in o) || !Array.isArray(o.roster)) return false;
  return o.roster.every(isGladiator);
}

function isGladiator(o: unknown): o is Gladiator {
  if (typeof o !== "object" || o === null) return false;
  if (!("id" in o) || typeof o.id !== "string") return false;
  if (!("name" in o) || typeof o.name !== "string") return false;
  if (!("injury" in o) || typeof o.injury !== "number") return false;
  if (!("weapon" in o) || !WEAPON_POOL.some((w) => w === o.weapon)) return false;
  if (!("aptitude" in o) || !ATTR_KEYS.some((k) => k === o.aptitude)) return false;
  if (!("attributes" in o) || !isAttrRecord(o.attributes)) return false;
  if (!("perks" in o) || !isAttrRecord(o.perks)) return false;
  return true;
}

function isAttrRecord(o: unknown): boolean {
  if (typeof o !== "object" || o === null) return false;
  return (
    "force" in o && typeof o.force === "number" &&
    "agility" in o && typeof o.agility === "number" &&
    "resilience" in o && typeof o.resilience === "number"
  );
}

// --- helpers --------------------------------------------------------------

function find(stable: Stable, gladiatorId: string): Gladiator | undefined {
  return stable.roster.find((g) => g.id === gladiatorId);
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
