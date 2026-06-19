import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { simulate } from '../../shared/sim';
import type { BattleResult, WeaponArchetype } from '../../shared/sim';
import { BattlePlayback, type SampledUnit } from '../arena/playback';
import { demoBattleConfig } from '../arena/demoBattle';

// Team accent colors. Bodies stay white (CONCEPT: formes blanches, pas d'art
// final) — the team only tints a thin outline so the two sides stay readable.
const TEAM_COLORS: Record<string, number> = {
  red: 0xff5a5a,
  blue: 0x5a9bff,
  unknown: 0xffffff,
};

const BODY_RADIUS = 13; // unit silhouette half-size, in screen px
const HP_WIDTH = 30;
const HP_HEIGHT = 5;
const HP_OFFSET = -BODY_RADIUS - 9;

// Margins (px) reserved around the fitted arena for the HUD strips.
const INSET = { top: 56, bottom: 40, side: 28 };

type UnitView = {
  id: string;
  teamColor: number;
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Shape;
  hpFill: Phaser.GameObjects.Rectangle;
  alpha: number;
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

  // World→screen fit, recomputed on every resize.
  private scaleFactor = 1;
  private offsetX = 0;
  private offsetY = 0;

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

    this.floor = this.add.rectangle(0, 0, 10, 10, 0x231d14).setStrokeStyle(2, 0x3a3022);

    for (const sampled of this.playback.sample()) {
      this.views.push(this.createUnitView(sampled));
    }

    this.seedText = this.add
      .text(0, 0, `seed 0x${config.seed.toString(16)}`, hudStyle(16))
      .setOrigin(1, 0)
      .setAlpha(0.6);
    this.hintText = this.add
      .text(0, 0, 'tap / R — replay', hudStyle(16))
      .setOrigin(0, 0)
      .setAlpha(0.6);
    this.banner = this.add
      .text(0, 0, '', { ...hudStyle(64), stroke: '#000000', strokeThickness: 8 })
      .setOrigin(0.5)
      .setVisible(false);

    this.layout();
    this.scale.on('resize', () => this.layout());

    this.input.on('pointerdown', () => this.replay());
    this.input.keyboard?.on('keydown-R', () => this.replay());
  }

  override update(_time: number, delta: number): void {
    this.playback.advance(delta / 1000);

    for (const sampled of this.playback.sample()) {
      this.applySample(sampled);
    }

    if (!this.ended && this.playback.done) {
      this.ended = true;
      this.showBanner();
    }
  }

  private replay(): void {
    this.playback.reset();
    this.ended = false;
    this.banner.setVisible(false);
    for (const view of this.views) {
      view.alpha = 1;
      view.container.setAlpha(1);
    }
  }

  // --- rendering ----------------------------------------------------------

  private createUnitView(sampled: SampledUnit): UnitView {
    const teamColor = TEAM_COLORS[sampled.teamId] ?? TEAM_COLORS.unknown!;
    const body = makeBody(this, sampled.weapon, teamColor);
    const hpBg = this.add
      .rectangle(0, HP_OFFSET, HP_WIDTH, HP_HEIGHT, 0x000000, 0.55)
      .setOrigin(0.5);
    const hpFill = this.add
      .rectangle(-HP_WIDTH / 2, HP_OFFSET, HP_WIDTH, HP_HEIGHT, teamColor)
      .setOrigin(0, 0.5);
    const container = this.add.container(0, 0, [body, hpBg, hpFill]);
    return { id: sampled.id, teamColor, container, body, hpFill, alpha: 1 };
  }

  private applySample(sampled: SampledUnit): void {
    const view = this.views.find((v) => v.id === sampled.id);
    if (!view) return;

    view.container.setPosition(this.worldToScreenX(sampled.x), this.worldToScreenY(sampled.y));
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
  const pad = 20;
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
