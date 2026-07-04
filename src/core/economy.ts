import { AD_PLACEMENTS, COIN_REWARD_BY_VARIANT, CHARM_COIN_RATE_PER_SEC, GLOBAL_AD_DAILY_CAP, AD_PROMPT_COOLDOWN_MS, VariantTier } from '../data/economy';

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
 * honoring the placement's own cap/cooldown, the 60s prompt cooldown, and
 * the 20/day global cap. */
export function canShowAd(state: AdState, placementId: string, now: number): boolean {
  const config = AD_PLACEMENTS[placementId];
  if (!config) return false;
  if (now - state.lastPromptAt < AD_PROMPT_COOLDOWN_MS) return false;
  if (state.globalCount >= GLOBAL_AD_DAILY_CAP) return false;
  const placementState = state.placements[placementId];
  if (config.capPerDay !== null && placementState && placementState.count >= config.capPerDay) return false;
  return true;
}

/** Records that a rewarded ad for `placementId` was watched and granted. */
export function grantAd(state: AdState, placementId: string, now: number): AdState {
  const existing = state.placements[placementId] ?? { count: 0 };
  return {
    ...state,
    placements: { ...state.placements, [placementId]: { count: existing.count + 1 } },
    globalCount: state.globalCount + 1,
    lastPromptAt: now,
  };
}
