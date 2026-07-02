import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import {
  attributeCost,
  healCost,
  perkCost,
  PERK_MAX,
} from '../../shared/stable';
import type {
  AttributeKey,
  Gladiator,
  Stable as StableData,
} from '../../shared/stable';
import type {
  ArenaEntryResponse,
  ArenaErrorResponse,
  ArenaStatusResponse,
  StableAction,
  StableActionResponse,
  StableResponse,
} from '../../shared/api';
import { claimRecapPresentation } from './Recap';

const ATTR_ROWS: { key: AttributeKey; label: string }[] = [
  { key: 'force', label: 'FOR' },
  { key: 'agility', label: 'AGI' },
  { key: 'resilience', label: 'RES' },
];

const CARD_W = 236;
const CARD_H = 286;
const CARD_GAP = 18;
const CARD_TOP = 112;
const LEADERBOARD_ROWS = 5;

// Below this width the 3-cards-in-a-row layout (~744px wide) cannot fit, so
// the scene switches to a stacked compact layout sized for 360x600 portrait.
const COMPACT_BREAK = 820;
const COMPACT_CARD_H = 124;
const COMPACT_CARD_GAP = 8;
const COMPACT_CARD_TOP = 82;

// Player-facing stable management. The server is authoritative for every spend:
// the client posts an action and re-renders from the returned stable, so the UI
// can never drift from the persisted truth.
export class Stable extends Scene {
  private stable: StableData | null = null;
  private arenaStatus: ArenaStatusResponse | null = null;
  private root!: Phaser.GameObjects.Container;
  private busy = false;
  private status = '';
  private helpOpen = false;

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
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const [stableRes, arenaRes] = await Promise.all([
        fetch('/api/stable'),
        fetch('/api/arena'),
      ]);
      if (!stableRes.ok || !arenaRes.ok)
        throw new Error('daily data unavailable');
      const stableData: StableResponse = await stableRes.json();
      const arenaData: ArenaStatusResponse = await arenaRes.json();
      this.stable = stableData.stable;
      this.arenaStatus = arenaData;
      // Stage the overnight bracket once per session before the hub shows.
      if (arenaData.result && claimRecapPresentation()) {
        this.scene.start('Recap', { stable: stableData.stable, arena: arenaData });
        return;
      }
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

  private async startFight(): Promise<void> {
    if (!this.stable || !this.arenaStatus || this.busy) return;
    this.busy = true;
    this.status = 'Soumission de la qualif…';
    this.render();
    try {
      const res = await fetch('/api/arena/enter', { method: 'POST' });
      const data: ArenaEntryResponse | ArenaErrorResponse = await res.json();
      if (data.type === 'error') throw new Error(data.error);
      this.scene.start('Arena', {
        battleConfig: data.qualifier.config,
        battleLabel: `${data.god.name} · ${data.god.description}`,
        fromStable: true,
      });
    } catch (error) {
      this.busy = false;
      this.status =
        error instanceof Error ? frenchError(error.message) : 'Erreur réseau';
      this.render();
    }
  }

  // --- rendering ----------------------------------------------------------

  private render(): void {
    if (!this.stable) return;
    this.root.removeAll(true);
    const { width, height } = this.scale;
    if (width < COMPACT_BREAK) this.renderCompact(width, height);
    else this.renderWide(width, height);
    if (this.helpOpen) this.renderHelp(width, height);
  }

  private renderWide(width: number, height: number): void {
    if (!this.stable) return;

    this.text(width / 2, 30, 'KLEOS · ÉCURIE', 26, '#e8dcc0', 0.5);
    this.renderHelpButton(width - 60, 22, 40);
    this.text(
      width / 2,
      60,
      `or ${this.stable.gold}    faveur ${this.stable.favor}    série ${this.stable.streak}j`,
      18,
      '#ffd700',
      0.5
    );
    if (this.arenaStatus) {
      this.text(
        width / 2,
        86,
        `${this.arenaStatus.god.name} · ${this.arenaStatus.god.description} · ${this.arenaStatus.participantCount} engagés`,
        14,
        '#b7a98a',
        0.5
      );
    }

    const roster = this.stable.roster;
    const totalW = roster.length * CARD_W + (roster.length - 1) * CARD_GAP;
    let x = width / 2 - totalW / 2;
    for (const g of roster) {
      this.renderCard(g, x, CARD_TOP);
      x += CARD_W + CARD_GAP;
    }

    this.renderLeaderboard(x + CARD_GAP, CARD_TOP, width);

    const fight = this.fightButtonState();
    this.button(
      width / 2 - 200,
      height - 72,
      190,
      46,
      fight.label,
      0x1d6b2f,
      () => void this.startFight(),
      fight.enabled
    );
    this.button(
      width / 2 + 10,
      height - 72,
      190,
      46,
      'PARIER · VOTER',
      0x9d3d1c,
      () => this.scene.start('Betting'),
      this.arenaStatus !== null && !this.busy
    );

    const dailyLine = this.dailySummary();
    if (dailyLine)
      this.text(width / 2, height - 92, dailyLine, 13, '#b7a98a', 0.5, 0.5);
    if (this.status)
      this.text(width / 2, height - 16, this.status, 14, '#ff8a8a', 0.5);
  }

  // Compact layout for narrow viewports: header, three stacked gladiator
  // cards, and the action footer all fit inside 360x600 with no scrolling.
  // The leaderboard stays a wide-margin extra and is not rendered here.
  private renderCompact(width: number, height: number): void {
    if (!this.stable) return;

    this.text(width / 2, 8, 'KLEOS · ÉCURIE', 15, '#e8dcc0', 0.5);
    this.renderHelpButton(width - 40, 6, 32);
    this.text(
      width / 2,
      32,
      `or ${this.stable.gold}    faveur ${this.stable.favor}    série ${this.stable.streak}j`,
      12,
      '#ffd700',
      0.5
    );
    if (this.arenaStatus) {
      this.text(
        width / 2,
        51,
        `${this.arenaStatus.god.name} · ${this.arenaStatus.god.description} · ${this.arenaStatus.participantCount} engagés`,
        10,
        '#b7a98a',
        0.5,
        0,
        width - 20
      );
    }

    const cardW = Math.min(width - 16, 520);
    const cardX = (width - cardW) / 2;
    let y = COMPACT_CARD_TOP;
    for (const g of this.stable.roster) {
      this.renderCompactCard(g, cardX, y, cardW);
      y += COMPACT_CARD_H + COMPACT_CARD_GAP;
    }

    const fight = this.fightButtonState();
    const btnW = (width - 30) / 2;
    const btnY = height - 76;
    this.button(
      10,
      btnY,
      btnW,
      38,
      fight.label,
      0x1d6b2f,
      () => void this.startFight(),
      fight.enabled,
      12
    );
    this.button(
      20 + btnW,
      btnY,
      btnW,
      38,
      'PARIER · VOTER',
      0x9d3d1c,
      () => this.scene.start('Betting'),
      this.arenaStatus !== null && !this.busy,
      12
    );

    const dailyLine = this.dailySummary();
    if (dailyLine)
      this.text(width / 2, btnY - 8, dailyLine, 10, '#b7a98a', 0.5, 1, width - 20);
    if (this.status)
      this.text(width / 2, height - 30, this.status, 12, '#ff8a8a', 0.5);
  }

  private fightButtonState(): { label: string; enabled: boolean } {
    const arenaOpen = this.arenaStatus?.status === 'open';
    const fought = this.arenaStatus?.qualifier != null;
    const label = arenaOpen
      ? fought
        ? 'REJOUER QUALIF'
        : 'JOUER QUALIF'
      : 'ARÈNE RÉSOLUE';
    return { label, enabled: arenaOpen && !this.busy };
  }

  private renderCard(g: Gladiator, x: number, y: number): void {
    const bg = this.add
      .rectangle(x, y, CARD_W, CARD_H, 0x231d14, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x3a3022);
    this.root.add(bg);

    const gold = this.stable?.gold ?? 0;
    this.text(x + CARD_W / 2, y + 18, g.name, 20, '#e8dcc0', 0.5);
    this.text(
      x + CARD_W / 2,
      y + 40,
      `${weaponLabel(g.weapon)} · don ${attrShort(g.aptitude)}`,
      13,
      '#b7a98a',
      0.5
    );

    let ry = y + 74;
    for (const row of ATTR_ROWS) {
      this.text(x + 18, ry, row.label, 16, '#e8dcc0', 0, 0.5);
      this.text(
        x + 64,
        ry,
        `${g.attributes[row.key]}`,
        18,
        '#ffffff',
        0.5,
        0.5
      );
      this.text(x + 92, ry, pips(g.perks[row.key]), 14, '#ff7a2f', 0, 0.5);
      const cost = attributeCost(g, row.key);
      this.button(
        x + CARD_W - 60,
        ry - 15,
        48,
        30,
        `+${cost}`,
        0x35506b,
        () =>
          void this.sendAction({
            action: 'attr',
            gladiatorId: g.id,
            attr: row.key,
          }),
        gold >= cost
      );
      ry += 38;
    }

    const perkAttr = g.aptitude;
    const pCost = perkCost(g, perkAttr);
    const perkLabel =
      pCost === null ? 'perk au max' : `perk ${attrShort(perkAttr)}  +${pCost}`;
    this.button(
      x + 18,
      y + CARD_H - 76,
      CARD_W - 36,
      30,
      perkLabel,
      0x6b4d1d,
      () =>
        void this.sendAction({
          action: 'perk',
          gladiatorId: g.id,
          attr: perkAttr,
        }),
      pCost !== null && gold >= pCost
    );

    const injured = g.injury > 0;
    const healLabel = injured ? `soin  -${healCost(g)}` : 'sain';
    this.button(
      x + 18,
      y + CARD_H - 40,
      CARD_W - 36,
      30,
      healLabel,
      0x6b2f2f,
      () => void this.sendAction({ action: 'heal', gladiatorId: g.id }),
      injured && gold >= healCost(g)
    );
  }

  // One stacked card: name + weapon on top, one column per attribute
  // (label/value/pips over its buy button), then perk + heal side by side.
  // Every button keeps a 32px minimum touch dimension.
  private renderCompactCard(g: Gladiator, x: number, y: number, w: number): void {
    const bg = this.add
      .rectangle(x, y, w, COMPACT_CARD_H, 0x231d14, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x3a3022);
    this.root.add(bg);

    const gold = this.stable?.gold ?? 0;
    this.text(x + 10, y + 8, g.name, 13, '#e8dcc0');
    this.text(
      x + w - 10,
      y + 11,
      `${weaponLabel(g.weapon)} · don ${attrShort(g.aptitude)}`,
      10,
      '#b7a98a',
      1
    );

    const colW = (w - 20) / 3;
    ATTR_ROWS.forEach((row, index) => {
      const cx = x + 10 + index * colW;
      this.text(
        cx + 2,
        y + 30,
        `${row.label} ${g.attributes[row.key]} ${pips(g.perks[row.key])}`,
        10,
        '#e8dcc0'
      );
      const cost = attributeCost(g, row.key);
      this.button(
        cx,
        y + 46,
        colW - 6,
        32,
        `+${cost}`,
        0x35506b,
        () =>
          void this.sendAction({
            action: 'attr',
            gladiatorId: g.id,
            attr: row.key,
          }),
        gold >= cost,
        12
      );
    });

    const perkAttr = g.aptitude;
    const pCost = perkCost(g, perkAttr);
    const perkLabel =
      pCost === null ? 'perk au max' : `perk ${attrShort(perkAttr)}  +${pCost}`;
    const perkW = Math.round((w - 26) * 0.58);
    this.button(
      x + 10,
      y + 84,
      perkW,
      32,
      perkLabel,
      0x6b4d1d,
      () =>
        void this.sendAction({
          action: 'perk',
          gladiatorId: g.id,
          attr: perkAttr,
        }),
      pCost !== null && gold >= pCost,
      11
    );

    const injured = g.injury > 0;
    const healLabel = injured ? `soin  -${healCost(g)}` : 'sain';
    this.button(
      x + 16 + perkW,
      y + 84,
      w - 26 - perkW,
      32,
      healLabel,
      0x6b2f2f,
      () => void this.sendAction({ action: 'heal', gladiatorId: g.id }),
      injured && gold >= healCost(g),
      11
    );
  }

  private renderLeaderboard(x: number, y: number, width: number): void {
    const standings = this.arenaStatus?.standings ?? [];
    if (standings.length === 0) return;
    const panelW = Math.max(0, width - x - 16);
    if (panelW < 100) return; // no room in the margin at this viewport size

    this.text(x, y, 'CLASSEMENT', 13, '#e8dcc0');
    let ry = y + 22;
    for (const standing of standings.slice(0, LEADERBOARD_ROWS)) {
      this.text(
        x,
        ry,
        `#${standing.rank} ${standing.name}`,
        12,
        standing.kind === 'player' ? '#ffd700' : '#b7a98a'
      );
      ry += 18;
    }
  }

  // Square "?" toggle that opens the first-contact explainer (Phase 7
  // onboarding friction a: gold/attributes/perks were never explained).
  private renderHelpButton(x: number, y: number, size: number): void {
    this.button(x, y, size, size, '?', 0x4a3f2d, () => {
      this.helpOpen = true;
      this.render();
    });
  }

  // Full-screen overlay on top of the current layout; tap anywhere to close.
  private renderHelp(width: number, height: number): void {
    const dim = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.78)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.helpOpen = false;
        this.render();
      });

    const panelW = Math.min(width - 24, 460);
    const body = this.add
      .text(
        width / 2,
        0,
        [
          'OR — la monnaie : dépensée ici, gagnée au',
          'bracket nocturne et aux paris.',
          'FOR dégâts · AGI vitesse & esquive · RES vie.',
          '« +N » monte l’attribut d’un point pour N or',
          '(de plus en plus cher).',
          'DON — l’attribut fétiche du gladiateur :',
          'moitié prix.',
          'PERK ●○○ — paliers de bonus sur le don.',
          'SOIN — un blessé perd de ses attributs',
          'tant qu’il n’est pas soigné.',
          'FAVEUR — la reconnaissance des dieux,',
          'gagnée en haut de bracket.',
          'SÉRIE — tes jours d’arène consécutifs.',
        ].join('\n'),
        {
          fontFamily: 'Arial Black',
          fontSize: '12px',
          color: '#e8dcc0',
          lineSpacing: 7,
          wordWrap: { width: panelW - 36 },
        }
      )
      .setOrigin(0.5, 0);
    const titleSize = 16;
    const panelH = body.height + titleSize + 74;
    const panelY = Math.max(12, (height - panelH) / 2);
    const panel = this.add
      .rectangle(width / 2, panelY, panelW, panelH, 0x231d14, 0.98)
      .setOrigin(0.5, 0)
      .setStrokeStyle(2, 0x3a3022);
    body.setY(panelY + titleSize + 34);

    this.root.add(dim);
    this.root.add(panel);
    this.text(width / 2, panelY + 16, 'L’ÉCURIE EN BREF', titleSize, '#e8dcc0', 0.5);
    this.root.add(body);
    this.text(
      width / 2,
      panelY + panelH - 22,
      'toucher pour fermer',
      10,
      '#b7a98a',
      0.5
    );
  }

  private renderMessage(message: string, retry = false): void {
    this.root.removeAll(true);
    const { width, height } = this.scale;
    this.text(width / 2, height / 2, message, 18, '#e8dcc0', 0.5, 0.5);
    if (retry) this.input.once('pointerdown', () => void this.loadData());
  }

  private dailySummary(): string {
    if (!this.arenaStatus) return '';
    const parts: string[] = [];
    if (this.arenaStatus.qualifier) {
      parts.push(
        `qualif ${this.arenaStatus.qualifier.won ? 'gagnée' : 'perdue'} vs ${this.arenaStatus.qualifier.opponentName}`
      );
    }
    if (this.arenaStatus.result) {
      const result = this.arenaStatus.result;
      parts.push(
        `#${result.rank}  +${result.gold} or  +${result.favor} faveur`
      );
    }
    if (this.arenaStatus.latestBetPayout !== null) {
      parts.push(`paris +${this.arenaStatus.latestBetPayout} or`);
    }
    return parts.join('   ·   ');
  }

  // --- small UI helpers ---------------------------------------------------

  private text(
    x: number,
    y: number,
    str: string,
    size: number,
    color: string,
    originX = 0,
    originY = 0,
    maxWidth?: number
  ): void {
    const t = this.add
      .text(x, y, str, {
        fontFamily: 'Arial Black',
        fontSize: `${size}px`,
        color,
        ...(maxWidth !== undefined && {
          wordWrap: { width: maxWidth },
          align: originX === 0.5 ? 'center' : originX === 1 ? 'right' : 'left',
        }),
      })
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
    enabled = true,
    fontSize = 14
  ): void {
    const color = enabled ? fill : 0x2a2620;
    const rect = this.add
      .rectangle(x, y, w, h, color, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x000000, 0.4);
    const txt = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: 'Arial Black',
        fontSize: `${fontSize}px`,
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
