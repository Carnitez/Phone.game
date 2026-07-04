import Phaser from 'phaser';
import { bandForVariant, CatchBand, resolveCatch } from '../../core/catch';
import { createRng } from '../../core/rng';
import { CATCH_RING_DURATION_MS, VariantTier } from '../../data/economy';
import { tryShowRewardedAd } from '../../services/rewardedAds';

interface CatchSceneData {
  variant: VariantTier;
  onResult: (success: boolean) => void;
}

const CENTER_X = 360;
const CENTER_Y = 640;
const START_RADIUS = 260;
const RETRY_PROMPT_TIMEOUT_MS = 3000;
/** "retry a failed rare/shiny catch" — the secondChance placement only applies to these tiers. */
const SECOND_CHANCE_VARIANTS: VariantTier[] = ['rare', 'shiny'];

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
  private awaitingRetryDecision = false;
  private ringGraphics!: Phaser.GameObjects.Graphics;
  private retryPrompt?: Phaser.GameObjects.Text;
  private retryTimeoutEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super('Catch');
  }

  init(data: CatchSceneData): void {
    this.variant = data.variant;
    this.onResult = data.onResult;
    this.progress = 0;
    this.resolved = false;
    this.awaitingRetryDecision = false;
    this.retryPrompt = undefined;
  }

  create(): void {
    this.add.rectangle(CENTER_X, CENTER_Y, 720, 1280, 0x000000, 0.55);
    this.rollNewBand();

    this.ringGraphics = this.add.graphics();
    this.add
      .text(CENTER_X, CENTER_Y - 320, 'Tap when the ring hits the glow!', { fontSize: '26px', color: '#ffffff' })
      .setOrigin(0.5);

    this.input.on('pointerdown', this.handleTap, this);
  }

  private rollNewBand(): void {
    const rng = createRng((Date.now() ^ 0x2545f491) >>> 0);
    const center = 0.3 + rng() * 0.4;
    this.band = bandForVariant(this.variant, center);
  }

  update(_time: number, delta: number): void {
    if (this.resolved || this.awaitingRetryDecision) return;
    this.progress = Math.min(1, this.progress + delta / CATCH_RING_DURATION_MS);
    this.drawRing();
    if (this.progress >= 1) this.attemptResult(false);
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
    if (this.resolved || this.awaitingRetryDecision) return;
    this.attemptResult(resolveCatch(this.progress, this.band));
  }

  private attemptResult(success: boolean): void {
    if (success || !SECOND_CHANCE_VARIANTS.includes(this.variant)) {
      this.finish(success);
      return;
    }
    this.offerSecondChance();
  }

  private offerSecondChance(): void {
    this.awaitingRetryDecision = true;
    this.retryPrompt = this.add
      .text(CENTER_X, CENTER_Y + 320, '🎥 Watch ad for a second chance?', {
        fontSize: '24px',
        color: '#ffe082',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.retryPrompt.on('pointerdown', async () => {
      this.retryTimeoutEvent?.remove();
      this.retryPrompt?.disableInteractive();
      const watched = await tryShowRewardedAd('secondChance');
      this.retryPrompt?.destroy();
      this.retryPrompt = undefined;
      if (watched) {
        this.progress = 0;
        this.rollNewBand();
        this.awaitingRetryDecision = false;
      } else {
        this.finish(false);
      }
    });

    // Only auto-dismisses while the player hasn't tapped the prompt yet — the
    // ad itself takes ~MOCK_AD_DURATION_MS to resolve, close to this timeout,
    // so tapping cancels it (see above) rather than letting both race.
    this.retryTimeoutEvent = this.time.delayedCall(RETRY_PROMPT_TIMEOUT_MS, () => {
      if (this.awaitingRetryDecision) {
        this.retryPrompt?.destroy();
        this.retryPrompt = undefined;
        this.finish(false);
      }
    });
  }

  private finish(success: boolean): void {
    this.resolved = true;
    this.awaitingRetryDecision = false;
    this.input.off('pointerdown', this.handleTap, this);
    this.time.delayedCall(150, () => {
      this.scene.stop();
      this.onResult(success);
    });
  }
}
