import Phaser from 'phaser';
import { getSaveManager } from '../../services/SaveManager';
import { SPECIES } from '../../data/species';
import { VARIANT_TIERS } from '../../data/economy';
import { creatureTextureKey, silhouetteTextureKey } from '../sprites';

const CELL_SIZE = 40;
const ROW_HEIGHT = 76;
const GRID_START_Y = 220;
const LEFT_MARGIN = 40;
const NAME_WIDTH = 220;

export class BookScene extends Phaser.Scene {
  constructor() {
    super('Book');
  }

  create(): void {
    const save = getSaveManager().get();
    const discovered = new Set<string>();
    for (const creature of save.creatures) discovered.add(`${creature.speciesId}:${creature.variant}`);

    this.add.rectangle(360, 640, 720, 1280, 0x1a1429);
    this.add.rectangle(360, 60, 720, 120, 0x0f0c1a);
    this.add.text(30, 30, 'Collection Book', { fontSize: '32px', color: '#ffffff' });

    const totalCells = SPECIES.length * VARIANT_TIERS.length;
    const pct = Math.round((discovered.size / totalCells) * 100);
    this.add.text(30, 74, `${discovered.size}/${totalCells} discovered (${pct}%)`, { fontSize: '22px', color: '#ffe082' });

    const backBtn = this.add.text(650, 40, '✕', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.scene.stop();
      this.scene.resume('Grove');
    });

    this.add.text(LEFT_MARGIN, GRID_START_Y - 40, 'Species', { fontSize: '20px', color: '#aaaaaa' });
    VARIANT_TIERS.forEach((variant, i) => {
      this.add
        .text(LEFT_MARGIN + NAME_WIDTH + i * (CELL_SIZE + 20) + CELL_SIZE / 2, GRID_START_Y - 40, variant[0].toUpperCase(), {
          fontSize: '18px',
          color: '#aaaaaa',
        })
        .setOrigin(0.5);
    });

    SPECIES.forEach((species, row) => {
      const y = GRID_START_Y + row * ROW_HEIGHT + CELL_SIZE / 2;
      this.add.text(LEFT_MARGIN, y, species.name, { fontSize: '22px', color: '#ffffff' }).setOrigin(0, 0.5);

      VARIANT_TIERS.forEach((variant, col) => {
        const x = LEFT_MARGIN + NAME_WIDTH + col * (CELL_SIZE + 20) + CELL_SIZE / 2;
        const key = discovered.has(`${species.id}:${variant}`) ? creatureTextureKey(variant) : silhouetteTextureKey();
        this.add.image(x, y, key).setDisplaySize(CELL_SIZE, CELL_SIZE);
      });
    });
  }
}
