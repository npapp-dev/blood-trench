import Phaser from 'phaser';
import './style.css';
import { MainScene } from './game/scenes/MainScene';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root element');
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: app,
  width: 1280,
  height: 720,
  backgroundColor: '#0a0203',
  scene: [MainScene],
  render: {
    antialias: false,
    pixelArt: true,
  },
};

new Phaser.Game(gameConfig);
