import { describe, expect, it } from "vitest";
import { simulate } from "../../src/shared/sim/battle";
import type { UnitSpec } from "../../src/shared/sim/types";
import {
  attributeCost,
  buyAttributePoint,
  buyPerk,
  createDefaultStable,
  effectiveAttributes,
  gladiatorToUnitSpec,
  heal,
  parseStable,
  perkCost,
  PERK_MAX,
  recordParticipation,
  STABLE_VERSION,
} from "../../src/shared/stable";
import type { Stable } from "../../src/shared/stable";

const PLAYER_Y = [-30, 0, 30];

function playerUnits(stable: Stable): UnitSpec[] {
  return stable.roster.map((g, i) => gladiatorToUnitSpec(g, "red", { x: -80, y: PLAYER_Y[i] ?? 0 }));
}

function botUnits(): UnitSpec[] {
  return [-30, 0, 30].map((y, i) => ({
    id: `bot${i}`,
    teamId: "blue",
    attributes: { force: 5, agility: 4, resilience: 5 },
    weapon: "sword_shield" as const,
    position: { x: 80, y },
  }));
}

describe("createDefaultStable", () => {
  it("is deterministic per owner and varies across owners", () => {
    const a = createDefaultStable("user-1", "Stable A");
    const b = createDefaultStable("user-1", "Stable A");
    const c = createDefaultStable("user-2", "Stable C");
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(JSON.stringify(a.roster)).not.toEqual(JSON.stringify(c.roster));
    expect(a.roster).toHaveLength(3);
  });

  it("rolls legible gladiators (valid weapon, aptitude, sane attributes)", () => {
    const s = createDefaultStable("roll-test", "S");
    for (const g of s.roster) {
      expect(["spear", "sword_shield", "axe", "bow"]).toContain(g.weapon);
      expect(["force", "agility", "resilience"]).toContain(g.aptitude);
      expect(g.injury).toBe(0);
      for (const v of Object.values(g.attributes)) expect(v).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("economy", () => {
  it("spends gold, raises the attribute, and discounts the aptitude", () => {
    const s = createDefaultStable("eco", "S");
    const g = s.roster[0]!;
    const before = g.attributes.force;
    const goldBefore = s.gold;
    const cost = attributeCost(g, "force");

    expect(buyAttributePoint(s, g.id, "force")).toEqual({ ok: true });
    expect(g.attributes.force).toBe(before + 1);
    expect(s.gold).toBe(goldBefore - cost);

    const apt = g.aptitude;
    const other = (["force", "agility", "resilience"] as const).find((k) => k !== apt)!;
    expect(attributeCost(g, apt)).toBeLessThan(attributeCost(g, other));
  });

  it("refuses a spend with insufficient gold and leaves state untouched", () => {
    const s = createDefaultStable("broke", "S");
    s.gold = 0;
    const g = s.roster[0]!;
    const snapshot = JSON.stringify(g);
    expect(buyAttributePoint(s, g.id, "force")).toEqual({ ok: false, error: "not enough gold" });
    expect(JSON.stringify(g)).toEqual(snapshot);
    expect(s.gold).toBe(0);
  });

  it("walks the perk ladder, gating and pricing each step, then maxes out", () => {
    const s = createDefaultStable("perk", "S");
    s.gold = 100000;
    const g = s.roster[0]!;
    for (let step = 0; step < PERK_MAX; step++) {
      expect(perkCost(g, "resilience")).not.toBeNull();
      expect(buyPerk(s, g.id, "resilience")).toEqual({ ok: true });
    }
    expect(g.perks.resilience).toBe(PERK_MAX);
    expect(perkCost(g, "resilience")).toBeNull();
    expect(buyPerk(s, g.id, "resilience")).toEqual({ ok: false, error: "perk ladder maxed" });
  });
});

describe("effectiveAttributes", () => {
  it("adds perk bonuses and is reduced by injury", () => {
    const s = createDefaultStable("eff", "S");
    const g = s.roster[0]!;
    g.attributes = { force: 6, agility: 6, resilience: 6 };
    g.perks = { force: 2, agility: 0, resilience: 0 };
    g.injury = 0;
    expect(effectiveAttributes(g).force).toBe(6 + 5); // PERK_LADDER[2] = 5

    g.injury = 1;
    expect(effectiveAttributes(g).agility).toBeLessThan(6);
  });
});

describe("heal", () => {
  it("clears injury for gold, and rejects healing the healthy", () => {
    const s = createDefaultStable("heal", "S");
    const g = s.roster[0]!;
    expect(heal(s, g.id)).toEqual({ ok: false, error: "nothing to heal" });

    g.injury = 0.5;
    const goldBefore = s.gold;
    expect(heal(s, g.id)).toEqual({ ok: true });
    expect(g.injury).toBe(0);
    expect(s.gold).toBeLessThan(goldBefore);
  });
});

describe("Verify 1 — managing the stable changes the next sim", () => {
  it("a strengthened roster yields a different battle for the same seed", () => {
    const s = createDefaultStable("fight", "S");
    const seed = 777;
    const before = simulate({ seed, units: [...playerUnits(s), ...botUnits()] });

    s.gold = 100000;
    for (const g of s.roster) {
      buyAttributePoint(s, g.id, "force");
      buyAttributePoint(s, g.id, "force");
      buyAttributePoint(s, g.id, "resilience");
      buyPerk(s, g.id, "resilience");
    }
    const after = simulate({ seed, units: [...playerUnits(s), ...botUnits()] });

    expect(JSON.stringify(after)).not.toEqual(JSON.stringify(before));
  });
});

describe("Verify 2 — persistence restores identically", () => {
  it("serialize → parse round-trips to a deep-equal stable", () => {
    const s = createDefaultStable("persist", "Ianis");
    s.gold = 55;
    buyAttributePoint(s, s.roster[1]!.id, "agility");
    const restored = parseStable(JSON.stringify(s));
    expect(restored).toEqual(s);
  });

  it("rejects absent, malformed, or stale blobs", () => {
    expect(parseStable(null)).toBeNull();
    expect(parseStable("not json")).toBeNull();
    expect(parseStable(JSON.stringify({ version: 999, roster: [] }))).toBeNull();
  });

  it("migrates a v1 blob by seeding the streak fields", () => {
    const s = createDefaultStable("legacy", "Old");
    const v1: Record<string, unknown> = { ...s, version: 1 };
    delete v1.streak;
    delete v1.lastPlayedDay;
    const restored = parseStable(JSON.stringify(v1));
    expect(restored?.version).toBe(STABLE_VERSION);
    expect(restored?.streak).toBe(0);
    expect(restored?.lastPlayedDay).toBeNull();
    expect(restored?.roster).toEqual(s.roster);
  });
});

describe("Phase 6 — daily streak", () => {
  it("starts a fresh stable at zero, then opens the streak on first play", () => {
    const s = createDefaultStable("streak", "S");
    expect(s.streak).toBe(0);
    expect(s.lastPlayedDay).toBeNull();
    expect(recordParticipation(s, "2026-06-22")).toBe(true);
    expect(s.streak).toBe(1);
    expect(s.lastPlayedDay).toBe("2026-06-22");
  });

  it("increments on consecutive days", () => {
    const s = createDefaultStable("streak", "S");
    recordParticipation(s, "2026-06-22");
    recordParticipation(s, "2026-06-23");
    recordParticipation(s, "2026-06-24");
    expect(s.streak).toBe(3);
    expect(s.lastPlayedDay).toBe("2026-06-24");
  });

  it("resets to one after a skipped day", () => {
    const s = createDefaultStable("streak", "S");
    recordParticipation(s, "2026-06-22");
    recordParticipation(s, "2026-06-23");
    recordParticipation(s, "2026-06-25"); // skipped the 24th
    expect(s.streak).toBe(1);
  });

  it("is idempotent within the same day", () => {
    const s = createDefaultStable("streak", "S");
    expect(recordParticipation(s, "2026-06-22")).toBe(true);
    expect(recordParticipation(s, "2026-06-22")).toBe(false);
    expect(s.streak).toBe(1);
  });

  it("crosses a month boundary as a consecutive day", () => {
    const s = createDefaultStable("streak", "S");
    recordParticipation(s, "2026-06-30");
    recordParticipation(s, "2026-07-01");
    expect(s.streak).toBe(2);
  });
});
