import { AdService } from './AdService';
import { MockAdService } from './MockAdService';

let instance: AdService | null = null;

/** Phase 5 will branch this on Capacitor.isNativePlatform() to return
 * AdMobService instead; MockAdService is always used in the browser. */
export function getAdService(): AdService {
  if (!instance) instance = new MockAdService();
  return instance;
}
