import { Biome } from './species';

export type AchievementCheck =
  | { type: 'totalCatches'; count: number }
  | { type: 'totalHatches'; count: number }
  | { type: 'biomeUnlocked'; biome: Biome }
  | { type: 'ownsShiny' };

export interface AchievementDef {
  id: string;
  description: string;
  rewardCoins: number;
  rewardGems: number;
  check: AchievementCheck;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-catch', description: 'Catch your first creature', rewardCoins: 20, rewardGems: 0, check: { type: 'totalCatches', count: 1 } },
  { id: 'catch-10', description: 'Catch 10 creatures', rewardCoins: 50, rewardGems: 0, check: { type: 'totalCatches', count: 10 } },
  { id: 'catch-50', description: 'Catch 50 creatures', rewardCoins: 150, rewardGems: 5, check: { type: 'totalCatches', count: 50 } },
  { id: 'first-hatch', description: 'Hatch your first egg', rewardCoins: 30, rewardGems: 0, check: { type: 'totalHatches', count: 1 } },
  { id: 'unlock-pond', description: 'Unlock the Pond biome', rewardCoins: 0, rewardGems: 5, check: { type: 'biomeUnlocked', biome: 'pond' } },
  { id: 'unlock-forest', description: 'Unlock the Forest biome', rewardCoins: 0, rewardGems: 10, check: { type: 'biomeUnlocked', biome: 'forest' } },
  { id: 'own-shiny', description: 'Own a Shiny creature', rewardCoins: 0, rewardGems: 15, check: { type: 'ownsShiny' } },
];
