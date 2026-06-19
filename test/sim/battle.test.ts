import { describe, expect, it } from "vitest";
import { simulate } from "../../src/shared/sim/battle";
import type { BattleConfig } from "../../src/shared/sim/types";

describe("simulate 2v2", () => {
  it("resolves coherently and exposes a readable log", () => {
    const config: BattleConfig = {
      seed: 42,
      units: [
        { id: "A1", teamId: "A", weapon: "spear", attributes: { force: 5, agility: 4, resilience: 3 }, position: { x: -80, y: -20 } },
        { id: "A2", teamId: "A", weapon: "sword_shield", attributes: { force: 4, agility: 3, resilience: 6 }, position: { x: -80, y: 20 } },
        { id: "B1", teamId: "B", weapon: "axe", attributes: { force: 6, agility: 2, resilience: 4 }, position: { x: 80, y: -20 } },
        { id: "B2", teamId: "B", weapon: "bow", attributes: { force: 3, agility: 6, resilience: 2 }, position: { x: 80, y: 20 } },
      ],
    };
    const result = simulate(config);

    // Battle terminates and produces one frame per tick plus the initial frame.
    expect(result.ticks).toBeGreaterThan(0);
    expect(result.frames.length).toBe(result.ticks + 1);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.outcome).toBe("win");
    expect(["A", "B"]).toContain(result.winner);

    // Human-readable summary (CONCEPT verify: "lisible dans les logs").
    console.log(`[2v2] winner=${result.winner} ticks=${result.ticks} events=${result.events.length}`);
    for (const e of result.events.slice(0, 10)) {
      const tags = `${e.dodged ? " DODGE" : ""}${e.killed ? " KILL" : ""}`;
      console.log(`  t${e.tick} ${e.attackerId} -> ${e.targetId} dmg=${e.damage}${tags}`);
    }
  });

  it("a clearly stronger team beats a weaker one", () => {
    const config: BattleConfig = {
      seed: 7,
      units: [
        { id: "S1", teamId: "S", weapon: "axe", attributes: { force: 9, agility: 6, resilience: 8 }, position: { x: -60, y: 0 } },
        { id: "W1", teamId: "W", weapon: "sword_shield", attributes: { force: 1, agility: 1, resilience: 1 }, position: { x: 60, y: 0 } },
      ],
    };
    const result = simulate(config);
    expect(result.winner).toBe("S");
    expect(result.finalHp["W1"]).toBe(0);
    expect(result.finalHp["S1"]).toBeGreaterThan(0);
  });
});
