// Public surface of the deterministic sim — the single import point for the
// client (instant replay) and server (authoritative bracket resolution).
export type * from "./types";
export type { Rng } from "./prng";
export { createRng } from "./prng";
export { weaponStats } from "./weapons";
export { spawnUnit } from "./unit";
export { simulate } from "./battle";
