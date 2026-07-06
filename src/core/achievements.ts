import { ACHIEVEMENTS, AchievementDef, AchievementCheck } from '../data/achievements';
import { Biome } from '../data/species';

export interface AchievementContext {
  totalCatches: number;
  totalHatches: number;
  unlockedBiomes: Biome[];
  ownsShiny: boolean;
}

function isCheckMet(check: AchievementCheck, ctx: AchievementContext): boolean {
  switch (check.type) {
    case 'totalCatches':
      return ctx.totalCatches >= check.count;
    case 'totalHatches':
      return ctx.totalHatches >= check.count;
    case 'biomeUnlocked':
      return ctx.unlockedBiomes.includes(check.biome);
    case 'ownsShiny':
      return ctx.ownsShiny;
  }
}

/** Achievements newly satisfied by `ctx`, excluding ones already claimed. */
export function newlyCompletedAchievements(ctx: AchievementContext, claimed: string[]): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !claimed.includes(a.id) && isCheckMet(a.check, ctx));
}
