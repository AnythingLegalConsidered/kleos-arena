// Deterministic seeded PRNG (mulberry32). The sim MUST route every random
// decision through an instance of this — `Math.random` is banned in the sim so
// that `seed + teams` fully determines the outcome.

export type Rng = {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** True with the given probability (0..1). */
  chance(probability: number): boolean;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive: number): number => Math.floor(next() * maxExclusive),
    range: (min: number, max: number): number => min + next() * (max - min),
    chance: (probability: number): boolean => next() < probability,
  };
}
