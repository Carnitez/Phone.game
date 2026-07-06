import { canShowAd, grantAd, resetAdStateIfNewDay } from '../core/economy';
import { incrementQuestProgress, resetDailyQuestsIfNewDay } from '../core/quests';
import { getAdService } from './getAdService';
import { getSaveManager } from './SaveManager';

/**
 * Single entry point every rewarded-ad placement goes through: resets
 * per-day counters if local midnight has passed, checks the placement's cap
 * and cooldown (plus the blanket 60s/20-per-day rules), plays the ad if
 * eligible, and records the grant. Callers just award the placement's reward
 * when this resolves true.
 */
export async function tryShowRewardedAd(placementId: string): Promise<boolean> {
  const now = Date.now();
  const saveManager = getSaveManager();

  saveManager.update((data) => {
    data.adState = resetAdStateIfNewDay(data.adState, now);
  });
  if (!canShowAd(saveManager.get().adState, placementId, now)) return false;

  const watched = await getAdService().showRewardedAd(placementId);
  if (watched) {
    saveManager.update((data) => {
      data.adState = grantAd(data.adState, placementId, now);
      data.dailyQuests = resetDailyQuestsIfNewDay(data.dailyQuests, now);
      data.dailyQuests = incrementQuestProgress(data.dailyQuests, 'watch-ad-1');
    });
  }
  return watched;
}
