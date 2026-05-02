import Phaser from 'phaser';
import { GAME_TITLE } from '../constants';
import type { Objective, SubmarineState } from '../types';

const LOG_LIMIT = 5;
const FOUND_CATALOG_LIMIT = 12;
const FOUND_DISPLAY_LIMIT = 8;

interface HudRenderState {
  state: SubmarineState;
  objectives: readonly Objective[];
  photoCooldownMs: number;
  sonarCooldownMs: number;
  gameOverMessage: string;
}

export class Hud {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly missionText: Phaser.GameObjects.Text;
  private readonly logText: Phaser.GameObjects.Text;
  private readonly foundText: Phaser.GameObjects.Text;
  private readonly overlayText: Phaser.GameObjects.Text;
  private readonly mapRect: Phaser.Geom.Rectangle;
  private readonly cameraRect: Phaser.Geom.Rectangle;

  private readonly logs: string[] = [];
  private readonly foundElements = new Set<string>();
  private foundCatalog: string[] = [];

  public constructor(scene: Phaser.Scene, mapRect: Phaser.Geom.Rectangle, cameraRect: Phaser.Geom.Rectangle) {
    this.mapRect = mapRect;
    this.cameraRect = cameraRect;
    this.graphics = scene.add.graphics();
    this.statusText = scene.add.text(40, 18, '', {
      fontFamily: 'Courier New',
      fontSize: '18px',
      color: '#f6d5d5',
    });
    this.missionText = scene.add.text(866, 522, '', {
      fontFamily: 'Courier New',
      fontSize: '16px',
      color: '#f8b0b0',
      lineSpacing: 6,
    });
    this.logText = scene.add.text(866, 620, '', {
      fontFamily: 'Courier New',
      fontSize: '13px',
      color: '#ffd6d6',
      lineSpacing: 3,
    });
    this.foundText = scene.add.text(40, 614, '', {
      fontFamily: 'Courier New',
      fontSize: '13px',
      color: '#f2dede',
      lineSpacing: 3,
    });
    this.overlayText = scene.add.text(640, 360, '', {
      fontFamily: 'Courier New',
      fontSize: '24px',
      color: '#ffe7e7',
      align: 'center',
    });
    this.overlayText.setOrigin(0.5);
  }

  public get foundCount(): number {
    return this.foundElements.size;
  }

  public addLog(line: string): void {
    this.logs.unshift(`> ${line}`);
    if (this.logs.length > LOG_LIMIT) {
      this.logs.length = LOG_LIMIT;
    }
  }

  public trackFoundElement(baseElementId: string, label: string): boolean {
    if (!baseElementId.startsWith('objective:') && !baseElementId.startsWith('hazard:')) {
      return false;
    }
    if (this.foundElements.has(baseElementId)) {
      return false;
    }
    this.foundElements.add(baseElementId);
    this.foundCatalog.unshift(label);
    this.foundCatalog = this.foundCatalog.slice(0, FOUND_CATALOG_LIMIT);
    return true;
  }

  public render(args: HudRenderState): void {
    const { state, objectives, photoCooldownMs, sonarCooldownMs, gameOverMessage } = args;

    this.overlayText.setText(gameOverMessage ? `${gameOverMessage}\n\nPress R to restart` : '');

    this.graphics.clear();
    this.graphics.lineStyle(2, 0x7c3035, 1);
    this.graphics.strokeRectShape(this.mapRect);
    this.graphics.strokeRectShape(this.cameraRect);
    this.graphics.lineStyle(1, 0x4f1f23, 1);
    this.graphics.strokeRect(860, 516, 394, 176);
    this.graphics.strokeRect(28, 604, 810, 88);

    const objectiveLines = objectives.map(
      (objective) => `${objective.completed ? 'X' : '>'} ${objective.id} ${objective.label}`,
    );
    const recordLines = this.foundCatalog.slice(0, FOUND_DISPLAY_LIMIT).map((entry) => `- ${entry}`);
    const headingDeg = Phaser.Math.RadToDeg(state.heading);

    this.statusText.setText(
      `${GAME_TITLE}\nX ${state.position.x.toFixed(0)} | Y ${state.position.y.toFixed(0)} | HDG ${headingDeg.toFixed(0)}`,
    );
    this.missionText.setText(
      [
        `OXYGEN ${state.oxygen.toFixed(1)}%`,
        `HULL   ${state.hull.toFixed(1)}%`,
        `PRESS  ${state.pressure.toFixed(1)} bar`,
        `PHOTO  ${Math.ceil(photoCooldownMs / 1000)}s`,
        `SONAR  ${Math.ceil(sonarCooldownMs / 1000)}s`,
        `FOUND  ${this.foundElements.size}`,
        '',
        ...objectiveLines,
      ].join('\n'),
    );
    this.logText.setText(this.logs.join('\n'));
    this.foundText.setText(['FOUND OBJECT RECORD', ...(recordLines.length > 0 ? recordLines : ['- NONE'])].join('\n'));
  }
}
