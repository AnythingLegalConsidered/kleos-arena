// Domain types for the deterministic battle simulation. Pure data: no rendering,
// no platform concerns. Phase 2 consumes `BattleResult.frames` for playback.

/** The three developable attributes (CONCEPT: pas de classes). */
export type Attributes = {
  /** Raw damage scaling. */
  force: number;
  /** Move speed, dodge and initiative. */
  agility: number;
  /** Hit points and damage reduction. */
  resilience: number;
};

/** Classical antique weapon archetypes — drive silhouette and role. */
export type WeaponArchetype = "spear" | "sword_shield" | "axe" | "bow";

export type WeaponStats = {
  archetype: WeaponArchetype;
  /** Engagement range in world units. */
  range: number;
  /** Ticks between two attacks (lower = faster). */
  cooldownTicks: number;
  /** Base damage before Force scaling. */
  baseDamage: number;
  /** Flat damage reduction granted while wielding (e.g. shield). */
  damageReduction: number;
};

export type Vec2 = { x: number; y: number };

export type TeamId = string;

/** A gladiator as fed into the sim (the battle input). */
export type UnitSpec = {
  id: string;
  teamId: TeamId;
  attributes: Attributes;
  weapon: WeaponArchetype;
  position: Vec2;
};

export type BattleConfig = {
  /** Seed: same seed + same units → strictly identical result. */
  seed: number;
  units: UnitSpec[];
  /** Hard cap guaranteeing termination (defaults to 60s of ticks). */
  maxTicks?: number;
};

/** Live runtime state of a unit during simulation. */
export type UnitState = {
  id: string;
  teamId: TeamId;
  weapon: WeaponStats;
  position: Vec2;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  attackDamage: number;
  damageReduction: number;
  dodgeChance: number;
  /** Ticks remaining before the unit can attack again. */
  cooldown: number;
  alive: boolean;
};

export type AttackEvent = {
  tick: number;
  attackerId: string;
  targetId: string;
  damage: number;
  dodged: boolean;
  killed: boolean;
};

export type UnitFrame = {
  id: string;
  x: number;
  y: number;
  hp: number;
};

/** Per-tick snapshot for rendering (Phase 2). */
export type TimelineFrame = {
  tick: number;
  units: UnitFrame[];
};

export type BattleOutcome = "win" | "draw";

export type BattleResult = {
  outcome: BattleOutcome;
  /** Winning team, or null on draw (timeout / mutual wipe). */
  winner: TeamId | null;
  /** Tick at which the battle ended. */
  ticks: number;
  /** Compact per-tick snapshots for playback. */
  frames: TimelineFrame[];
  /** Chronological combat events. */
  events: AttackEvent[];
  /** Final (rounded) HP per unit id. */
  finalHp: Record<string, number>;
};
