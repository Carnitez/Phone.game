import Phaser from 'phaser';
import { getSaveManager, SaveManager } from '../../services/SaveManager';
import { tryShowRewardedAd } from '../../services/rewardedAds';
import { createRng, randInt, Rng } from '../../core/rng';
import { rollWildVariant } from '../../core/catch';
import { Creature, createCreature, rollRandomStats } from '../../core/creature';
import { applySpawnIntervalReduction, catchCoinReward } from '../../core/economy';
import { SPECIES, getSpecies } from '../../data/species';
import { OFFLINE_SPAWN_CAP, SPAWN_INTERVAL_MAX_MS, SPAWN_INTERVAL_MIN_MS, SPAWN_SURGE_COUNT, VariantTier } from '../../data/economy';
import { getDecoration } from '../../data/decorations';
import { creatureTextureKey } from '../sprites';

interface PendingSpawn {
  speciesId: string;
  variant: VariantTier;
  sprite: Phaser.GameObjects.Image;
}

let spawnSeq = 0;

export class GroveScene extends Phaser.Scene {
  private saveManager!: SaveManager;
  private rng!: Rng;
  private pending = new Map<string, PendingSpawn>();
  private coinText!: Phaser.GameObjects.Text;
  private groveBounds = { x: 40, y: 140, width: 640, height: 760 };

  constructor() {
    super('Grove');
  }

  create(): void {
    this.saveManager = getSaveManager();
    this.rng = createRng(Date.now() ^ 0x9e3779b9);
    this.pending.clear();

    this.add.rectangle(360, 640, 720, 1280, 0x1a1429);
    this.add.rectangle(
      this.groveBounds.x + this.groveBounds.width / 2,
      this.groveBounds.y + this.groveBounds.height / 2,
      this.groveBounds.width,
      this.groveBounds.height,
      0x2e6b3e,
    );

    this.buildTopBar();
    this.buildTabBar();

    this.saveManager.get().creatures.forEach((creature) => this.addResident(creature));
    this.catchUpOffline();
    this.scheduleNextSpawn();
    this.persistLastOpened();

    this.events.on('resident-added', (creature: Creature) => this.addResident(creature));
    this.events.on('resume', () => this.updateCoinText());

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('beforeunload', this.persistLastOpened);
  }

  shutdown(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.persistLastOpened);
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.persistLastOpened();
  };

  private persistLastOpened = (): void => {
    this.saveManager.update((data) => {
      data.lastOpenedAt = Date.now();
    });
  };

  private buildTopBar(): void {
    this.add.rectangle(360, 60, 720, 120, 0x0f0c1a);
    this.coinText = this.add.text(30, 40, '', { fontSize: '32px', color: '#ffe082' });
    this.updateCoinText();

    const surgeBtn = this.add.text(690, 40, '🎥⚡', { fontSize: '30px', color: '#ffffff' }).setOrigin(1, 0.5);
    surgeBtn.setInteractive({ useHandCursor: true });
    surgeBtn.on('pointerdown', () => this.watchSpawnSurgeAd());
  }

  private async watchSpawnSurgeAd(): Promise<void> {
    const watched = await tryShowRewardedAd('spawnSurge');
    if (!watched) return;
    for (let i = 0; i < SPAWN_SURGE_COUNT; i++) this.spawnOne(true);
    this.showToast(`Spawn surge! ${SPAWN_SURGE_COUNT} new creatures appeared`);
  }

  private buildTabBar(): void {
    const tabs: Array<{ label: string; scene: string }> = [
      { label: 'Book', scene: 'Book' },
      { label: 'Shop', scene: 'Shop' },
      { label: 'Eggs', scene: 'Incubator' },
    ];
    const barY = 1240;
    this.add.rectangle(360, barY, 720, 80, 0x0f0c1a);
    tabs.forEach((tab, i) => {
      const x = 140 + i * 220;
      const btn = this.add.text(x, barY, tab.label, { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        this.scene.launch(tab.scene);
        this.scene.pause();
      });
    });
  }

  /** Owned decorations shorten the average spawn interval (see Shop). */
  private spawnIntervalBounds(): { min: number; max: number } {
    const totalReduction = this.saveManager
      .get()
      .decorations.reduce((sum, id) => sum + getDecoration(id).spawnIntervalReductionMs, 0);
    return {
      min: applySpawnIntervalReduction(SPAWN_INTERVAL_MIN_MS, totalReduction),
      max: applySpawnIntervalReduction(SPAWN_INTERVAL_MAX_MS, totalReduction),
    };
  }

  private catchUpOffline(): void {
    const save = this.saveManager.get();
    const elapsed = Math.max(0, Date.now() - save.lastOpenedAt);
    const { min, max } = this.spawnIntervalBounds();
    const estimated = Math.floor(elapsed / ((min + max) / 2));
    const toSpawn = Math.min(estimated, OFFLINE_SPAWN_CAP);
    for (let i = 0; i < toSpawn; i++) this.spawnOne();
    if (toSpawn > 0) {
      this.showToast(
        estimated > OFFLINE_SPAWN_CAP
          ? 'Your Grove filled up while you were away!'
          : `${toSpawn} creature${toSpawn > 1 ? 's' : ''} appeared while you were away!`,
      );
    }
  }

  private scheduleNextSpawn(): void {
    const { min, max } = this.spawnIntervalBounds();
    const delay = randInt(this.rng, min, max);
    this.time.delayedCall(delay, () => {
      this.spawnOne();
      this.scheduleNextSpawn();
    });
  }

  /** `force` bypasses the waiting-creature cap — used by the spawnSurge ad
   * placement, which promises 3 spawns "now" regardless of how full the
   * Grove already is. */
  private spawnOne(force = false): void {
    if (!force && this.pending.size >= OFFLINE_SPAWN_CAP) return;

    const species = SPECIES[randInt(this.rng, 0, SPECIES.length - 1)];
    const variant = rollWildVariant(this.rng);
    const x = randInt(this.rng, this.groveBounds.x + 40, this.groveBounds.x + this.groveBounds.width - 40);
    const y = randInt(this.rng, this.groveBounds.y + 40, this.groveBounds.y + this.groveBounds.height - 40);

    const id = `spawn-${(spawnSeq += 1)}`;
    const sprite = this.add.image(x, y, creatureTextureKey(variant)).setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => this.startCatch(id));
    this.addWander(sprite, x, y);

    this.pending.set(id, { speciesId: species.id, variant, sprite });
  }

  /** Renders an already-owned creature wandering the Grove (non-interactive —
   * catching is only for wild spawns). */
  private addResident(creature: Creature): void {
    const x = randInt(this.rng, this.groveBounds.x + 40, this.groveBounds.x + this.groveBounds.width - 40);
    const y = randInt(this.rng, this.groveBounds.y + 40, this.groveBounds.y + this.groveBounds.height - 40);
    const sprite = this.add.image(x, y, creatureTextureKey(creature.variant));
    this.addWander(sprite, x, y);
  }

  private addWander(sprite: Phaser.GameObjects.Image, x: number, y: number): void {
    this.tweens.add({
      targets: sprite,
      x: x + randInt(this.rng, -60, 60),
      y: y + randInt(this.rng, -60, 60),
      duration: randInt(this.rng, 2000, 4000),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private startCatch(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    entry.sprite.disableInteractive();

    this.scene.launch('Catch', {
      variant: entry.variant,
      onResult: (success: boolean) => this.resolveCatchResult(entry, success),
    });
    this.scene.pause();
  }

  private resolveCatchResult(entry: PendingSpawn, success: boolean): void {
    entry.sprite.destroy();
    this.scene.resume('Grove');

    if (success) {
      const stats = rollRandomStats(this.rng);
      const creature = createCreature(entry.speciesId, entry.variant, stats, Date.now());
      const reward = catchCoinReward(entry.variant);
      this.saveManager.update((data) => {
        data.creatures.push(creature);
        data.coins += reward;
      });
      this.updateCoinText();
      this.addResident(creature);
      this.showToast(`Caught a ${entry.variant} ${getSpecies(entry.speciesId).name}! +${reward} coins`);
      this.offerDoubleCatchReward(reward);
    } else {
      this.showToast('It got away!');
    }
  }

  /** Double-catch-reward rewarded-ad placement: shown right after a catch,
   * auto-dismisses if ignored. */
  private offerDoubleCatchReward(reward: number): void {
    const prompt = this.add
      .text(360, 260, `🎥 Double this catch's coins? (+${reward})`, {
        fontSize: '22px',
        color: '#ffe082',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });

    prompt.on('pointerdown', async () => {
      prompt.disableInteractive();
      const watched = await tryShowRewardedAd('doubleCatchReward');
      prompt.destroy();
      if (watched) {
        this.saveManager.update((data) => {
          data.coins += reward;
        });
        this.updateCoinText();
        this.showToast(`+${reward} bonus coins!`);
      }
    });

    this.tweens.add({ targets: prompt, alpha: 0, delay: 4000, duration: 400, onComplete: () => prompt.destroy() });
  }

  private updateCoinText(): void {
    this.coinText.setText(`🪙 ${Math.floor(this.saveManager.get().coins)}`);
  }

  private showToast(message: string): void {
    const toast = this.add
      .text(360, 200, message, { fontSize: '26px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 16, y: 10 } })
      .setOrigin(0.5)
      .setDepth(1000);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      delay: 1400,
      duration: 400,
      onComplete: () => toast.destroy(),
    });
  }
}
