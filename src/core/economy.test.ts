import { describe, expect, it } from 'vitest';
import {
  applySpawnIntervalReduction,
  boostDailyGift,
  canClaimDailyGift,
  canShowAd,
  catchCoinReward,
  claimDailyGift,
  createAdState,
  createDailyGiftState,
  dailyGiftReward,
  grantAd,
  newlyReachedMilestones,
  passiveCoinIncome,
  resetAdStateIfNewDay,
  SPAWN_INTERVAL_FLOOR_MS,
} from './economy';
import { COIN_REWARD_BY_VARIANT, DAILY_GIFT_BASE_COINS, DAILY_GIFT_BOOSTED_COINS, GLOBAL_AD_DAILY_CAP } from '../data/economy';

describe('catchCoinReward', () => {
  it('rewards more coins for rarer variants', () => {
    expect(catchCoinReward('common')).toBe(COIN_REWARD_BY_VARIANT.common);
    expect(catchCoinReward('shiny')).toBeGreaterThan(catchCoinReward('rare'));
    expect(catchCoinReward('rare')).toBeGreaterThan(catchCoinReward('uncommon'));
    expect(catchCoinReward('uncommon')).toBeGreaterThan(catchCoinReward('common'));
  });
});

describe('passiveCoinIncome', () => {
  it('scales linearly with charm and elapsed time', () => {
    expect(passiveCoinIncome(0, 100)).toBe(0);
    expect(passiveCoinIncome(50, 10)).toBeCloseTo(passiveCoinIncome(50, 5) * 2, 5);
    expect(passiveCoinIncome(100, 10)).toBeGreaterThan(passiveCoinIncome(50, 10));
  });
});

describe('ad placement caps and cooldowns', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('allows a placement with room under its cap and no active cooldown', () => {
    const now = Date.parse('2026-01-01T12:00:00Z');
    const state = createAdState(now);
    expect(canShowAd(state, 'instantHatch', now)).toBe(true);
  });

  it('blocks once a per-placement daily cap is hit', () => {
    let now = Date.parse('2026-01-01T00:00:00Z');
    let state = createAdState(now);
    for (let i = 0; i < 3; i++) {
      expect(canShowAd(state, 'instantHatch', now)).toBe(true);
      state = grantAd(state, 'instantHatch', now);
      now += 61 * 1000; // clear the 60s global prompt cooldown between grants
    }
    expect(canShowAd(state, 'instantHatch', now)).toBe(false);
  });

  it('enforces the 60s prompt cooldown between any two ad prompts', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    let state = createAdState(now);
    state = grantAd(state, 'spawnSurge', now);
    expect(canShowAd(state, 'dailyGiftUpgrade', now + 1000)).toBe(false);
    expect(canShowAd(state, 'dailyGiftUpgrade', now + 61000)).toBe(true);
  });

  it('enforces the 20/day global cap across placements', () => {
    let now = Date.parse('2026-01-01T00:00:00Z');
    let state = createAdState(now);
    for (let i = 0; i < GLOBAL_AD_DAILY_CAP; i++) {
      state = grantAd(state, 'secondChance', now);
      now += 61 * 1000;
    }
    expect(canShowAd(state, 'secondChance', now)).toBe(false);
  });

  it('resets all counters at local midnight', () => {
    const day1 = Date.parse('2026-01-01T23:00:00Z');
    let state = createAdState(day1);
    state = grantAd(state, 'instantHatch', day1);
    expect(state.globalCount).toBe(1);

    const day2 = day1 + DAY;
    const reset = resetAdStateIfNewDay(state, day2);
    expect(reset.globalCount).toBe(0);
    expect(reset.placements.instantHatch).toBeUndefined();
  });

  it('leaves counters untouched within the same day', () => {
    const now = Date.parse('2026-01-01T10:00:00Z');
    let state = createAdState(now);
    state = grantAd(state, 'instantHatch', now);
    const still = resetAdStateIfNewDay(state, now + 60 * 1000);
    expect(still.globalCount).toBe(1);
  });

  it('enforces a placement-specific cooldown longer than the global 60s one (double-catch-reward: 90s)', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    let state = createAdState(now);
    state = grantAd(state, 'doubleCatchReward', now);
    // Past the blanket 60s prompt cooldown, but still inside doubleCatchReward's own 90s.
    expect(canShowAd(state, 'doubleCatchReward', now + 61 * 1000)).toBe(false);
    expect(canShowAd(state, 'doubleCatchReward', now + 91 * 1000)).toBe(true);
  });
});

describe('applySpawnIntervalReduction', () => {
  it('subtracts the reduction from the base interval', () => {
    expect(applySpawnIntervalReduction(90_000, 10_000)).toBe(80_000);
  });

  it('never drops below the floor', () => {
    expect(applySpawnIntervalReduction(90_000, 1_000_000)).toBe(SPAWN_INTERVAL_FLOOR_MS);
  });
});

describe('daily gift', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.parse('2026-01-01T12:00:00Z');

  it('is claimable when never claimed, at the base reward', () => {
    const state = createDailyGiftState();
    expect(canClaimDailyGift(state, now)).toBe(true);
    expect(dailyGiftReward(state, now)).toBe(DAILY_GIFT_BASE_COINS);
  });

  it('becomes unclaimable for the rest of the day after claiming', () => {
    let state = createDailyGiftState();
    state = claimDailyGift(state, now);
    expect(canClaimDailyGift(state, now)).toBe(false);
    expect(canClaimDailyGift(state, now + DAY)).toBe(true);
  });

  it('pays the boosted reward only on the day the upgrade ad was watched', () => {
    let state = createDailyGiftState();
    state = boostDailyGift(state, now);
    expect(dailyGiftReward(state, now)).toBe(DAILY_GIFT_BOOSTED_COINS);
    expect(dailyGiftReward(state, now + DAY)).toBe(DAILY_GIFT_BASE_COINS);
  });
});

describe('newlyReachedMilestones', () => {
  it('returns thresholds crossed by the current percentage', () => {
    expect(newlyReachedMilestones(30, [])).toEqual([25]);
    expect(newlyReachedMilestones(60, [])).toEqual([25, 50]);
    expect(newlyReachedMilestones(100, [])).toEqual([25, 50, 75, 100]);
  });

  it('excludes thresholds already claimed', () => {
    expect(newlyReachedMilestones(60, [25])).toEqual([50]);
    expect(newlyReachedMilestones(100, [25, 50, 75, 100])).toEqual([]);
  });

  it('returns nothing below the first threshold', () => {
    expect(newlyReachedMilestones(10, [])).toEqual([]);
  });
});
