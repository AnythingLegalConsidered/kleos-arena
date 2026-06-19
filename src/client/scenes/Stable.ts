import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { attributeCost, gladiatorToUnitSpec, healCost, perkCost, PERK_MAX } from '../../shared/stable';
import type { AttributeKey, Gladiator, Stable as StableData } from '../../shared/stable';
import type { StableAction, StableActionResponse, StableResponse } from '../../shared/api';
import { PLAYER_POSITIONS } from '../arena/demoBattle';

const ATTR_ROWS: { key: AttributeKey; label: string }[] = [
  { key: 'force', label: 'FOR' },
  { key: 'agility', label: 'AGI' },
  { key: 'resilience', label: 'RES' },
];

const CARD_W = 236;
const CARD_H = 286;
const CARD_GAP = 18;
const CARD_TOP = 96;

// Player-facing stable management. The server is authoritative for every spend:
// the client posts an action and re-renders from the returned stable, so the UI
// can never drift from the persisted truth.
export class Stable extends Scene {
  private stable: StableData | null = null;
  private root!: Phaser.GameObjects.Container;
  private busy = false;
  private status = '';

  private readonly onResize = (): void => this.render();

  constructor() {
    super('Stable');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x14110d);
    this.root = this.add.container(0, 0);
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize));
    this.renderMessage('Chargement de l’écurie…');
    void this.loadStable();
  }

  private async loadStable(): Promise<void> {
    try {
      const res = await fetch('/api/stable');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: StableResponse = await res.json();
      this.stable = data.stable;
      this.status = '';
      this.render();
    } catch {
      this.renderMessage('Échec du chargement — tap pour réessayer', true);
    }
  }

  private async sendAction(action: StableAction): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await fetch('/api/stable/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action),
      });
      const data: StableActionResponse = await res.json();
      if (data.type === 'stable') {
        this.stable = data.stable;
        this.status = '';
      } else {
        this.status = frenchError(data.error);
      }
    } catch {
      this.status = 'Erreur réseau';
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private startFight(): void {
    if (!this.stable) return;
    const playerUnits = this.stable.roster.map((g, i) =>
      gladiatorToUnitSpec(g, 'red', PLAYER_POSITIONS[i] ?? { x: -100, y: 0 })
    );
    this.scene.start('Arena', { playerUnits, fromStable: true });
  }

  // --- rendering ----------------------------------------------------------

  private render(): void {
    if (!this.stable) return;
    this.root.removeAll(true);
    const { width, height } = this.scale;

    this.text(width / 2, 30, 'KLEOS · ÉCURIE', 26, '#e8dcc0', 0.5);
    this.text(width / 2, 60, `or ${this.stable.gold}    faveur ${this.stable.favor}`, 18, '#ffd700', 0.5);

    const roster = this.stable.roster;
    const totalW = roster.length * CARD_W + (roster.length - 1) * CARD_GAP;
    let x = width / 2 - totalW / 2;
    for (const g of roster) {
      this.renderCard(g, x, CARD_TOP);
      x += CARD_W + CARD_GAP;
    }

    this.button(width / 2 - 95, height - 72, 190, 46, 'COMBATTRE', 0x1d6b2f, () => this.startFight());
    if (this.status) this.text(width / 2, height - 16, this.status, 14, '#ff8a8a', 0.5);
  }

  private renderCard(g: Gladiator, x: number, y: number): void {
    const bg = this.add
      .rectangle(x, y, CARD_W, CARD_H, 0x231d14, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x3a3022);
    this.root.add(bg);

    const gold = this.stable?.gold ?? 0;
    this.text(x + CARD_W / 2, y + 18, g.name, 20, '#e8dcc0', 0.5);
    this.text(x + CARD_W / 2, y + 40, `${weaponLabel(g.weapon)} · don ${attrShort(g.aptitude)}`, 13, '#b7a98a', 0.5);

    let ry = y + 74;
    for (const row of ATTR_ROWS) {
      this.text(x + 18, ry, row.label, 16, '#e8dcc0', 0, 0.5);
      this.text(x + 64, ry, `${g.attributes[row.key]}`, 18, '#ffffff', 0.5, 0.5);
      this.text(x + 92, ry, pips(g.perks[row.key]), 14, '#ff7a2f', 0, 0.5);
      const cost = attributeCost(g, row.key);
      this.button(
        x + CARD_W - 60, ry - 15, 48, 30, `+${cost}`, 0x35506b,
        () => void this.sendAction({ action: 'attr', gladiatorId: g.id, attr: row.key }),
        gold >= cost
      );
      ry += 38;
    }

    const perkAttr = g.aptitude;
    const pCost = perkCost(g, perkAttr);
    const perkLabel = pCost === null ? 'perk au max' : `perk ${attrShort(perkAttr)}  +${pCost}`;
    this.button(
      x + 18, y + CARD_H - 76, CARD_W - 36, 30, perkLabel, 0x6b4d1d,
      () => void this.sendAction({ action: 'perk', gladiatorId: g.id, attr: perkAttr }),
      pCost !== null && gold >= pCost
    );

    const injured = g.injury > 0;
    const healLabel = injured ? `soin  -${healCost(g)}` : 'sain';
    this.button(
      x + 18, y + CARD_H - 40, CARD_W - 36, 30, healLabel, 0x6b2f2f,
      () => void this.sendAction({ action: 'heal', gladiatorId: g.id }),
      injured && gold >= healCost(g)
    );
  }

  private renderMessage(message: string, retry = false): void {
    this.root.removeAll(true);
    const { width, height } = this.scale;
    this.text(width / 2, height / 2, message, 18, '#e8dcc0', 0.5, 0.5);
    if (retry) this.input.once('pointerdown', () => void this.loadStable());
  }

  // --- small UI helpers ---------------------------------------------------

  private text(
    x: number,
    y: number,
    str: string,
    size: number,
    color: string,
    originX = 0,
    originY = 0
  ): void {
    const t = this.add
      .text(x, y, str, { fontFamily: 'Arial Black', fontSize: `${size}px`, color })
      .setOrigin(originX, originY);
    this.root.add(t);
  }

  private button(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fill: number,
    onClick: () => void,
    enabled = true
  ): void {
    const color = enabled ? fill : 0x2a2620;
    const rect = this.add
      .rectangle(x, y, w, h, color, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x000000, 0.4);
    const txt = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: 'Arial Black',
        fontSize: '14px',
        color: enabled ? '#ffffff' : '#6a6258',
      })
      .setOrigin(0.5);
    this.root.add(rect);
    this.root.add(txt);

    if (enabled) {
      rect
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => rect.setFillStyle(lighten(color)))
        .on('pointerout', () => rect.setFillStyle(color))
        .on('pointerdown', () => {
          if (!this.busy) onClick();
        });
    }
  }
}

// --- helpers --------------------------------------------------------------

function weaponLabel(weapon: Gladiator['weapon']): string {
  switch (weapon) {
    case 'spear':
      return 'lance';
    case 'sword_shield':
      return 'épée+bouc.';
    case 'axe':
      return 'hache';
    case 'bow':
      return 'arc';
  }
}

function attrShort(attr: AttributeKey): string {
  return attr === 'force' ? 'FOR' : attr === 'agility' ? 'AGI' : 'RES';
}

function pips(steps: number): string {
  return '●'.repeat(steps) + '○'.repeat(Math.max(0, PERK_MAX - steps));
}

function frenchError(error: string): string {
  switch (error) {
    case 'not enough gold':
      return 'Pas assez d’or';
    case 'perk ladder maxed':
      return 'Perk au maximum';
    case 'nothing to heal':
      return 'Rien à soigner';
    default:
      return error;
  }
}

function lighten(c: number): number {
  const r = Math.min(255, ((c >> 16) & 0xff) + 28);
  const g = Math.min(255, ((c >> 8) & 0xff) + 28);
  const b = Math.min(255, (c & 0xff) + 28);
  return (r << 16) | (g << 8) | b;
}
