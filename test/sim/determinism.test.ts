import { describe, expect, it } from "vitest";
import { simulate } from "../../src/shared/sim/battle";
import type { BattleConfig } from "../../src/shared/sim/types";

function twoVsTwo(seed: number): BattleConfig {
  return {
    seed,
    units: [
      { id: "A1", teamId: "A", weapon: "spear", attributes: { force: 5, agility: 4, resilience: 3 }, position: { x: -80, y: -20 } },
      { id: "A2", teamId: "A", weapon: "sword_shield", attributes: { force: 4, agility: 3, resilience: 6 }, position: { x: -80, y: 20 } },
      { id: "B1", teamId: "B", weapon: "axe", attributes: { force: 6, agility: 2, resilience: 4 }, position: { x: 80, y: -20 } },
      { id: "B2", teamId: "B", weapon: "bow", attributes: { force: 3, agility: 6, resilience: 2 }, position: { x: 80, y: 20 } },
    ],
  };
}

describe("simulate determinism", () => {
  it("same seed + same teams → strictly identical result across runs", () => {
    const a = simulate(twoVsTwo(42));
    const b = simulate(twoVsTwo(42));
    const c = simulate(twoVsTwo(42));
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(JSON.stringify(b)).toEqual(JSON.stringify(c));
  });

  it("is invariant to input unit order (sorted internally by id)", () => {
    const base = twoVsTwo(42);
    const reversed: BattleConfig = { seed: 42, units: [...base.units].reverse() };
    const a = simulate(base);
    const b = simulate(reversed);
    expect(a.winner).toEqual(b.winner);
    expect(a.ticks).toEqual(b.ticks);
    expect(a.finalHp).toEqual(b.finalHp);
    expect(a.events).toEqual(b.events);
  });

  it("diverges across seeds (the seed actually matters)", () => {
    const ref = JSON.stringify(simulate(twoVsTwo(1)).events);
    const anyDifferent = [2, 3, 4, 5, 6].some((s) => JSON.stringify(simulate(twoVsTwo(s)).events) !== ref);
    expect(anyDifferent).toBe(true);
  });
});
