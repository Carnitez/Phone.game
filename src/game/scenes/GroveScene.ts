import Phaser from 'phaser';
import { SaveManager } from '../../services/SaveManager';
import { createRng, randInt, Rng } from '../../core/rng';
import { rollWildVariant } from '../../core/catch';
import { Creature, createCreature, rollRandomStats } from '../../core/creature';
import { catchCoinReward } from '../../core/economy';
import { SPECIES, getSpecies } from '../../data/species';
import { OFFLINE_SPAWN_CAP, SPAWN_INTERVAL_MAX_MS, SPAWN_INTERVAL_MIN_MS, VariantTier } from '../../data/economy';
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
    this.saveManager = new SaveManager();
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
  }

  private buildTabBar(): void {
    const labels: Array<{ key: string; label: string }> = [
      { key: 'book', label: 'Book' },
      { key: 'shop', label: 'Shop' },
      { key: 'eggs', label: 'Eggs' },
    ];
    const barY = 1240;
    this.add.rectangle(360, barY, 720, 80, 0x0f0c1a);
    labels.forEach((entry, i) => {
      const x = 140 + i * 220;
      const btn = this.add.text(x, barY, entry.label, { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.showToast(`${entry.label} arrives in a later phase`));
    });
  }

  private catchUpOffline(): void {
    const save = this.saveManager.get();
    const elapsed = Math.max(0, Date.now() - save.lastOpenedAt);
    const avgInterval = (SPAWN_INTERVAL_MIN_MS + SPAWN_INTERVAL_MAX_MS) / 2;
    const estimated = Math.floor(elapsed / avgInterval);
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
    const delay = randInt(this.rng, SPAWN_INTERVAL_MIN_MS, SPAWN_INTERVAL_MAX_MS);
    this.time.delayedCall(delay, () => {
      this.spawnOne();
      this.scheduleNextSpawn();
    });
  }

  private spawnOne(): void {
    if (this.pending.size >= OFFLINE_SPAWN_CAP) return;

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
    } else {
      this.showToast('It got away!');
    }
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
