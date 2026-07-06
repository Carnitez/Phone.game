import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { GroveScene } from './game/scenes/GroveScene';
import { CatchScene } from './game/scenes/CatchScene';
import { BookScene } from './game/scenes/BookScene';
import { IncubatorScene } from './game/scenes/IncubatorScene';
import { ShopScene } from './game/scenes/ShopScene';
import { HabitatScene } from './game/scenes/HabitatScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1429',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,
    height: 1280,
  },
  scene: [BootScene, GroveScene, CatchScene, BookScene, IncubatorScene, ShopScene, HabitatScene],
});
