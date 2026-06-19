import type { AttackEvent, BattleConfig, BattleResult, TimelineFrame, UnitState } from "./types";
import type { Rng } from "./prng";
import { createRng } from "./prng";
import { spawnUnit } from "./unit";
import { add, distance, normalize, scale, sub } from "./vector";

const TICKS_PER_SECOND = 30;
const DT = 1 / TICKS_PER_SECOND;
const DEFAULT_MAX_TICKS = 60 * TICKS_PER_SECOND; // 60s safety cap
const SEPARATION_RADIUS = 14;
const SEPARATION_WEIGHT = 1.2;

// Fixed-timestep, full-auto resolution (CONCEPT Modèle A): open arena, free
// positions, steering = seek nearest enemy + separation among allies, no
// pathfinding. Units are updated sequentially in a stable id order so the whole
// run is reproducible from `seed` alone.
export function simulate(config: BattleConfig): BattleResult {
  const rng = createRng(config.seed);
  const maxTicks = config.maxTicks ?? DEFAULT_MAX_TICKS;

  const units: UnitState[] = config.units
    .map(spawnUnit)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const events: AttackEvent[] = [];
  const frames: TimelineFrame[] = [];

  let tick = 0;
  let winner: string | null = null;
  recordFrame(frames, tick, units);

  for (tick = 1; tick <= maxTicks; tick++) {
    for (const unit of units) {
      if (!unit.alive) continue;
      if (unit.cooldown > 0) unit.cooldown -= 1;

      const target = nearestEnemy(units, unit);
      if (!target) continue;

      if (distance(unit.position, target.position) <= unit.weapon.range) {
        if (unit.cooldown <= 0) attack(unit, target, tick, rng, events);
      } else {
        moveToward(unit, units, target);
      }
    }

    recordFrame(frames, tick, units);

    const teams = aliveTeams(units);
    if (teams.size <= 1) {
      winner = teams.size === 1 ? ([...teams][0] ?? null) : null;
      break;
    }
  }

  const finalHp: Record<string, number> = {};
  for (const unit of units) finalHp[unit.id] = Math.max(0, Math.round(unit.hp));

  return {
    outcome: winner ? "win" : "draw",
    winner,
    ticks: Math.min(tick, maxTicks),
    frames,
    events,
    finalHp,
  };
}

function nearestEnemy(units: UnitState[], self: UnitState): UnitState | null {
  let best: UnitState | null = null;
  let bestDist = Infinity;
  for (const other of units) {
    if (!other.alive || other.teamId === self.teamId) continue;
    const d = distance(self.position, other.position);
    // Deterministic tie-break by id when two enemies are equidistant.
    if (d < bestDist || (d === bestDist && best !== null && other.id < best.id)) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

function moveToward(unit: UnitState, units: UnitState[], target: UnitState): void {
  const seek = normalize(sub(target.position, unit.position));
  let separation: { x: number; y: number } = { x: 0, y: 0 };
  for (const other of units) {
    // Separate from living allies only — enemies must not repel, or the clash
    // never lands.
    if (other === unit || !other.alive || other.teamId !== unit.teamId) continue;
    const d = distance(unit.position, other.position);
    if (d > 0 && d < SEPARATION_RADIUS) {
      const push = scale(normalize(sub(unit.position, other.position)), (SEPARATION_RADIUS - d) / SEPARATION_RADIUS);
      separation = add(separation, push);
    }
  }
  const steer = normalize(add(seek, scale(separation, SEPARATION_WEIGHT)));
  unit.position = add(unit.position, scale(steer, unit.moveSpeed * DT));
}

function attack(attacker: UnitState, target: UnitState, tick: number, rng: Rng, events: AttackEvent[]): void {
  attacker.cooldown = attacker.weapon.cooldownTicks;
  const dodged = rng.chance(target.dodgeChance);
  let damage = 0;
  let killed = false;
  if (!dodged) {
    damage = Math.max(1, attacker.attackDamage - target.damageReduction);
    target.hp -= damage;
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      killed = true;
    }
  }
  events.push({ tick, attackerId: attacker.id, targetId: target.id, damage: Math.round(damage), dodged, killed });
}

function aliveTeams(units: UnitState[]): Set<string> {
  const teams = new Set<string>();
  for (const unit of units) if (unit.alive) teams.add(unit.teamId);
  return teams;
}

function recordFrame(frames: TimelineFrame[], tick: number, units: UnitState[]): void {
  frames.push({
    tick,
    units: units.map((u) => ({ id: u.id, x: round2(u.position.x), y: round2(u.position.y), hp: Math.round(u.hp) })),
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
