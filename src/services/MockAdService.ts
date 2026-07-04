import { MOCK_AD_DURATION_MS } from '../data/economy';
import { AdService } from './AdService';

/** Dev/browser stand-in for a rewarded ad: a plain DOM overlay (not a Phaser
 * scene — real ads cover the whole app, not just the game canvas) that fills
 * over MOCK_AD_DURATION_MS with a Skip button that forfeits the reward. */
export class MockAdService implements AdService {
  showRewardedAd(placementId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;gap:20px;';

      const label = document.createElement('div');
      label.textContent = `Mock rewarded ad — ${placementId}`;
      label.style.fontSize = '22px';

      const bar = document.createElement('div');
      bar.style.cssText = 'width:220px;height:10px;background:#333;border-radius:5px;overflow:hidden;';
      const fill = document.createElement('div');
      fill.style.cssText = 'height:100%;width:0%;background:#8bc34a;';
      bar.appendChild(fill);

      const skipBtn = document.createElement('button');
      skipBtn.textContent = 'Skip (forfeit reward)';
      skipBtn.style.cssText = 'padding:10px 22px;font-size:16px;cursor:pointer;';

      overlay.append(label, bar, skipBtn);
      document.body.appendChild(overlay);

      let done = false;
      const finish = (watched: boolean) => {
        if (done) return;
        done = true;
        document.body.removeChild(overlay);
        resolve(watched);
      };

      requestAnimationFrame(() => {
        fill.style.transition = `width ${MOCK_AD_DURATION_MS}ms linear`;
        fill.style.width = '100%';
      });
      skipBtn.addEventListener('click', () => finish(false));
      setTimeout(() => finish(true), MOCK_AD_DURATION_MS);
    });
  }
}
