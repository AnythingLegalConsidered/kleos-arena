import { Scene, GameObjects } from 'phaser';

const IVORY = '#e8dcc0';
const ORANGE = '#e56a2e';
const GOLD = '#e7ba55';
const BUTTON_FILL = 0x9d3d1c;
const BUTTON_HOVER = 0xb84c22;

// Each line stays short (< ~45 chars) so it fits a 360px-wide canvas.
const LOOP_LINES = [
  '1 · Forge tes 3 gladiateurs',
  '2 · Lance la qualif — combat instantané',
  '3 · Parie sur les duels : miser = voter',
];
const HOOK_LINE = 'Le bracket tombe chaque nuit.\nReviens compter ta gloire.';

// Title screen: teaches the daily loop at a glance before entering the Stable.
export class MainMenu extends Scene {
  private root!: GameObjects.Container;

  private readonly onResize = (): void => this.refreshLayout();

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x14110d);
    this.root = this.add.container(0, 0);
    // Resize fires on the game-global ScaleManager, so drop the listener when
    // this scene shuts down — otherwise stale handlers stack on restarts.
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize));
    this.refreshLayout();
  }

  /**
   * Rebuilds the whole screen from the current canvas size.
   * Called from create() and on every resize event.
   */
  private refreshLayout(): void {
    const { width, height } = this.scale;

    // Resize camera to the new viewport to prevent black bars.
    this.cameras.resize(width, height);
    this.root.removeAll(true);
    this.renderBackdrop(width, height);

    // One scale factor for the whole stack, bounded for 360×600 → 1920×1080.
    const s = Math.max(0.62, Math.min(width / 560, height / 680, 1.2));
    const centerX = width / 2;

    const titleSize = Math.round(58 * s);
    const subtitleSize = Math.max(11, Math.round(14 * s));
    const loopSize = Math.max(13, Math.round(17 * s));
    const hookSize = Math.max(12, Math.round(14 * s));
    const lineGap = Math.round(loopSize * 2.1);
    const hookHeight = Math.round(hookSize * 2.5);
    const buttonWidth = Math.round(Math.min(width - 48, 246 * s + 60));
    const buttonHeight = Math.round(Math.max(46, 54 * s));

    const blockHeight =
      titleSize +
      10 * s +
      subtitleSize +
      22 * s +
      26 * s +
      2 * lineGap +
      loopSize +
      24 * s +
      hookHeight +
      30 * s +
      buttonHeight;
    let y = Math.max(16, (height - blockHeight) / 2);

    // Faded arena ring behind the title.
    const halo = this.add.circle(
      centerX,
      y + titleSize * 0.55,
      120 * s,
      0xc45124,
      0.12
    );
    const haloCore = this.add.circle(
      centerX,
      y + titleSize * 0.55,
      82 * s,
      0x14110d,
      1
    );
    this.root.add([halo, haloCore]);

    this.text(centerX, y, 'KLEOS', titleSize, IVORY, 'Georgia');
    y += titleSize + 10 * s;
    this.text(centerX, y, 'L’ARÈNE QUOTIDIENNE', subtitleSize, ORANGE);
    y += subtitleSize + 22 * s;

    this.renderDivider(centerX, y, 170 * s);
    y += 26 * s;

    LOOP_LINES.forEach((line, index) => {
      this.text(centerX, y + index * lineGap, line, loopSize, IVORY);
    });
    y += 2 * lineGap + loopSize + 24 * s;

    this.text(centerX, y, HOOK_LINE, hookSize, GOLD);
    y += hookHeight + 30 * s;

    this.renderButton(centerX, y, buttonWidth, buttonHeight, s);
  }

  private renderBackdrop(width: number, height: number): void {
    this.root.add(
      this.add.rectangle(0, 0, width, height, 0x14110d).setOrigin(0, 0)
    );
    // Diagonal hatching, same motif as the Betting backdrop.
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
      .text(centerX, y + height / 2, 'ENTRER DANS L’ARÈNE', {
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
