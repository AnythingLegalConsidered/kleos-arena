import type { AttackEvent, BattleResult, TeamId, UnitSpec, WeaponArchetype } from '../../shared/sim';

// Playback turns a finished BattleResult into a smooth, frame-interpolated stream
// the renderer can read. It is a pure function of the result: it never drives the
// sim. Replaying the same seed produces the same BattleResult and therefore the
// exact same playback (verified headlessly in test/client/playback.test.ts).

const TICKS_PER_SECOND = 30;

/** Static per-unit data the frames don't carry (team, weapon, full HP). */
type UnitMeta = { id: string; teamId: TeamId; weapon: WeaponArchetype; maxHp: number };

/** Interpolated state of one unit at the current playback clock. */
export type SampledUnit = {
  id: string;
  teamId: TeamId;
  weapon: WeaponArchetype;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
};

export class BattlePlayback {
  /** Total battle length in seconds. */
  readonly duration: number;

  private readonly frames: BattleResult['frames'];
  private readonly events: readonly AttackEvent[];
  /** Last valid frame index (frames.length - 1 === result.ticks). */
  private readonly lastTick: number;
  /** Per-unit static data, aligned to the column order of every frame. */
  private readonly meta: readonly UnitMeta[];

  /** Current position in ticks (float). Cosmetic interpolation only. */
  private clock = 0;
  /** Index of the next event not yet surfaced by advance(). */
  private cursor = 0;
  /** Playback speed multiplier (1 = real time, 0 = frozen for hit-pause). */
  private speed = 1;

  constructor(result: BattleResult, specs: readonly UnitSpec[]) {
    this.frames = result.frames;
    this.events = result.events;
    this.lastTick = result.frames.length - 1;
    this.duration = result.ticks / TICKS_PER_SECOND;

    // Frame 0 holds spawn HP (units start at full life), so it doubles as maxHp
    // without recoupling the renderer to unit.ts coefficients. Every frame lists
    // units in the same column order, so meta indexes line up with frame columns.
    const specById = new Map(specs.map((s) => [s.id, s]));
    this.meta = result.frames[0]!.units.map((u) => {
      const spec = specById.get(u.id);
      return {
        id: u.id,
        teamId: spec?.teamId ?? 'unknown',
        weapon: spec?.weapon ?? 'sword_shield',
        maxHp: u.hp,
      };
    });
  }

  /** True once the clock has reached the resolution frame. */
  get done(): boolean {
    return this.clock >= this.lastTick;
  }

  /** Current clock in ticks (float). */
  get tick(): number {
    return this.clock;
  }

  reset(): void {
    this.clock = 0;
    this.cursor = 0;
    this.speed = 1;
  }

  /** 1 = real time, 0.35 = slow-mo, 0 = frozen (hit-pause). */
  setSpeed(factor: number): void {
    this.speed = factor;
  }

  /**
   * Advance the clock by `dtSeconds` (scaled by the current speed) and return the
   * attack events that became visible in the crossed interval — chronological,
   * each surfaced exactly once across the whole playback.
   */
  advance(dtSeconds: number): AttackEvent[] {
    if (this.done) return [];
    this.clock = Math.min(this.lastTick, this.clock + dtSeconds * TICKS_PER_SECOND * this.speed);
    const reached = Math.floor(this.clock);
    const fired: AttackEvent[] = [];
    while (this.cursor < this.events.length && this.events[this.cursor]!.tick <= reached) {
      fired.push(this.events[this.cursor]!);
      this.cursor += 1;
    }
    return fired;
  }

  /** Interpolated unit states at the current clock. */
  sample(): SampledUnit[] {
    const i = Math.min(Math.floor(this.clock), this.lastTick);
    const j = Math.min(i + 1, this.lastTick);
    const t = this.clock - i;
    const a = this.frames[i]!.units;
    const b = this.frames[j]!.units;
    return this.meta.map((m, k) => {
      const ua = a[k]!;
      const ub = b[k]!;
      const hp = Math.round(lerp(ua.hp, ub.hp, t));
      return {
        id: m.id,
        teamId: m.teamId,
        weapon: m.weapon,
        x: lerp(ua.x, ub.x, t),
        y: lerp(ua.y, ub.y, t),
        hp,
        maxHp: m.maxHp,
        alive: hp > 0,
      };
    });
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
