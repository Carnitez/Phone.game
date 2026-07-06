import Phaser from 'phaser';
import { getSaveManager } from '../../services/SaveManager';
import { createRng, randInt, Rng } from '../../core/rng';
import { creatureTextureKey } from '../sprites';

const ZONE = { x: 40, y: 140, width: 640, height: 1060 };
const COLS = 4;
const CELL = 155;

/** Read-only view of every creature you've caught, laid out on a fixed grid
 * so it never overlaps regardless of collection size (unlike free-roaming
 * wander, which gets crowded fast) — separate full-screen view from the Wild
 * catching screen, which they used to share as a cramped split panel. */
export class HabitatScene extends Phaser.Scene {
  private rng!: Rng;

  constructor() {
    super('Habitat');
  }

  create(): void {
    this.rng = createRng(Date.now() ^ 0x51ed270b);

    this.add.rectangle(360, 640, 720, 1280, 0x1a1429);
    this.add.rectangle(360, 60, 720, 120, 0x0f0c1a);
    this.add.text(30, 30, 'Your Grove', { fontSize: '32px', color: '#ffffff' });

    const backBtn = this.add.text(650, 40, '✕', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.scene.stop();
      this.scene.resume('Grove');
    });

    const creatures = getSaveManager().get().creatures;
    if (creatures.length === 0) {
      this.add
        .text(360, 640, 'Catch some creatures in the Wild\nto fill your Grove!', {
          fontSize: '24px',
          color: '#aaaaaa',
          align: 'center',
        })
        .setOrigin(0.5);
      return;
    }

    const rows = Math.max(1, Math.floor(ZONE.height / CELL));
    const maxShown = COLS * rows;
    const shown = creatures.slice(0, maxShown);

    shown.forEach((creature, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = ZONE.x + col * CELL + CELL / 2;
      const cy = ZONE.y + row * CELL + CELL / 2;

      const sprite = this.add.image(cx, cy, creatureTextureKey(creature.speciesId)).setDisplaySize(CELL - 45, CELL - 45);
      this.tweens.add({
        targets: sprite,
        x: cx + randInt(this.rng, -10, 10),
        y: cy + randInt(this.rng, -8, 8),
        duration: randInt(this.rng, 2200, 3600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    if (creatures.length > maxShown) {
      this.add
        .text(360, ZONE.y + rows * CELL + 30, `+${creatures.length - maxShown} more in your Grove`, {
          fontSize: '20px',
          color: '#888888',
        })
        .setOrigin(0.5);
    }
  }
}
