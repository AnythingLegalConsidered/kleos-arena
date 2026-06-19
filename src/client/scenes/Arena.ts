import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { simulate } from '../../shared/sim';
import type { AttackEvent, BattleResult, WeaponArchetype } from '../../shared/sim';
import { BattlePlayback, type SampledUnit } from '../arena/playback';
import { demoBattleConfig } from '../arena/demoBattle';

// Team accent colors. Bodies stay white (CONCEPT: formes blanches, pas d'art
// final) — the team only tints a thin outline so the two sides stay readable.
const TEAM_COLORS: Record<string, number> = {
  red: 0xff5a5a,
  blue: 0x5a9bff,
  unknown: 0xffffff,
};

const BODY_RADIUS = 20; // unit silhouette half-size, in screen px
const HP_WIDTH = 44;
const HP_HEIGHT = 6;
const HP_OFFSET = -BODY_RADIUS - 11;

// Margins (px) reserved around the fitted arena for the HUD strips. Kept tight so
// the fight claims as much of the view as possible.
const INSET = { top: 34, bottom: 44, side: 14 };

// --- juice tuning (handoff: tweak the feel here) --------------------------
const JUICE = {
  slowMoFactor: 0.35, // playback speed during a kill's slow-mo window
  slowMoMs: 420,
  hitPauseMs: 45, // freeze on a normal hit
  killPauseMs: 110, // freeze on a kill
  shakePerDamage: 0.0006, // camera shake intensity per point of damage
  shakeMax: 0.012,
  killShake: 0.02,
  knockbackPerDamage: 0.5, // px of cosmetic knockback per point of damage
  knockbackMax: 10,
  knockbackDecay: 0.8, // per-frame retained fraction
  dustEveryPx: 13, // emit one dust mote per this much travel
  fervorHit: 0.07, // crowd swell on a landed hit
  fervorKill: 0.34, // crowd swell on a kill
  fervorBaseStart: 0.12,
  fervorBaseSwell: 0.45, // baseline rises this much over the battle
  fervorEase: 0.045,
};

type UnitView = {
  id: string;
  teamColor: number;
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Shape;
  hpFill: Phaser.GameObjects.Rectangle;
  alpha: number;
  kx: number;
  ky: number;
  prevX: number;
  prevY: number;
  dustAccum: number;
  deathBurst: boolean;
};

type WorldBounds = { minX: number; minY: number; maxX: number; maxY: number };

export class Arena extends Scene {
  private playback!: BattlePlayback;
  private result!: BattleResult;
  private bounds!: WorldBounds;

  private views: UnitView[] = [];
  private floor!: Phaser.GameObjects.Rectangle;
  private seedText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;

  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private vignette!: Phaser.GameObjects.Rectangle;
  private fervorBg!: Phaser.GameObjects.Rectangle;
  private fervorFill!: Phaser.GameObjects.Rectangle;
  private fervorLabel!: Phaser.GameObjects.Text;

  // World→screen fit, recomputed on every resize.
  private scaleFactor = 1;
  private offsetX = 0;
  private offsetY = 0;

  // Time-warp + crowd state.
  private hitPauseMs = 0;
  private slowMoMs = 0;
  private fervor = JUICE.fervorBaseStart;
  private ended = false;

  constructor() {
    super('Arena');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x14110d);

    const config = demoBattleConfig();
    this.result = simulate(config);
    this.playback = new BattlePlayback(this.result, config.units);
    this.bounds = computeBounds(this.result);

    this.floor = this.add.rectangle(0, 0, 10, 10, 0x231d14).setStrokeStyle(2, 0x3a3022).setDepth(-1);

    this.makeParticleTextures();
    this.sparks = this.add
      .particles(0, 0, 'spark', {
        lifespan: 320,
        speed: { min: 60, max: 200 },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(4);
    this.dust = this.add
      .particles(0, 0, 'dust', {
        lifespan: 480,
        speed: { min: 8, max: 34 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.45, end: 0 },
        emitting: false,
      })
      .setDepth(1);

    for (const sampled of this.playback.sample()) {
      this.views.push(this.createUnitView(sampled));
    }

    this.vignette = this.add
      .rectangle(0, 0, 10, 10, 0x000000, 0)
      .setStrokeStyle(34, 0xff7a2f)
      .setAlpha(0)
      .setDepth(18);
    this.fervorBg = this.add.rectangle(0, 0, 10, HP_HEIGHT * 2, 0x000000, 0.5).setDepth(20);
    this.fervorFill = this.add.rectangle(0, 0, 10, HP_HEIGHT * 2, 0xff7a2f).setOrigin(0, 0.5).setDepth(20);
    this.fervorLabel = this.add.text(0, 0, 'CROWD', hudStyle(13)).setOrigin(0.5).setAlpha(0.7).setDepth(20);

    this.seedText = this.add
      .text(0, 0, `seed 0x${config.seed.toString(16)}`, hudStyle(16))
      .setOrigin(1, 0)
      .setAlpha(0.6)
      .setDepth(20);
    this.hintText = this.add
      .text(0, 0, 'tap / R — replay', hudStyle(16))
      .setOrigin(0, 0)
      .setAlpha(0.6)
      .setDepth(20);
    this.banner = this.add
      .text(0, 0, '', { ...hudStyle(64), stroke: '#000000', strokeThickness: 8 })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(30);

    this.layout();
    this.scale.on('resize', () => this.layout());

    this.input.on('pointerdown', () => this.replay());
    this.input.keyboard?.on('keydown-R', () => this.replay());
  }

  override update(time: number, delta: number): void {
    // Resolve the time warp: a hit-pause freezes playback, a kill's slow-mo
    // slows it. Effects (tweens, particles, shake) keep running at real time.
    let speed = 1;
    if (this.hitPauseMs > 0) {
      this.hitPauseMs -= delta;
      speed = 0;
    } else if (this.slowMoMs > 0) {
      this.slowMoMs -= delta;
      speed = JUICE.slowMoFactor;
    }
    this.playback.setSpeed(speed);

    const events = this.playback.advance(delta / 1000);
    const sample = this.playback.sample();
    if (events.length) {
      const byId = new Map(sample.map((u) => [u.id, u]));
      for (const event of events) this.handleEvent(event, byId);
    }
    for (const sampled of sample) this.applySample(sampled);
    this.updateFervor(time);

    if (!this.ended && this.playback.done) {
      this.ended = true;
      this.showBanner();
    }
  }

  private replay(): void {
    this.playback.reset();
    this.ended = false;
    this.hitPauseMs = 0;
    this.slowMoMs = 0;
    this.fervor = JUICE.fervorBaseStart;
    this.banner.setVisible(false);
    for (const view of this.views) {
      view.alpha = 1;
      view.kx = 0;
      view.ky = 0;
      view.dustAccum = 0;
      view.deathBurst = false;
      view.container.setAlpha(1).setScale(1);
      view.body.setScale(1).setFillStyle(0xffffff);
    }
  }

  // --- juice ---------------------------------------------------------------

  private handleEvent(event: AttackEvent, byId: Map<string, SampledUnit>): void {
    const target = byId.get(event.targetId);
    if (!target) return;
    const sx = this.worldToScreenX(target.x);
    const sy = this.worldToScreenY(target.y);

    if (event.dodged) {
      this.popup('MISS', sx, sy, '#cfd8ff', 22);
      this.fervor = Math.min(1, this.fervor + JUICE.fervorHit * 0.5);
      return;
    }

    const view = this.views.find((v) => v.id === event.targetId);
    if (view) {
      view.body.setFillStyle(0xffd5a0);
      this.tweens.add({ targets: view.body, scaleX: 1.35, scaleY: 1.35, duration: 55, yoyo: true });
      this.time.delayedCall(70, () => view.body.setFillStyle(0xffffff));

      const attacker = byId.get(event.attackerId);
      if (attacker) {
        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const len = Math.hypot(dx, dy) || 1;
        const mag = Math.min(JUICE.knockbackMax, event.damage * JUICE.knockbackPerDamage);
        view.kx += (dx / len) * mag;
        view.ky += (dy / len) * mag;
      }
    }

    this.sparks.explode(8, sx, sy);
    this.popup(`${event.damage}`, sx, sy, event.killed ? '#ffd700' : '#ffffff', event.killed ? 36 : 26);
    this.fervor = Math.min(1, this.fervor + (event.killed ? JUICE.fervorKill : JUICE.fervorHit));

    if (event.killed) {
      this.cameras.main.shake(220, JUICE.killShake);
      this.sparks.explode(22, sx, sy);
      this.hitPauseMs = JUICE.killPauseMs;
      this.slowMoMs = JUICE.slowMoMs;
    } else {
      const intensity = Math.min(JUICE.shakeMax, event.damage * JUICE.shakePerDamage);
      this.cameras.main.shake(90, intensity);
      this.hitPauseMs = Math.max(this.hitPauseMs, JUICE.hitPauseMs);
    }
  }

  private updateFervor(time: number): void {
    // Baseline swells as the battle progresses, so the roar grows toward the
    // climax even between blows; spikes from handleEvent ride on top and decay.
    const progress = this.result.ticks > 0 ? Math.min(1, this.playback.tick / this.result.ticks) : 1;
    const baseline = JUICE.fervorBaseStart + JUICE.fervorBaseSwell * progress;
    this.fervor += ((baseline > this.fervor ? baseline : this.fervor * 0.985) - this.fervor) * JUICE.fervorEase;
    this.fervor = Math.max(0, Math.min(1, this.fervor));

    this.fervorFill.scaleX = this.fervor;
    const pulse = 0.85 + 0.15 * Math.sin(time * 0.012);
    this.vignette.setAlpha((0.04 + 0.26 * this.fervor) * pulse);
  }

  private popup(text: string, x: number, y: number, color: string, size: number): void {
    const label = this.add
      .text(x, y - 16, text, {
        fontFamily: 'Arial Black',
        fontSize: `${size}px`,
        color,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(15);
    this.tweens.add({
      targets: label,
      y: y - 54,
      alpha: 0,
      duration: 640,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  // --- rendering ----------------------------------------------------------

  private createUnitView(sampled: SampledUnit): UnitView {
    const teamColor = TEAM_COLORS[sampled.teamId] ?? TEAM_COLORS.unknown!;
    const body = makeBody(this, sampled.weapon, teamColor);
    const hpBg = this.add.rectangle(0, HP_OFFSET, HP_WIDTH, HP_HEIGHT, 0x000000, 0.55).setOrigin(0.5);
    const hpFill = this.add
      .rectangle(-HP_WIDTH / 2, HP_OFFSET, HP_WIDTH, HP_HEIGHT, teamColor)
      .setOrigin(0, 0.5);
    const container = this.add.container(0, 0, [body, hpBg, hpFill]).setDepth(2);
    return {
      id: sampled.id,
      teamColor,
      container,
      body,
      hpFill,
      alpha: 1,
      kx: 0,
      ky: 0,
      prevX: this.worldToScreenX(sampled.x),
      prevY: this.worldToScreenY(sampled.y),
      dustAccum: 0,
      deathBurst: false,
    };
  }

  private applySample(sampled: SampledUnit): void {
    const view = this.views.find((v) => v.id === sampled.id);
    if (!view) return;

    const sx = this.worldToScreenX(sampled.x);
    const sy = this.worldToScreenY(sampled.y);

    // Kick up dust as a living unit travels.
    if (sampled.alive) {
      view.dustAccum += Math.hypot(sx - view.prevX, sy - view.prevY);
      if (view.dustAccum >= JUICE.dustEveryPx) {
        view.dustAccum = 0;
        this.dust.emitParticleAt(sx, sy + BODY_RADIUS, 1);
      }
    } else if (!view.deathBurst) {
      view.deathBurst = true;
      this.dust.emitParticleAt(sx, sy + BODY_RADIUS, 10);
    }
    view.prevX = sx;
    view.prevY = sy;

    // Cosmetic knockback rides on top of the sim position, then decays back.
    view.kx *= JUICE.knockbackDecay;
    view.ky *= JUICE.knockbackDecay;
    view.container.setPosition(sx + view.kx, sy + view.ky);
    view.hpFill.scaleX = Math.max(0, Math.min(1, sampled.hp / sampled.maxHp));

    // Fade the fallen toward a faint marker so the field stays readable.
    const targetAlpha = sampled.alive ? 1 : 0.22;
    view.alpha += (targetAlpha - view.alpha) * 0.2;
    view.container.setAlpha(view.alpha);
  }

  private showBanner(): void {
    const winner = this.result.winner;
    if (winner) {
      this.banner.setText(`${winner.toUpperCase()} WINS`);
      this.banner.setColor(`#${(TEAM_COLORS[winner] ?? 0xffffff).toString(16).padStart(6, '0')}`);
    } else {
      this.banner.setText('DRAW');
      this.banner.setColor('#ffffff');
    }
    this.banner.setVisible(true);
  }

  // --- world→screen fit ---------------------------------------------------

  private layout(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);

    const usableW = width - INSET.side * 2;
    const usableH = height - INSET.top - INSET.bottom;
    const worldW = this.bounds.maxX - this.bounds.minX || 1;
    const worldH = this.bounds.maxY - this.bounds.minY || 1;

    this.scaleFactor = Math.min(usableW / worldW, usableH / worldH);
    const drawnW = worldW * this.scaleFactor;
    const drawnH = worldH * this.scaleFactor;
    this.offsetX = INSET.side + (usableW - drawnW) / 2 - this.bounds.minX * this.scaleFactor;
    this.offsetY = INSET.top + (usableH - drawnH) / 2 - this.bounds.minY * this.scaleFactor;

    this.floor.setPosition(width / 2, INSET.top + usableH / 2).setSize(drawnW + 48, drawnH + 48);
    this.vignette.setPosition(width / 2, height / 2).setSize(width, height);

    const barW = Math.min(300, width * 0.5);
    this.fervorBg.setPosition(width / 2, height - 22).setSize(barW, HP_HEIGHT * 2);
    this.fervorFill.setPosition(width / 2 - barW / 2, height - 22).setSize(barW, HP_HEIGHT * 2);
    this.fervorLabel.setPosition(width / 2, height - 40);

    this.seedText.setPosition(width - INSET.side, 16);
    this.hintText.setPosition(INSET.side, 16);
    this.banner.setPosition(width / 2, height / 2);
  }

  private worldToScreenX(x: number): number {
    return this.offsetX + x * this.scaleFactor;
  }

  private worldToScreenY(y: number): number {
    return this.offsetY + y * this.scaleFactor;
  }

  private makeParticleTextures(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.clear();
    g.fillStyle(0xb7a98a, 1).fillCircle(3, 3, 3);
    g.generateTexture('dust', 6, 6);
    g.destroy();
  }
}

// --- helpers --------------------------------------------------------------

function computeBounds(result: BattleResult): WorldBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const frame of result.frames) {
    for (const u of frame.units) {
      if (u.x < minX) minX = u.x;
      if (u.x > maxX) maxX = u.x;
      if (u.y < minY) minY = u.y;
      if (u.y > maxY) maxY = u.y;
    }
  }
  const pad = 8;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

// White placeholder silhouette per weapon — distinct shapes so role reads at a
// glance (CONCEPT: arme = identité visuelle). Team tints only the outline.
function makeBody(scene: Scene, weapon: WeaponArchetype, teamColor: number): Phaser.GameObjects.Shape {
  const shape = bodyShape(scene, weapon);
  shape.setStrokeStyle(3, teamColor);
  return shape;
}

function bodyShape(scene: Scene, weapon: WeaponArchetype): Phaser.GameObjects.Shape {
  const r = BODY_RADIUS;
  switch (weapon) {
    case 'spear':
      return scene.add.triangle(0, 0, 0, -r * 1.3, -r * 0.85, r, r * 0.85, r, 0xffffff);
    case 'sword_shield':
      return scene.add.rectangle(0, 0, r * 1.8, r * 1.8, 0xffffff);
    case 'axe':
      return scene.add.polygon(0, 0, [0, -r * 1.3, r * 1.1, 0, 0, r * 1.3, -r * 1.1, 0], 0xffffff);
    case 'bow':
      return scene.add.circle(0, 0, r, 0xffffff);
  }
}

function hudStyle(fontSize: number): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: 'Arial Black', fontSize: `${fontSize}px`, color: '#e8dcc0' };
}
