import { describe, expect, it } from "vitest";
import { simulate } from "../../src/shared/sim/battle";
import type { BattleResult, UnitSpec } from "../../src/shared/sim/types";
import { BattlePlayback } from "../../src/client/arena/playback";
import { demoBattleConfig } from "../../src/client/arena/demoBattle";

const TPS = 30;
const dtForTicks = (ticks: number): number => ticks / TPS;

// Hand-built two-tick result: lets us assert interpolation and event surfacing to
// the exact value, independent of the sim's tuning.
function syntheticResult(): { result: BattleResult; specs: UnitSpec[] } {
  const specs: UnitSpec[] = [
    { id: "a", teamId: "red", weapon: "spear", attributes: { force: 1, agility: 1, resilience: 1 }, position: { x: 0, y: 0 } },
    { id: "b", teamId: "blue", weapon: "axe", attributes: { force: 1, agility: 1, resilience: 1 }, position: { x: 10, y: 0 } },
  ];
  const result: BattleResult = {
    outcome: "win",
    winner: "red",
    ticks: 2,
    frames: [
      { tick: 0, units: [{ id: "a", x: 0, y: 0, hp: 10 }, { id: "b", x: 10, y: 0, hp: 10 }] },
      { tick: 1, units: [{ id: "a", x: 2, y: 0, hp: 10 }, { id: "b", x: 8, y: 2, hp: 6 }] },
      { tick: 2, units: [{ id: "a", x: 4, y: 0, hp: 10 }, { id: "b", x: 6, y: 4, hp: 0 }] },
    ],
    events: [
      { tick: 1, attackerId: "a", targetId: "b", damage: 4, dodged: false, killed: false },
      { tick: 2, attackerId: "a", targetId: "b", damage: 6, dodged: false, killed: true },
    ],
    finalHp: { a: 10, b: 0 },
  };
  return { result, specs };
}

describe("BattlePlayback sampling", () => {
  it("at clock 0 mirrors frame 0, infers maxHp from spawn HP, all alive", () => {
    const { result, specs } = syntheticResult();
    const pb = new BattlePlayback(result, specs);
    const s = pb.sample();
    expect(s.map((u) => [u.id, u.x, u.y, u.hp])).toEqual([
      ["a", 0, 0, 10],
      ["b", 10, 0, 10],
    ]);
    expect(s.every((u) => u.alive)).toBe(true);
    expect(s.map((u) => u.maxHp)).toEqual([10, 10]);
    expect(s.map((u) => [u.teamId, u.weapon])).toEqual([
      ["red", "spear"],
      ["blue", "axe"],
    ]);
  });

  it("interpolates positions and HP linearly between frames", () => {
    const { result, specs } = syntheticResult();
    const pb = new BattlePlayback(result, specs);
    pb.advance(dtForTicks(0.5)); // clock = 0.5, halfway frame 0 → frame 1
    const b = pb.sample().find((u) => u.id === "b")!;
    expect(b.x).toBeCloseTo(9, 5);
    expect(b.y).toBeCloseTo(1, 5);
    expect(b.hp).toBe(8); // round(lerp(10, 6, 0.5))
  });

  it("reaches the resolution frame and marks the dead unit", () => {
    const { result, specs } = syntheticResult();
    const pb = new BattlePlayback(result, specs);
    pb.advance(dtForTicks(2));
    expect(pb.done).toBe(true);
    const dead = pb.sample().find((u) => u.id === "b")!;
    expect(dead.hp).toBe(0);
    expect(dead.alive).toBe(false);
  });
});

describe("BattlePlayback events", () => {
  it("surfaces each event once, only when the clock reaches its tick", () => {
    const { result, specs } = syntheticResult();
    const pb = new BattlePlayback(result, specs);
    expect(pb.advance(dtForTicks(0.5))).toEqual([]); // before tick 1
    expect(pb.advance(dtForTicks(0.5)).map((e) => e.tick)).toEqual([1]); // clock 1.0
    const last = pb.advance(dtForTicks(1));
    expect(last.map((e) => e.tick)).toEqual([2]);
    expect(last[0]!.killed).toBe(true);
    expect(pb.advance(dtForTicks(1))).toEqual([]); // nothing left
  });
});

describe("BattlePlayback replay == live", () => {
  it("two playbacks of the same seed produce identical sample/event streams", () => {
    const cfg = demoBattleConfig();
    const p1 = new BattlePlayback(simulate(cfg), cfg.units);
    const p2 = new BattlePlayback(simulate(cfg), cfg.units);

    const dt = 1 / 60; // render at 60fps over a 30-ticks/s sim
    const steps = Math.ceil(p1.duration * 60) + 30;
    const trace1: unknown[] = [];
    const trace2: unknown[] = [];
    for (let i = 0; i < steps; i++) {
      trace1.push(p1.advance(dt), p1.sample());
      trace2.push(p2.advance(dt), p2.sample());
    }
    expect(JSON.stringify(trace1)).toEqual(JSON.stringify(trace2));
  });

  it("emits exactly the sim's events across a full playback", () => {
    const cfg = demoBattleConfig();
    const result = simulate(cfg);
    const pb = new BattlePlayback(result, cfg.units);

    const dt = 1 / 60;
    const steps = Math.ceil(pb.duration * 60) + 30;
    let emitted = 0;
    for (let i = 0; i < steps; i++) emitted += pb.advance(dt).length;
    expect(emitted).toBe(result.events.length);
    expect(pb.done).toBe(true);
  });
});
