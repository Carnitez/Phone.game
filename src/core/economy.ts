import {
  AD_PLACEMENTS,
  AD_PROMPT_COOLDOWN_MS,
  CHARM_COIN_RATE_PER_SEC,
  COIN_REWARD_BY_VARIANT,
  DAILY_GIFT_BASE_COINS,
  DAILY_GIFT_BOOSTED_COINS,
  GLOBAL_AD_DAILY_CAP,
  MILESTONE_THRESHOLDS,
  VariantTier,
} from '../data/economy';

/** Base coin reward for a successful catch, before any ad-doubling. */
export function catchCoinReward(variant: VariantTier): number {
  return COIN_REWARD_BY_VARIANT[variant];
}

/** Passive coins earned from a creature's Charm while it wanders the Grove. */
export function passiveCoinIncome(charm: number, elapsedSeconds: number): number {
  return charm * CHARM_COIN_RATE_PER_SEC * elapsedSeconds;
}

export interface AdPlacementState {
  count: number;
  lastGrantedAt: number;
}

export interface AdState {
  placements: Record<string, AdPlacementState>;
  globalCount: number;
  lastPromptAt: number;
  /** Local calendar day (YYYY-MM-DD) the counters were last reset for. */
  countersDay: string;
}

export function localDayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function createAdState(now: number): AdState {
  return { placements: {}, globalCount: 0, lastPromptAt: 0, countersDay: localDayKey(now) };
}

/** Returns `state` with per-day counters zeroed if local midnight has passed. */
export function resetAdStateIfNewDay(state: AdState, now: number): AdState {
  const today = localDayKey(now);
  if (today === state.countersDay) return state;
  return { placements: {}, globalCount: 0, lastPromptAt: state.lastPromptAt, countersDay: today };
}

/** Whether a rewarded-ad prompt for `placementId` may be shown right now,
 * honoring the placement's own cap and cooldown (e.g. double-catch-reward's
 * 90s), the blanket 60s prompt cooldown between any two ads, and the 20/day
 * global cap. */
export function canShowAd(state: AdState, placementId: string, now: number): boolean {
  const config = AD_PLACEMENTS[placementId];
  if (!config) return false;
  if (now - state.lastPromptAt < AD_PROMPT_COOLDOWN_MS) return false;
  if (state.globalCount >= GLOBAL_AD_DAILY_CAP) return false;
  const placementState = state.placements[placementId];
  if (config.capPerDay !== null && placementState && placementState.count >= config.capPerDay) return false;
  if (config.cooldownMs > 0 && placementState && now - placementState.lastGrantedAt < config.cooldownMs) return false;
  return true;
}

/** Records that a rewarded ad for `placementId` was watched and granted. */
export function grantAd(state: AdState, placementId: string, now: number): AdState {
  const existing = state.placements[placementId] ?? { count: 0, lastGrantedAt: 0 };
  return {
    ...state,
    placements: { ...state.placements, [placementId]: { count: existing.count + 1, lastGrantedAt: now } },
    globalCount: state.globalCount + 1,
    lastPromptAt: now,
  };
}

export const SPAWN_INTERVAL_FLOOR_MS = 20 * 1000;

/** Owned decorations reduce the average spawn interval, floored so it never
 * approaches zero. */
export function applySpawnIntervalReduction(baseMs: number, totalReductionMs: number): number {
  return Math.max(SPAWN_INTERVAL_FLOOR_MS, baseMs - totalReductionMs);
}

export interface DailyGiftState {
  /** Local day key (see localDayKey) of the last claim, or null if never claimed. */
  lastClaimedDay: string | null;
  /** Local day key on which the dailyGiftUpgrade ad was watched, if any. */
  boostedDay: string | null;
}

export function createDailyGiftState(): DailyGiftState {
  return { lastClaimedDay: null, boostedDay: null };
}

/** Whether today's daily gift is still unclaimed. */
export function canClaimDailyGift(state: DailyGiftState, now: number): boolean {
  return state.lastClaimedDay !== localDayKey(now);
}

/** Coin reward the player would get by claiming right now (boosted if the
 * dailyGiftUpgrade ad was already watched today). */
export function dailyGiftReward(state: DailyGiftState, now: number): number {
  return state.boostedDay === localDayKey(now) ? DAILY_GIFT_BOOSTED_COINS : DAILY_GIFT_BASE_COINS;
}

export function claimDailyGift(state: DailyGiftState, now: number): DailyGiftState {
  return { ...state, lastClaimedDay: localDayKey(now) };
}

export function boostDailyGift(state: DailyGiftState, now: number): DailyGiftState {
  return { ...state, boostedDay: localDayKey(now) };
}

/** Milestone thresholds newly crossed by `discoveredPct`, excluding ones already claimed. */
export function newlyReachedMilestones(discoveredPct: number, claimed: number[]): number[] {
  return MILESTONE_THRESHOLDS.filter((t) => discoveredPct >= t && !claimed.includes(t));
}
