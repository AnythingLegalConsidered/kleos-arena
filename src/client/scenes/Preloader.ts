import { Scene } from 'phaser';
import * as Phaser from 'phaser';

export class Preloader extends Scene {
  private background!: Phaser.GameObjects.Image;
  private barOutline!: Phaser.GameObjects.Rectangle;
  private bar!: Phaser.GameObjects.Rectangle;
  private progress = 0;

  private readonly onResize = (): void => this.layout();

  constructor() {
    super('Preloader');
  }

  init() {
    //  We loaded this image in our Boot Scene, so we can display it here
    this.background = this.add.image(0, 0, 'background');

    //  A simple progress bar. This is the outline of the bar.
    this.barOutline = this.add.rectangle(0, 0, 468, 32).setStrokeStyle(1, 0xffffff);

    //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
    this.bar = this.add.rectangle(0, 0, 4, 28, 0xffffff).setOrigin(0, 0.5);

    this.layout();
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize));

    //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
    this.load.on('progress', (progress: number) => {
      this.progress = progress;
      this.updateBar();
    });
  }

  preload() {
    //  Load the assets for the game - Replace with your own assets
    this.load.setPath('../assets');

    this.load.image('logo', 'logo.png');
  }

  create() {
    //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
    //  For example, you can define global animations here, so we can use them in other scenes.

    //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
    this.scene.start('MainMenu');
  }

  // Everything is centered from the live canvas size so the loader stays on
  // screen from mobile portrait up to desktop (Phaser.Scale.RESIZE).
  private layout(): void {
    const { width, height } = this.scale;
    const barWidth = this.barWidth();

    //  Scale the background to cover the viewport while keeping its aspect ratio.
    this.background.setPosition(width / 2, height / 2);
    this.background.setScale(
      Math.max(width / this.background.width, height / this.background.height)
    );

    this.barOutline.setPosition(width / 2, height / 2);
    this.barOutline.setSize(barWidth, 32);
    this.bar.setPosition(width / 2 - barWidth / 2 + 2, height / 2);
    this.updateBar();
  }

  private updateBar(): void {
    //  The fill grows from the left edge of the outline up to its inner width.
    this.bar.width = 4 + (this.barWidth() - 8) * this.progress;
  }

  private barWidth(): number {
    return Math.min(468, this.scale.width - 48);
  }
}
