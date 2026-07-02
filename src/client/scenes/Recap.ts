import { Scene, GameObjects } from 'phaser';
import type { ArenaStatusResponse } from '../../shared/api';
import type { Stable as StableData } from '../../shared/stable';

const IVORY = '#e8dcc0';
const MUTED = '#b7a98a';
const ORANGE = '#e56a2e';
const GOLD = '#e7ba55';
const BUTTON_FILL = 0x9d3d1c;
const BUTTON_HOVER = 0xb84c22;

let presented = false;

/**
 * One-shot session gate: true only on the first call per page load, so the
 * recap stages the overnight bracket once and never nags on later scene hops.
 */
export function claimRecapPresentation(): boolean {
  if (presented) return false;
  presented = true;
  return true;
}

// "Return of the next day" screen (Phase 7 onboarding friction c): stages the
// overnight bracket result the MainMenu hook promises, then hands off to the
// Stable. Pure presentation of already-fetched data — no requests of its own.
export class Recap extends Scene {
  private root!: GameObjects.Container;
  private stable: StableData | null = null;
  private arena: ArenaStatusResponse | null = null;

  private readonly onResize = (): void => this.refreshLayout();

  constructor() {
    super('Recap');
  }

  init(data: { stable?: StableData; arena?: ArenaStatusResponse }): void {
    this.stable = data.stable ?? null;
    this.arena = data.arena ?? null;
  }

  create(): void {
    // Nothing to stage (direct start, or no resolved bracket): skip ahead.
    if (!this.stable || !this.arena?.result) {
      this.scene.start('Stable');
      return;
    }
    this.cameras.main.setBackgroundColor(0x14110d);
    this.root = this.add.container(0, 0);
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize));
    this.refreshLayout();
  }

  private refreshLayout(): void {
    if (!this.stable || !this.arena?.result) return;
    const { width, height } = this.scale;
    const result = this.arena.result;

    this.cameras.resize(width, height);
    this.root.removeAll(true);
    this.renderBackdrop(width, height);

    // Same bounded scale factor as the MainMenu (360×600 → 1920×1080).
    const s = Math.max(0.62, Math.min(width / 560, height / 680, 1.2));
    const centerX = width / 2;

    const titleSize = Math.round(34 * s);
    const lineSize = Math.max(13, Math.round(16 * s));
    const smallSize = Math.max(11, Math.round(13 * s));
    const lineGap = Math.round(lineSize * 1.9);
    const buttonWidth = Math.round(Math.min(width - 48, 246 * s + 60));
    const buttonHeight = Math.round(Math.max(46, 54 * s));

    const lines: { value: string; size: number; color: string }[] = [
      {
        value:
          result.rank === 1
            ? 'Ton écurie a remporté le bracket !'
            : `Ton écurie a fini #${result.rank} du bracket`,
        size: lineSize,
        color: IVORY,
      },
      {
        value: `+${result.gold} or · +${result.favor} faveur`,
        size: lineSize,
        color: GOLD,
      },
    ];
    if (this.arena.latestBetPayout !== null) {
      lines.push(
        this.arena.latestBetPayout > 0
          ? {
              value: `Tes paris ont payé : +${this.arena.latestBetPayout} or`,
              size: lineSize,
              color: GOLD,
            }
          : {
              value: 'Tes paris n’ont rien rapporté cette nuit',
              size: smallSize,
              color: MUTED,
            }
      );
    }
    if (this.stable.streak > 0) {
      lines.push({
        value: `Série en cours : ${this.stable.streak}j d’arène`,
        size: smallSize,
        color: ORANGE,
      });
    }
    if (this.stable.roster.some((gladiator) => gladiator.injury > 0)) {
      lines.push({
        value: 'Des blessés attendent le soin à l’écurie',
        size: smallSize,
        color: MUTED,
      });
    }

    const blockHeight =
      titleSize +
      26 * s +
      26 * s +
      lines.length * lineGap +
      16 * s +
      26 * s +
      smallSize +
      30 * s +
      buttonHeight;
    let y = Math.max(16, (height - blockHeight) / 2);

    this.text(centerX, y, 'LE VERDICT DE LA NUIT', titleSize, IVORY, 'Georgia');
    y += titleSize + 26 * s;
    this.renderDivider(centerX, y, 170 * s);
    y += 26 * s;

    for (const line of lines) {
      this.text(centerX, y, line.value, line.size, line.color);
      y += lineGap;
    }
    y += 16 * s;

    this.renderDivider(centerX, y, 170 * s);
    y += 26 * s;
    this.text(
      centerX,
      y,
      `Aujourd’hui : ${this.arena.god.name} · ${this.arena.god.description}`,
      smallSize,
      MUTED
    );
    y += smallSize + 30 * s;

    this.renderButton(centerX, y, buttonWidth, buttonHeight, s);
  }

  private renderBackdrop(width: number, height: number): void {
    this.root.add(
      this.add.rectangle(0, 0, width, height, 0x14110d).setOrigin(0, 0)
    );
    // Diagonal hatching, same motif as the MainMenu backdrop.
    for (let x = -height; x < width; x += 96) {
      const line = this.add
        .line(0, 0, x, height, x + height, 0, 0x2d2116, 0.35)
        .setOrigin(0, 0);
      this.root.add(line);
    }
  }

  /** Thin gold rule with small diamonds at both ends. */
  private renderDivider(centerX: number, y: number, width: number): void {
    const rule = this.add.rectangle(centerX, y, width, 2, 0xe7ba55, 0.8);
    const left = this.add
      .rectangle(centerX - width / 2 - 10, y, 7, 7, 0xe7ba55)
      .setAngle(45);
    const right = this.add
      .rectangle(centerX + width / 2 + 10, y, 7, 7, 0xe7ba55)
      .setAngle(45);
    this.root.add([rule, left, right]);
  }

  private renderButton(
    centerX: number,
    y: number,
    width: number,
    height: number,
    s: number
  ): void {
    const rectangle = this.add
      .rectangle(centerX, y, width, height, BUTTON_FILL)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0xe7ba55);
    const label = this.add
      .text(centerX, y + height / 2, 'REJOINDRE L’ÉCURIE', {
        fontFamily: 'Trebuchet MS',
        fontSize: `${Math.max(13, Math.round(16 * s))}px`,
        fontStyle: 'bold',
        color: '#f4ead7',
      })
      .setOrigin(0.5);
    this.root.add([rectangle, label]);

    rectangle
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => rectangle.setFillStyle(BUTTON_HOVER))
      .on('pointerout', () => rectangle.setFillStyle(BUTTON_FILL))
      .on('pointerdown', () => this.scene.start('Stable'));
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    family = 'Trebuchet MS'
  ): void {
    const text = this.add
      .text(x, y, value, {
        fontFamily: family,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    this.root.add(text);
  }
}
