import Phaser from 'phaser';
import { preloadCreatureImages } from '../sprites';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    preloadCreatureImages(this);
  }

  create(): void {
    this.scene.start('Grove');
  }
}
