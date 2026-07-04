/** Rewarded-ad abstraction. `MockAdService` backs it in the browser today;
 * `AdMobService` (Phase 5) implements the same interface for native builds,
 * so nothing calling `showRewardedAd` needs to change when that lands. */
export interface AdService {
  /** Resolves true if the ad played to completion (grant the reward), false
   * if the player skipped/dismissed it early (no reward). */
  showRewardedAd(placementId: string): Promise<boolean>;
}
