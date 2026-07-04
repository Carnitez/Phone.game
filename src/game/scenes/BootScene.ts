import Phaser from 'phaser';
import { generateCreatureTextures } from '../sprites';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateCreatureTextures(this);
    this.scene.start('Grove');
  }
}
