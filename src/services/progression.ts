import { getSaveManager } from './SaveManager';
import { newlyReachedMilestones } from '../core/economy';
import { newlyCompletedAchievements } from '../core/achievements';
import { MILESTONE_GEM_REWARDS } from '../data/economy';
import { SPECIES } from '../data/species';
import { VARIANT_TIERS } from '../data/economy';

/** Call after any action that could complete a milestone or achievement
 * (catch, hatch, biome unlock). Grants rewards in a single save update and
 * returns human-readable toast messages for the caller to display. */
export function checkProgression(): string[] {
  const saveManager = getSaveManager();
  const save = saveManager.get();

  const discovered = new Set<string>();
  for (const creature of save.creatures) discovered.add(`${creature.speciesId}:${creature.variant}`);
  const totalCells = SPECIES.length * VARIANT_TIERS.length;
  const discoveredPct = (discovered.size / totalCells) * 100;

  const milestones = newlyReachedMilestones(discoveredPct, save.claimedMilestones);
  const achievements = newlyCompletedAchievements(
    {
      totalCatches: save.lifetimeStats.totalCatches,
      totalHatches: save.lifetimeStats.totalHatches,
      unlockedBiomes: save.unlockedBiomes,
      ownsShiny: save.creatures.some((c) => c.variant === 'shiny'),
    },
    save.claimedAchievements,
  );

  if (milestones.length === 0 && achievements.length === 0) return [];

  const messages: string[] = [];
  saveManager.update((data) => {
    for (const threshold of milestones) {
      const reward = MILESTONE_GEM_REWARDS[threshold] ?? 0;
      data.gems += reward;
      data.claimedMilestones.push(threshold);
      messages.push(`🎉 ${threshold}% discovered! +${reward} gems`);
    }
    for (const achievement of achievements) {
      data.coins += achievement.rewardCoins;
      data.gems += achievement.rewardGems;
      data.claimedAchievements.push(achievement.id);
      const rewardParts = [
        achievement.rewardCoins > 0 ? `+${achievement.rewardCoins} coins` : null,
        achievement.rewardGems > 0 ? `+${achievement.rewardGems} gems` : null,
      ].filter(Boolean);
      messages.push(`🏆 ${achievement.description}! ${rewardParts.join(', ')}`);
    }
  });

  return messages;
}
