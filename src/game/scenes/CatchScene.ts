import Phaser from 'phaser';
import { bandForVariant, CatchBand, resolveCatch } from '../../core/catch';
import { createRng } from '../../core/rng';
import { CATCH_RING_DURATION_MS, VariantTier } from '../../data/economy';

interface CatchSceneData {
  variant: VariantTier;
  onResult: (success: boolean) => void;
}

const CENTER_X = 360;
const CENTER_Y = 640;
const START_RADIUS = 260;

/** Timing-ring catch minigame: a ring shrinks from START_RADIUS to 0 over
 * CATCH_RING_DURATION_MS; tapping while its radius sits inside the target
 * band (narrower for rarer variants) succeeds. Resolution logic itself lives
 * in core/catch.ts — this scene only turns elapsed time into a tap value. */
export class CatchScene extends Phaser.Scene {
  private variant!: VariantTier;
  private onResult!: (success: boolean) => void;
  private band!: CatchBand;
  private progress = 0;
  private resolved = false;
  private ringGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Catch');
  }

  init(data: CatchSceneData): void {
    this.variant = data.variant;
    this.onResult = data.onResult;
    this.progress = 0;
    this.resolved = false;
  }

  create(): void {
    this.add.rectangle(CENTER_X, CENTER_Y, 720, 1280, 0x000000, 0.55);

    const rng = createRng(Date.now() ^ 0x2545f491);
    const center = 0.3 + rng() * 0.4;
    this.band = bandForVariant(this.variant, center);

    this.ringGraphics = this.add.graphics();
    this.add
      .text(CENTER_X, CENTER_Y - 320, 'Tap when the ring hits the glow!', { fontSize: '26px', color: '#ffffff' })
      .setOrigin(0.5);

    this.input.on('pointerdown', this.handleTap, this);
  }

  update(_time: number, delta: number): void {
    if (this.resolved) return;
    this.progress = Math.min(1, this.progress + delta / CATCH_RING_DURATION_MS);
    this.drawRing();
    if (this.progress >= 1) this.finish(false);
  }

  private drawRing(): void {
    const bandOuter = Math.min(START_RADIUS, (1 - (this.band.center - this.band.width / 2)) * START_RADIUS);
    const bandInner = Math.max(0, (1 - (this.band.center + this.band.width / 2)) * START_RADIUS);
    const currentRadius = START_RADIUS * (1 - this.progress);

    this.ringGraphics.clear();
    this.ringGraphics.fillStyle(0x14311d, 1);
    this.ringGraphics.fillCircle(CENTER_X, CENTER_Y, START_RADIUS + 10);
    this.ringGraphics.fillStyle(0x66ff99, 0.5);
    this.ringGraphics.fillCircle(CENTER_X, CENTER_Y, bandOuter);
    this.ringGraphics.fillStyle(0x14311d, 1);
    this.ringGraphics.fillCircle(CENTER_X, CENTER_Y, bandInner);
    this.ringGraphics.lineStyle(6, 0xffffff, 1);
    this.ringGraphics.strokeCircle(CENTER_X, CENTER_Y, currentRadius);
  }

  private handleTap(): void {
    if (this.resolved) return;
    this.finish(resolveCatch(this.progress, this.band));
  }

  private finish(success: boolean): void {
    this.resolved = true;
    this.input.off('pointerdown', this.handleTap, this);
    this.time.delayedCall(150, () => {
      this.scene.stop();
      this.onResult(success);
    });
  }
}
