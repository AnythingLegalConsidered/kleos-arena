import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { BET_STAKES, FERVOR_CAP } from '../../shared/betting';
import type {
  ArenaBetRequest,
  ArenaBetResponse,
  ArenaErrorResponse,
  ArenaStatusResponse,
  FeaturedMatchSummary,
  FeaturedTeamSummary,
  StableResponse,
} from '../../shared/api';
import type { Stable } from '../../shared/stable';

const IVORY = '#eadfca';
const MUTED = '#a99a80';
const ORANGE = '#e56a2e';
const GOLD = '#e7ba55';
const STAKES = [...BET_STAKES];
const BET_ERRORS: Record<string, string> = {
  'not enough gold': 'Pas assez d’or',
  'betting is closed': 'Le marché est fermé',
  'betting is busy': 'Le marché bouge · réessayez',
};

export class Betting extends Scene {
  private stable: Stable | null = null;
  private arena: ArenaStatusResponse | null = null;
  private root!: Phaser.GameObjects.Container;
  private selectedStake: (typeof BET_STAKES)[number] = BET_STAKES[1];
  private busy = false;
  private status = '';

  private readonly onResize = (): void => this.render();

  constructor() {
    super('Betting');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x100d09);
    this.root = this.add.container(0, 0);
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize));
    this.renderMessage('Ouverture du marché…');
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const [stableResponse, arenaResponse] = await Promise.all([
        fetch('/api/stable'),
        fetch('/api/arena'),
      ]);
      if (!stableResponse.ok || !arenaResponse.ok)
        throw new Error('market unavailable');
      const stableData: StableResponse = await stableResponse.json();
      const arenaData: ArenaStatusResponse = await arenaResponse.json();
      this.stable = stableData.stable;
      this.arena = arenaData;
      this.status = '';
      this.render();
    } catch {
      this.renderMessage('Marché inaccessible · toucher pour réessayer', true);
    }
  }

  private async placeBet(
    match: FeaturedMatchSummary,
    team: FeaturedTeamSummary
  ): Promise<void> {
    if (!this.stable || this.busy || this.betFor(match.id)) return;
    this.busy = true;
    this.status = `Vote pour ${team.name}…`;
    this.render();

    const request: ArenaBetRequest = {
      matchId: match.id,
      teamId: team.id,
      stake: this.selectedStake,
    };
    try {
      const response = await fetch('/api/arena/bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      const data: ArenaBetResponse | ArenaErrorResponse = await response.json();
      if (data.type === 'error') throw new Error(data.error);
      this.stable.gold = data.gold;
      this.status = `La foule de ${team.name} gagne ${data.bet.stake} ferveur`;
      await this.refreshArena();
    } catch (error) {
      this.status =
        error instanceof Error
          ? frenchBetError(error.message)
          : 'Erreur réseau';
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async refreshArena(): Promise<void> {
    const response = await fetch('/api/arena');
    if (!response.ok) throw new Error('market unavailable');
    this.arena = await response.json();
  }

  private render(): void {
    if (!this.stable || !this.arena) return;
    this.root.removeAll(true);
    const { width, height } = this.scale;
    const contentWidth = Math.min(900, width - 48);
    const left = (width - contentWidth) / 2;

    this.renderBackdrop(width, height);
    this.text(width / 2, 24, 'ΑΓΟΡΑ · PARIS', 30, IVORY, 0.5, 0, 'Georgia');
    this.text(
      width / 2,
      61,
      'UNE MISE · UN VOTE · UNE FOULE',
      12,
      ORANGE,
      0.5,
      0,
      'Trebuchet MS'
    );
    this.text(left, 92, `TRÉSOR  ${this.stable.gold} OR`, 16, GOLD);
    this.text(left + contentWidth, 92, 'MISE', 12, MUTED, 1);

    const stakeWidth = 52;
    STAKES.forEach((stake, index) => {
      const x =
        left +
        contentWidth -
        STAKES.length * (stakeWidth + 6) +
        index * (stakeWidth + 6);
      this.button(
        x,
        112,
        stakeWidth,
        28,
        `${stake}`,
        stake === this.selectedStake ? 0x9d3d1c : 0x30261a,
        () => {
          this.selectedStake = stake;
          this.render();
        },
        !this.busy && this.arena?.status === 'open'
      );
    });

    const matches = this.arena.featuredMatches.slice(0, 3);
    const top = 160;
    const available = Math.max(330, height - top - 72);
    const cardHeight = Math.min(
      156,
      (available - 20) / Math.max(1, matches.length)
    );
    matches.forEach((match, index) =>
      this.renderMatch(
        match,
        left,
        top + index * (cardHeight + 10),
        contentWidth,
        cardHeight
      )
    );

    const payout = this.arena.latestBetPayout;
    const footer =
      this.status ||
      (payout === null
        ? 'La mise est débitée maintenant · le gain arrive au tick'
        : `Dernier règlement de paris  +${payout} or`);
    this.text(
      width / 2,
      height - 48,
      footer,
      13,
      this.status ? IVORY : MUTED,
      0.5
    );
    this.button(24, height - 52, 116, 32, '← ÉCURIE', 0x30261a, () => {
      this.scene.start('Stable');
    });
  }

  private renderBackdrop(width: number, height: number): void {
    this.root.add(
      this.add.rectangle(0, 0, width, height, 0x100d09).setOrigin(0, 0)
    );
    for (let x = -height; x < width; x += 96) {
      const line = this.add
        .line(0, 0, x, height, x + height, 0, 0x2d2116, 0.35)
        .setOrigin(0, 0);
      this.root.add(line);
    }
    const disc = this.add.circle(width - 70, 58, 78, 0xc45124, 0.13);
    const inner = this.add.circle(width - 70, 58, 46, 0x100d09, 1);
    this.root.add([disc, inner]);
  }

  private renderMatch(
    match: FeaturedMatchSummary,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const placed = this.betFor(match.id);
    const card = this.add
      .rectangle(x, y, width, height, 0x211910, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x5b452d);
    this.root.add(card);

    const center = x + width / 2;
    this.text(
      center,
      y + 13,
      `DUEL ${match.id.split(':').at(-1)}`,
      10,
      MUTED,
      0.5
    );
    this.renderTeam(
      match,
      match.teamA,
      x + 18,
      y + 34,
      width / 2 - 54,
      height - 48,
      placed?.teamId === match.teamA.id
    );
    this.renderTeam(
      match,
      match.teamB,
      center + 36,
      y + 34,
      width / 2 - 54,
      height - 48,
      placed?.teamId === match.teamB.id
    );
    this.text(
      center,
      y + height / 2 + 5,
      'VS',
      18,
      ORANGE,
      0.5,
      0.5,
      'Georgia'
    );
  }

  private renderTeam(
    match: FeaturedMatchSummary,
    team: FeaturedTeamSummary,
    x: number,
    y: number,
    width: number,
    height: number,
    selected: boolean
  ): void {
    const placed = this.betFor(match.id);
    const enabled =
      this.arena?.status === 'open' &&
      !this.busy &&
      !placed &&
      (this.stable?.gold ?? 0) >= this.selectedStake;
    const panel = this.add
      .rectangle(x, y, width, height, selected ? 0x663019 : 0x17120d, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(selected ? 2 : 1, selected ? 0xe56a2e : 0x3b2f21);
    this.root.add(panel);
    this.text(x + 14, y + 11, team.name.toUpperCase(), 16, IVORY);
    this.text(x + width - 14, y + 11, `x${team.odds.toFixed(2)}`, 18, GOLD, 1);

    const barX = x + 14;
    const barY = y + 43;
    const barWidth = width - 28;
    this.root.add(
      this.add.rectangle(barX, barY, barWidth, 8, 0x33291e).setOrigin(0, 0)
    );
    this.root.add(
      this.add
        .rectangle(
          barX,
          barY,
          barWidth * Math.min(1, team.fervor / FERVOR_CAP),
          8,
          0xe56a2e
        )
        .setOrigin(0, 0)
    );
    this.text(
      barX,
      barY + 14,
      `FERVEUR ${team.fervor}/${FERVOR_CAP}`,
      10,
      MUTED
    );

    const label = selected
      ? `VOTÉ · ${placed?.stake} OR`
      : placed
        ? 'MARCHÉ PRIS'
        : `VOTER · ${this.selectedStake} OR`;
    this.button(
      x + 14,
      y + height - 34,
      width - 28,
      26,
      label,
      selected ? 0x9d3d1c : 0x5c351f,
      () => void this.placeBet(match, team),
      enabled
    );
  }

  private betFor(matchId: string) {
    return this.arena?.bets.find((bet) => bet.matchId === matchId);
  }

  private renderMessage(message: string, retry = false): void {
    this.root.removeAll(true);
    const { width, height } = this.scale;
    this.text(width / 2, height / 2, message, 18, IVORY, 0.5, 0.5);
    if (retry) this.input.once('pointerdown', () => void this.loadData());
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    originX = 0,
    originY = 0,
    family = 'Trebuchet MS'
  ): void {
    const text = this.add
      .text(x, y, value, {
        fontFamily: family,
        fontSize: `${size}px`,
        color,
        fontStyle: 'bold',
      })
      .setOrigin(originX, originY);
    this.root.add(text);
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    fill: number,
    action: () => void,
    enabled = true
  ): void {
    const color = enabled ? fill : 0x28231d;
    const rectangle = this.add
      .rectangle(x, y, width, height, color)
      .setOrigin(0, 0)
      .setStrokeStyle(1, enabled ? 0x6d4a2d : 0x302a23);
    const text = this.add
      .text(x + width / 2, y + height / 2, label, {
        fontFamily: 'Trebuchet MS',
        fontSize: '11px',
        fontStyle: 'bold',
        color: enabled ? '#f4ead7' : '#6f675c',
      })
      .setOrigin(0.5);
    this.root.add([rectangle, text]);
    if (enabled) {
      rectangle
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => rectangle.setFillStyle(lighten(color)))
        .on('pointerout', () => rectangle.setFillStyle(color))
        .on('pointerdown', action);
    }
  }
}

function frenchBetError(error: string): string {
  return BET_ERRORS[error] ?? error;
}

function lighten(color: number): number {
  const red = Math.min(255, ((color >> 16) & 0xff) + 24);
  const green = Math.min(255, ((color >> 8) & 0xff) + 24);
  const blue = Math.min(255, (color & 0xff) + 24);
  return (red << 16) | (green << 8) | blue;
}
