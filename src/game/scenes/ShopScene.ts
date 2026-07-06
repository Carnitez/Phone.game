import Phaser from 'phaser';
import { getSaveManager, SaveManager } from '../../services/SaveManager';
import { tryShowRewardedAd } from '../../services/rewardedAds';
import { checkProgression } from '../../services/progression';
import { boostDailyGift, canClaimDailyGift, claimDailyGift, dailyGiftReward } from '../../core/economy';
import { DECORATIONS } from '../../data/decorations';
import { IAP_PRODUCTS } from '../../data/iap';
import { BIOME_UNLOCK_COST_COINS } from '../../data/economy';
import { Biome } from '../../data/species';

const ROW_HEIGHT = 90;

export class ShopScene extends Phaser.Scene {
  private saveManager!: SaveManager;
  private container!: Phaser.GameObjects.Container;
  private busy = false;

  constructor() {
    super('Shop');
  }

  create(): void {
    this.saveManager = getSaveManager();
    this.busy = false;

    this.add.rectangle(360, 640, 720, 1280, 0x1a1429);
    this.add.rectangle(360, 60, 720, 120, 0x0f0c1a);
    this.add.text(30, 30, 'Shop', { fontSize: '32px', color: '#ffffff' });

    const backBtn = this.add.text(650, 40, '✕', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.scene.stop();
      this.scene.resume('Grove');
    });

    this.container = this.add.container(0, 0);
    this.render();
  }

  private render(): void {
    this.container.removeAll(true);
    let y = 190;

    y = this.renderDailyGift(y);
    y = this.renderSectionLabel('Biomes', y);
    y = this.renderBiomes(y);
    y = this.renderSectionLabel('Decorations (boost spawn rate)', y);
    y = this.renderDecorations(y);
    y = this.renderSectionLabel('Gems & extras', y);
    this.renderIap(y);
  }

  private renderSectionLabel(label: string, y: number): number {
    const text = this.add.text(30, y, label, { fontSize: '20px', color: '#aaaaaa' }).setOrigin(0, 0.5);
    this.container.add(text);
    return y + 40;
  }

  private renderDailyGift(y: number): number {
    const save = this.saveManager.get();
    const now = Date.now();
    const claimable = canClaimDailyGift(save.dailyGift, now);
    const reward = dailyGiftReward(save.dailyGift, now);

    const bg = this.add.rectangle(360, y + 40, 640, ROW_HEIGHT - 10, 0x2e2b42);
    const label = this.add
      .text(50, y + 20, claimable ? `Daily Gift: ${reward} coins` : 'Daily Gift: claimed today', {
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);
    this.container.add([bg, label]);

    if (claimable) {
      const claimBtn = this.add
        .text(50, y + 55, 'Claim', { fontSize: '20px', color: '#8bc34a' })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      claimBtn.on('pointerdown', () => this.claimDailyGift());
      this.container.add(claimBtn);

      if (save.dailyGift.boostedDay === null) {
        const upgradeBtn = this.add
          .text(200, y + 55, '🎥 Watch ad to upgrade', { fontSize: '20px', color: '#42a5f5' })
          .setOrigin(0, 0.5)
          .setInteractive({ useHandCursor: true });
        upgradeBtn.on('pointerdown', () => this.upgradeDailyGift());
        this.container.add(upgradeBtn);
      }
    }

    return y + ROW_HEIGHT;
  }

  private async claimDailyGift(): Promise<void> {
    const now = Date.now();
    const save = this.saveManager.get();
    if (!canClaimDailyGift(save.dailyGift, now)) return;
    const reward = dailyGiftReward(save.dailyGift, now);
    this.saveManager.update((data) => {
      data.coins += reward;
      data.dailyGift = claimDailyGift(data.dailyGift, now);
    });
    this.render();
  }

  private async upgradeDailyGift(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const watched = await tryShowRewardedAd('dailyGiftUpgrade');
    if (watched) {
      this.saveManager.update((data) => {
        data.dailyGift = boostDailyGift(data.dailyGift, Date.now());
      });
    }
    this.busy = false;
    this.render();
  }

  private renderBiomes(y: number): number {
    const save = this.saveManager.get();
    const lockedBiomes = (Object.keys(BIOME_UNLOCK_COST_COINS) as Biome[]).filter(
      (biome) => BIOME_UNLOCK_COST_COINS[biome] !== null && !save.unlockedBiomes.includes(biome),
    );

    lockedBiomes.forEach((biome) => {
      const cost = BIOME_UNLOCK_COST_COINS[biome] as number;
      const name = biome[0].toUpperCase() + biome.slice(1);
      const bg = this.add.rectangle(360, y + 40, 640, ROW_HEIGHT - 10, 0x2e2b42);
      const label = this.add
        .text(50, y + 20, `${name} — ${cost} coins`, { fontSize: '20px', color: '#ffffff' })
        .setOrigin(0, 0.5);
      this.container.add([bg, label]);

      const canAfford = save.coins >= cost;
      const buyBtn = this.add
        .text(50, y + 55, 'Unlock', { fontSize: '20px', color: canAfford ? '#42a5f5' : '#666666' })
        .setOrigin(0, 0.5);
      if (canAfford) {
        buyBtn.setInteractive({ useHandCursor: true });
        buyBtn.on('pointerdown', () => this.unlockBiome(biome, cost));
      }
      this.container.add(buyBtn);
      y += ROW_HEIGHT;
    });

    return y;
  }

  private unlockBiome(biome: Biome, cost: number): void {
    const save = this.saveManager.get();
    if (save.unlockedBiomes.includes(biome) || save.coins < cost) return;
    this.saveManager.update((data) => {
      data.coins -= cost;
      data.unlockedBiomes.push(biome);
    });
    checkProgression();
    this.render();
  }

  private renderDecorations(y: number): number {
    const save = this.saveManager.get();
    DECORATIONS.forEach((decoration) => {
      const owned = save.decorations.includes(decoration.id);
      const bg = this.add.rectangle(360, y + 40, 640, ROW_HEIGHT - 10, 0x2e2b42);
      const label = this.add
        .text(50, y + 20, `${decoration.name} — ${decoration.cost} coins`, { fontSize: '20px', color: '#ffffff' })
        .setOrigin(0, 0.5);
      this.container.add([bg, label]);

      if (owned) {
        const ownedLabel = this.add.text(50, y + 55, 'Owned', { fontSize: '18px', color: '#8bc34a' }).setOrigin(0, 0.5);
        this.container.add(ownedLabel);
      } else {
        const canAfford = save.coins >= decoration.cost;
        const buyBtn = this.add
          .text(50, y + 55, 'Buy', { fontSize: '20px', color: canAfford ? '#42a5f5' : '#666666' })
          .setOrigin(0, 0.5);
        if (canAfford) {
          buyBtn.setInteractive({ useHandCursor: true });
          buyBtn.on('pointerdown', () => this.buyDecoration(decoration.id, decoration.cost));
        }
        this.container.add(buyBtn);
      }
      y += ROW_HEIGHT;
    });
    return y;
  }

  private buyDecoration(id: string, cost: number): void {
    const save = this.saveManager.get();
    if (save.decorations.includes(id) || save.coins < cost) return;
    this.saveManager.update((data) => {
      data.coins -= cost;
      data.decorations.push(id);
    });
    this.render();
  }

  private renderIap(y: number): number {
    const save = this.saveManager.get();
    IAP_PRODUCTS.forEach((product) => {
      const owned = product.kind === 'entitlement' && save.entitlements.includes(product.id);
      const bg = this.add.rectangle(360, y + 40, 640, ROW_HEIGHT - 10, 0x2e2b42);
      const label = this.add
        .text(50, y + 20, `${product.name} — ${product.priceLabel}`, { fontSize: '20px', color: '#ffffff' })
        .setOrigin(0, 0.5);
      this.container.add([bg, label]);

      if (owned) {
        const ownedLabel = this.add.text(50, y + 55, 'Owned', { fontSize: '18px', color: '#8bc34a' }).setOrigin(0, 0.5);
        this.container.add(ownedLabel);
      } else {
        const buyBtn = this.add
          .text(50, y + 55, '(stub) Buy', { fontSize: '20px', color: '#ffe082' })
          .setOrigin(0, 0.5)
          .setInteractive({ useHandCursor: true });
        buyBtn.on('pointerdown', () => this.buyIap(product.id));
        this.container.add(buyBtn);
      }
      y += ROW_HEIGHT;
    });
    return y;
  }

  private buyIap(productId: string): void {
    const product = IAP_PRODUCTS.find((p) => p.id === productId);
    if (!product) return;
    this.saveManager.update((data) => {
      if (product.kind === 'entitlement') {
        if (!data.entitlements.includes(product.id)) data.entitlements.push(product.id);
      } else if (product.kind === 'gems' && product.gemAmount) {
        data.gems += product.gemAmount;
      }
    });
    this.render();
  }
}
