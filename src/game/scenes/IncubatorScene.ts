import Phaser from 'phaser';
import { getSaveManager, SaveManager } from '../../services/SaveManager';
import { breed, canBreed } from '../../core/breeding';
import { Creature, createCreature } from '../../core/creature';
import { createRng } from '../../core/rng';
import { createEggId, Egg } from '../../core/save';
import { getSpecies } from '../../data/species';
import {
  INCUBATOR_MAX_SLOTS,
  INCUBATOR_SLOT_3_COST_COINS,
  INCUBATOR_SLOT_4_COST_GEMS,
} from '../../data/economy';
import { formatDuration } from '../format';
import { tryShowRewardedAd } from '../../services/rewardedAds';
import { creatureTextureKey } from '../sprites';

const ROW_HEIGHT = 130;
const LIST_START_Y = 200;

type Mode = 'slots' | 'picking' | 'hatch-reveal';

export class IncubatorScene extends Phaser.Scene {
  private saveManager!: SaveManager;
  private mode: Mode = 'slots';
  private selectedIds: string[] = [];
  private hatchRevealCreature?: Creature;
  private container!: Phaser.GameObjects.Container;
  private refreshEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super('Incubator');
  }

  create(): void {
    this.saveManager = getSaveManager();
    this.mode = 'slots';
    this.selectedIds = [];

    this.add.rectangle(360, 640, 720, 1280, 0x1a1429);
    this.add.rectangle(360, 60, 720, 120, 0x0f0c1a);
    this.add.text(30, 30, 'Incubator', { fontSize: '32px', color: '#ffffff' });

    const backBtn = this.add.text(650, 40, '✕', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.scene.stop();
      this.scene.resume('Grove');
    });

    this.container = this.add.container(0, 0);
    // Only the egg countdowns need a periodic re-render; re-running
    // renderHatchReveal() every tick would restart its pop-in tween.
    this.refreshEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.mode === 'slots') this.render();
      },
    });
    this.events.once('shutdown', () => this.refreshEvent?.remove());

    this.render();
  }

  private render(): void {
    this.container.removeAll(true);
    if (this.mode === 'slots') this.renderSlots();
    else if (this.mode === 'picking') this.renderPicker();
    else this.renderHatchReveal();
  }

  private renderHatchReveal(): void {
    const creature = this.hatchRevealCreature;
    if (!creature) {
      this.mode = 'slots';
      this.render();
      return;
    }
    const species = getSpecies(creature.speciesId);

    const overlay = this.add
      .rectangle(360, 640, 720, 1280, 0x000000, 0.75)
      .setInteractive({ useHandCursor: true });
    const sprite = this.add.image(360, 520, creatureTextureKey(creature.variant)).setDisplaySize(0, 0);
    const title = this.add
      .text(360, 660, `A ${creature.variant} ${species.name} hatched!`, { fontSize: '26px', color: '#ffe082' })
      .setOrigin(0.5);
    const stats = this.add
      .text(360, 710, `Charm ${creature.stats.charm} · Vitality ${creature.stats.vitality} · Fortune ${creature.stats.fortune}`, {
        fontSize: '18px',
        color: '#cccccc',
      })
      .setOrigin(0.5);
    const continueLabel = this.add
      .text(360, 770, 'Tap to continue', { fontSize: '18px', color: '#888888' })
      .setOrigin(0.5);

    this.container.add([overlay, sprite, title, stats, continueLabel]);

    this.tweens.add({
      targets: sprite,
      displayWidth: 160,
      displayHeight: 160,
      duration: 400,
      ease: 'Back.easeOut',
    });

    overlay.on('pointerdown', () => {
      this.hatchRevealCreature = undefined;
      this.mode = 'slots';
      this.render();
    });
  }

  private renderSlots(): void {
    const save = this.saveManager.get();
    let y = LIST_START_Y;

    save.eggs.forEach((egg) => {
      this.drawEggRow(egg, y);
      y += ROW_HEIGHT;
    });

    const emptySlots = save.incubatorSlots - save.eggs.length;
    if (emptySlots > 0) {
      this.drawEmptySlotRow(emptySlots, y);
      y += ROW_HEIGHT;
    }

    if (save.incubatorSlots < INCUBATOR_MAX_SLOTS) {
      this.drawUnlockButton(save.incubatorSlots, y);
    }
  }

  private drawEggRow(egg: Egg, y: number): void {
    const bg = this.add.rectangle(360, y + 55, 640, ROW_HEIGHT - 20, 0x2e2b42);
    const species = getSpecies(egg.speciesId);
    const remaining = egg.hatchesAt - Date.now();
    const nameLabel = this.add
      .text(60, y + 30, `${egg.variant} ${species.name} egg`, { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0, 0.5);

    this.container.add([bg, nameLabel]);

    if (remaining <= 0) {
      const hatchBtn = this.add
        .text(60, y + 78, 'Ready to hatch! Tap here', { fontSize: '22px', color: '#ffe082' })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      hatchBtn.on('pointerdown', () => this.hatch(egg.id));
      this.container.add(hatchBtn);
    } else {
      const timeLabel = this.add
        .text(60, y + 78, `Hatches in ${formatDuration(remaining)}`, { fontSize: '20px', color: '#aaaaaa' })
        .setOrigin(0, 0.5);
      this.container.add(timeLabel);

      const instantHatchBtn = this.add
        .text(600, y + 78, '🎥 Skip timer', { fontSize: '18px', color: '#42a5f5' })
        .setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true });
      instantHatchBtn.on('pointerdown', () => this.watchInstantHatchAd(egg.id));
      this.container.add(instantHatchBtn);
    }
  }

  private async watchInstantHatchAd(eggId: string): Promise<void> {
    const watched = await tryShowRewardedAd('instantHatch');
    if (!watched) return;
    this.saveManager.update((data) => {
      const egg = data.eggs.find((e) => e.id === eggId);
      if (egg) egg.hatchesAt = Date.now();
    });
    this.render();
  }

  private drawEmptySlotRow(emptySlots: number, y: number): void {
    const bg = this.add.rectangle(360, y + 55, 640, ROW_HEIGHT - 20, 0x24314b);
    const label = this.add
      .text(60, y + 30, `${emptySlots} empty slot${emptySlots > 1 ? 's' : ''}`, { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0, 0.5);
    const breedBtn = this.add
      .text(60, y + 78, 'Breed a pair', { fontSize: '22px', color: '#42a5f5' })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    breedBtn.on('pointerdown', () => {
      this.mode = 'picking';
      this.selectedIds = [];
      this.render();
    });
    this.container.add([bg, label, breedBtn]);
  }

  private drawUnlockButton(currentSlots: number, y: number): void {
    const usingGems = currentSlots >= 3;
    const cost = usingGems ? INCUBATOR_SLOT_4_COST_GEMS : INCUBATOR_SLOT_3_COST_COINS;
    const currency = usingGems ? 'gems' : 'coins';
    const btn = this.add
      .text(360, y + 30, `Unlock slot ${currentSlots + 1} (${cost} ${currency})`, {
        fontSize: '22px',
        color: '#8bc34a',
        backgroundColor: '#00000055',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.unlockSlot(usingGems, cost));
    this.container.add(btn);
  }

  private unlockSlot(usingGems: boolean, cost: number): void {
    const save = this.saveManager.get();
    if (usingGems ? save.gems < cost : save.coins < cost) return;
    this.saveManager.update((data) => {
      if (usingGems) data.gems -= cost;
      else data.coins -= cost;
      data.incubatorSlots += 1;
    });
    this.render();
  }

  private renderPicker(): void {
    const save = this.saveManager.get();
    const now = Date.now();

    const title = this.add
      .text(360, 175, 'Pick two of the same species to breed', { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5);
    this.container.add(title);

    let y = 220;
    save.creatures.forEach((creature) => {
      const species = getSpecies(creature.speciesId);
      const selected = this.selectedIds.includes(creature.id);
      const onCooldown = creature.breedingCooldownUntil > now;
      const color = onCooldown ? '#666666' : selected ? '#ffe082' : '#ffffff';
      const suffix = onCooldown ? ` [cooldown ${formatDuration(creature.breedingCooldownUntil - now)}]` : '';
      const label = `${species.name} (${creature.variant}) C${creature.stats.charm}/V${creature.stats.vitality}/F${creature.stats.fortune}${suffix}`;
      const row = this.add.text(60, y, label, { fontSize: '18px', color }).setOrigin(0, 0.5);
      if (!onCooldown) {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerdown', () => this.toggleSelect(creature.id));
      }
      this.container.add(row);
      y += 36;
    });

    const cancelBtn = this.add
      .text(180, 1150, 'Cancel', { fontSize: '24px', color: '#ff8a80' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => {
      this.mode = 'slots';
      this.render();
    });
    this.container.add(cancelBtn);

    if (this.selectedIds.length === 2) {
      const [aId, bId] = this.selectedIds;
      const a = save.creatures.find((c) => c.id === aId);
      const b = save.creatures.find((c) => c.id === bId);
      if (a && b && canBreed(a, b, now)) {
        const confirmBtn = this.add
          .text(540, 1150, 'Breed!', { fontSize: '26px', color: '#8bc34a' })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        confirmBtn.on('pointerdown', () => this.confirmBreed(aId, bId));
        this.container.add(confirmBtn);
      } else {
        const warn = this.add
          .text(540, 1150, 'Not a valid pair', { fontSize: '20px', color: '#ff8a80' })
          .setOrigin(0.5);
        this.container.add(warn);
      }
    }
  }

  private toggleSelect(id: string): void {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((existing) => existing !== id);
    } else if (this.selectedIds.length < 2) {
      this.selectedIds = [...this.selectedIds, id];
    }
    this.render();
  }

  private confirmBreed(aId: string, bId: string): void {
    const save = this.saveManager.get();
    const now = Date.now();
    const a = save.creatures.find((c) => c.id === aId);
    const b = save.creatures.find((c) => c.id === bId);
    if (!a || !b || !canBreed(a, b, now) || save.eggs.length >= save.incubatorSlots) return;

    const rng = createRng(now ^ 0xabcdef01);
    const result = breed(rng, a, b);
    const egg: Egg = {
      id: createEggId(),
      speciesId: a.speciesId,
      variant: result.variant,
      stats: result.stats,
      parentAId: a.id,
      parentBId: b.id,
      hatchesAt: now + result.eggTimerMs,
    };

    this.saveManager.update((data) => {
      const parentA = data.creatures.find((c) => c.id === aId);
      const parentB = data.creatures.find((c) => c.id === bId);
      if (parentA) parentA.breedingCooldownUntil = now + result.cooldownMs;
      if (parentB) parentB.breedingCooldownUntil = now + result.cooldownMs;
      data.eggs.push(egg);
    });

    this.mode = 'slots';
    this.selectedIds = [];
    this.render();
  }

  private hatch(eggId: string): void {
    const save = this.saveManager.get();
    const egg = save.eggs.find((e) => e.id === eggId);
    if (!egg || egg.hatchesAt > Date.now()) return;

    const creature = createCreature(egg.speciesId, egg.variant, egg.stats, Date.now());
    this.saveManager.update((data) => {
      data.eggs = data.eggs.filter((e) => e.id !== eggId);
      data.creatures.push(creature);
    });
    this.scene.get('Grove').events.emit('resident-added', creature);

    this.hatchRevealCreature = creature;
    this.mode = 'hatch-reveal';
    this.render();
  }
}
