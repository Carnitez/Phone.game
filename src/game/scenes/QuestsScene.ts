import Phaser from 'phaser';
import { getSaveManager, SaveManager } from '../../services/SaveManager';
import { claimQuest, isQuestClaimed, isQuestComplete, resetDailyQuestsIfNewDay } from '../../core/quests';
import { DAILY_QUESTS } from '../../data/quests';
import { ACHIEVEMENTS } from '../../data/achievements';

const ROW_HEIGHT = 90;

export class QuestsScene extends Phaser.Scene {
  private saveManager!: SaveManager;
  private container!: Phaser.GameObjects.Container;

  constructor() {
    super('Quests');
  }

  create(): void {
    this.saveManager = getSaveManager();
    this.saveManager.update((data) => {
      data.dailyQuests = resetDailyQuestsIfNewDay(data.dailyQuests, Date.now());
    });

    this.add.rectangle(360, 640, 720, 1280, 0x1a1429);
    this.add.rectangle(360, 60, 720, 120, 0x0f0c1a);
    this.add.text(30, 30, 'Quests', { fontSize: '32px', color: '#ffffff' });

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

    y = this.renderSectionLabel('Daily Quests', y);
    y = this.renderDailyQuests(y);
    y = this.renderSectionLabel('Achievements', y);
    this.renderAchievements(y);
  }

  private renderSectionLabel(label: string, y: number): number {
    const text = this.add.text(30, y, label, { fontSize: '20px', color: '#aaaaaa' }).setOrigin(0, 0.5);
    this.container.add(text);
    return y + 40;
  }

  private renderDailyQuests(y: number): number {
    const save = this.saveManager.get();
    const state = save.dailyQuests;

    DAILY_QUESTS.forEach((quest) => {
      const progress = state.progress[quest.id] ?? 0;
      const complete = isQuestComplete(state, quest);
      const claimed = isQuestClaimed(state, quest.id);

      const bg = this.add.rectangle(360, y + 40, 640, ROW_HEIGHT - 10, 0x2e2b42);
      const rewardParts = [
        quest.rewardCoins > 0 ? `${quest.rewardCoins} coins` : null,
        quest.rewardGems > 0 ? `${quest.rewardGems} gems` : null,
      ]
        .filter(Boolean)
        .join(', ');
      const label = this.add
        .text(50, y + 20, `${quest.description} (${Math.min(progress, quest.target)}/${quest.target}) — ${rewardParts}`, {
          fontSize: '18px',
          color: '#ffffff',
        })
        .setOrigin(0, 0.5);
      this.container.add([bg, label]);

      if (claimed) {
        const doneLabel = this.add.text(50, y + 55, 'Claimed', { fontSize: '18px', color: '#8bc34a' }).setOrigin(0, 0.5);
        this.container.add(doneLabel);
      } else if (complete) {
        const claimBtn = this.add
          .text(50, y + 55, 'Claim', { fontSize: '20px', color: '#ffe082' })
          .setOrigin(0, 0.5)
          .setInteractive({ useHandCursor: true });
        claimBtn.on('pointerdown', () => this.claim(quest.id, quest.rewardCoins, quest.rewardGems));
        this.container.add(claimBtn);
      } else {
        const pendingLabel = this.add.text(50, y + 55, 'In progress', { fontSize: '18px', color: '#888888' }).setOrigin(0, 0.5);
        this.container.add(pendingLabel);
      }

      y += ROW_HEIGHT;
    });

    return y;
  }

  private claim(questId: string, rewardCoins: number, rewardGems: number): void {
    this.saveManager.update((data) => {
      data.coins += rewardCoins;
      data.gems += rewardGems;
      data.dailyQuests = claimQuest(data.dailyQuests, questId);
    });
    this.render();
  }

  private renderAchievements(y: number): number {
    const save = this.saveManager.get();

    ACHIEVEMENTS.forEach((achievement) => {
      const unlocked = save.claimedAchievements.includes(achievement.id);
      const rewardParts = [
        achievement.rewardCoins > 0 ? `${achievement.rewardCoins} coins` : null,
        achievement.rewardGems > 0 ? `${achievement.rewardGems} gems` : null,
      ]
        .filter(Boolean)
        .join(', ');

      const bg = this.add.rectangle(360, y + 30, 640, ROW_HEIGHT - 50, unlocked ? 0x2e3b2b : 0x2e2b42);
      const label = this.add
        .text(50, y + 30, `${unlocked ? '🏆' : '🔒'} ${achievement.description} — ${rewardParts}`, {
          fontSize: '18px',
          color: unlocked ? '#8bc34a' : '#888888',
        })
        .setOrigin(0, 0.5);
      this.container.add([bg, label]);
      y += ROW_HEIGHT - 40;
    });

    return y;
  }
}
