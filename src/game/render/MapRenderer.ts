import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../constants';
import type { Hazard, Objective, SubmarineState, Vec2 } from '../types';
import { seededRandom } from './random';

const SPECKLE_COUNT = 90;
const SPECKLE_SEED = 0xdec0de;

export class MapRenderer {
  public readonly rect = new Phaser.Geom.Rectangle(28, 66, 810, 628);
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly speckle: Vec2[];

  public constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.speckle = buildSpeckle(this.rect);
  }

  public render(
    state: SubmarineState,
    objectives: readonly Objective[],
    hazards: readonly Hazard[],
    discovered: ReadonlySet<string>,
  ): void {
    this.graphics.clear();
    this.graphics.fillStyle(0x070203, 1);
    this.graphics.fillRectShape(this.rect);

    this.graphics.fillStyle(0x420d12, 0.18);
    for (const dot of this.speckle) {
      this.graphics.fillRect(dot.x, dot.y, 2, 2);
    }

    for (const objective of objectives) {
      const mapped = this.toMap(objective.position);
      const color = objective.completed ? 0x5bc27b : 0xc95a62;
      this.graphics.lineStyle(1, color, 0.9);
      this.graphics.strokeCircle(mapped.x, mapped.y, objective.completed ? 7 : 10);
    }

    for (const hazard of hazards) {
      if (!discovered.has(hazard.id)) {
        continue;
      }
      const mapped = this.toMap(hazard.position);
      const color = hazard.kind === 'flesh' ? 0xc74466 : 0x99414f;
      this.graphics.fillStyle(color, 0.42);
      this.graphics.fillCircle(mapped.x, mapped.y, 4 + hazard.radius * 0.02);
    }

    const submarine = this.toMap(state.position);
    this.graphics.save();
    this.graphics.translateCanvas(submarine.x, submarine.y);
    this.graphics.rotateCanvas(state.heading);
    this.graphics.fillStyle(0xf8efef, 1);
    this.graphics.fillTriangle(12, 0, -8, 6, -8, -6);
    this.graphics.restore();
  }

  private toMap(point: Vec2): Vec2 {
    return {
      x: this.rect.x + (point.x / WORLD_WIDTH) * this.rect.width,
      y: this.rect.y + (point.y / WORLD_HEIGHT) * this.rect.height,
    };
  }
}

function buildSpeckle(rect: Phaser.Geom.Rectangle): Vec2[] {
  const random = seededRandom(SPECKLE_SEED);
  const dots: Vec2[] = [];
  for (let index = 0; index < SPECKLE_COUNT; index += 1) {
    dots.push({
      x: rect.x + random() * rect.width,
      y: rect.y + random() * rect.height,
    });
  }
  return dots;
}
