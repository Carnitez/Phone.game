export interface DailyQuestDef {
  id: string;
  description: string;
  target: number;
  rewardCoins: number;
  rewardGems: number;
}

/** Fixed set of daily quests — same three every day, progress resets at
 * local midnight. Not randomized/rotating in MVP, keeping the reset logic
 * (and the player's mental model of "what resets today") simple. */
export const DAILY_QUESTS: DailyQuestDef[] = [
  { id: 'catch-3', description: 'Catch 3 creatures', target: 3, rewardCoins: 30, rewardGems: 0 },
  { id: 'hatch-1', description: 'Hatch 1 egg', target: 1, rewardCoins: 50, rewardGems: 0 },
  { id: 'watch-ad-1', description: 'Watch 1 rewarded ad', target: 1, rewardCoins: 0, rewardGems: 5 },
];
