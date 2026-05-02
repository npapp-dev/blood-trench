import Phaser from 'phaser';
import { PHOTO_DISTANCE, START_POSITION } from '../constants';
import { allObjectivesComplete, applyCollisionDamage, computePressure, detectCollision, drainResources, stepSubmarine } from '../logic';
import { CameraView } from '../render/CameraView';
import type { PhotoData } from '../render/CameraView';
import { Hud } from '../render/Hud';
import { MapRenderer } from '../render/MapRenderer';
import { PhotoLibrary } from '../render/PhotoLibrary';
import type { ControlInput, Hazard, Objective, SubmarineState, Vec2 } from '../types';
import { createMission } from '../world';

interface CaptureTarget {
  baseElementId: string;
  position: Vec2;
  objectiveId: string | null;
  distance: number;
}

export class MainScene extends Phaser.Scene {
  private state: SubmarineState = {
    position: { ...START_POSITION },
    heading: 0.4,
    speed: 0,
    hull: 100,
    oxygen: 100,
    pressure: computePressure(START_POSITION.y),
  };

  private objectives: Objective[] = [];
  private hazards: Hazard[] = [];
  private discovered = new Set<string>();
  private photoData: PhotoData | null = null;
  private gameOverMessage = '';

  private photoDevelopMs = 0;
  private photoCooldownMs = 0;
  private sonarCooldownMs = 0;
  private creatureRoarCooldownMs = 0;
  private collisionInvulnMs = 0;

  private mapRenderer!: MapRenderer;
  private cameraView!: CameraView;
  private hud!: Hud;
  private photoLibrary!: PhotoLibrary;

  private keys!: {
    forward: Phaser.Input.Keyboard.Key;
    backward: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    photo: Phaser.Input.Keyboard.Key;
    sonar: Phaser.Input.Keyboard.Key;
    restart: Phaser.Input.Keyboard.Key;
  };

  public constructor() {
    super('MainScene');
  }

  public create(): void {
    const mission = createMission(1337);
    this.objectives = mission.objectives;
    this.hazards = mission.hazards;

    this.add.rectangle(640, 360, 1280, 720, 0x120406, 1);
    this.add.rectangle(640, 360, 1280, 720, 0x2b0a0f, 0.13);

    this.mapRenderer = new MapRenderer(this);
    this.photoLibrary = new PhotoLibrary(this);
    this.photoLibrary.build(this.objectives, this.hazards);
    this.cameraView = new CameraView(this);
    this.hud = new Hud(this, this.mapRenderer.rect, this.cameraView.rect);

    this.hud.addLog('Mission started. Reach coordinates and collect camera evidence.');
    this.hud.addLog('Controls: WASD steer | SPACE sonar | P photo | R restart');

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input unavailable');
    }

    this.keys = {
      forward: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      backward: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      photo: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      sonar: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      restart: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
    };
  }

  public update(_time: number, deltaMs: number): void {
    const dtSec = Math.min(deltaMs / 1000, 0.05);

    if (this.gameOverMessage) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
        this.scene.restart();
      }
    } else {
      this.photoCooldownMs = Math.max(0, this.photoCooldownMs - deltaMs);
      this.sonarCooldownMs = Math.max(0, this.sonarCooldownMs - deltaMs);
      this.creatureRoarCooldownMs = Math.max(0, this.creatureRoarCooldownMs - deltaMs);
      this.collisionInvulnMs = Math.max(0, this.collisionInvulnMs - deltaMs);

      if (this.photoDevelopMs > 0) {
        this.photoDevelopMs = Math.max(0, this.photoDevelopMs - deltaMs);
        if (this.photoDevelopMs === 0) {
          this.finishPhotoCapture();
        }
      } else {
        this.state = stepSubmarine(this.state, this.readInput(), dtSec);
        this.state = drainResources(this.state, dtSec);
        this.handleCollisions();
        this.trySonarPing();
        this.tryPhotoCapture();
      }

      this.checkEndStates();
    }

    this.hud.render({
      state: this.state,
      objectives: this.objectives,
      photoCooldownMs: this.photoCooldownMs,
      sonarCooldownMs: this.sonarCooldownMs,
      gameOverMessage: this.gameOverMessage,
    });
    this.mapRenderer.render(this.state, this.objectives, this.hazards, this.discovered);
    this.cameraView.render({
      photoDevelopMs: this.photoDevelopMs,
      photoData: this.photoData,
      targetInFrame: this.resolveCaptureTarget() !== null,
    });
  }

  private readInput(): ControlInput {
    const thrust = (this.keys.forward.isDown ? 1 : 0) + (this.keys.backward.isDown ? -1 : 0);
    const turn = (this.keys.right.isDown ? 1 : 0) + (this.keys.left.isDown ? -1 : 0);
    return { thrust, turn };
  }

  private resolveCaptureTarget(): CaptureTarget | null {
    const forward = new Phaser.Math.Vector2(Math.cos(this.state.heading), Math.sin(this.state.heading));
    const maxConeAngle = Phaser.Math.DegToRad(35);
    let selected: CaptureTarget | null = null;

    for (const objective of this.objectives) {
      const dx = objective.position.x - this.state.position.x;
      const dy = objective.position.y - this.state.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = Math.max(PHOTO_DISTANCE * 2, objective.radius + PHOTO_DISTANCE * 0.8);
      if (distance > maxDistance) {
        continue;
      }
      const dir = new Phaser.Math.Vector2(dx, dy).normalize();
      const angle = Math.acos(Phaser.Math.Clamp(forward.dot(dir), -1, 1));
      if (angle > maxConeAngle) {
        continue;
      }
      if (!selected || distance < selected.distance) {
        selected = {
          baseElementId: `objective:${objective.id}`,
          position: objective.position,
          objectiveId: objective.id,
          distance,
        };
      }
    }

    for (const hazard of this.hazards) {
      const dx = hazard.position.x - this.state.position.x;
      const dy = hazard.position.y - this.state.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = Math.max(PHOTO_DISTANCE * 2.2, hazard.radius + PHOTO_DISTANCE);
      if (distance > maxDistance) {
        continue;
      }
      const dir = new Phaser.Math.Vector2(dx, dy).normalize();
      const angle = Math.acos(Phaser.Math.Clamp(forward.dot(dir), -1, 1));
      if (angle > maxConeAngle) {
        continue;
      }
      if (!selected || distance < selected.distance) {
        selected = {
          baseElementId: `hazard:${hazard.id}`,
          position: hazard.position,
          objectiveId: null,
          distance,
        };
      }
    }

    return selected;
  }

  private resolveViewBucket(targetPosition: Vec2): number {
    const angleFromObject = Phaser.Math.Angle.Wrap(
      Math.atan2(this.state.position.y - targetPosition.y, this.state.position.x - targetPosition.x),
    );
    const normalized = (angleFromObject + Math.PI) / (Math.PI * 2);
    return Math.floor(normalized * this.photoLibrary.viewBuckets) % this.photoLibrary.viewBuckets;
  }

  private markObjectiveComplete(objectiveId: string): boolean {
    const objective = this.objectives.find((entry) => entry.id === objectiveId);
    if (!objective || objective.completed) {
      return false;
    }
    objective.completed = true;
    return true;
  }

  private handleCollisions(): void {
    if (this.collisionInvulnMs > 0) {
      return;
    }
    const collision = detectCollision(this.state, this.hazards);
    if (!collision) {
      return;
    }

    this.state = applyCollisionDamage(this.state, collision.id.startsWith('MN-'));
    this.collisionInvulnMs = 500;
    this.hud.addLog(`Collision with ${collision.kind === 'flesh' ? 'unknown biomass' : 'rock outcrop'}.`);
    if (collision.id.startsWith('MN-') && this.creatureRoarCooldownMs === 0) {
      this.creatureRoarCooldownMs = 9000;
      this.hud.addLog('Bio-acoustic impact detected. Large organism nearby.');
      this.cameras.main.shake(300, 0.005);
    }
  }

  private trySonarPing(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.sonar) || this.sonarCooldownMs > 0) {
      return;
    }

    const range = 370;
    let found = 0;
    for (const hazard of this.hazards) {
      const distance = Phaser.Math.Distance.Between(this.state.position.x, this.state.position.y, hazard.position.x, hazard.position.y);
      if (distance <= range) {
        found += 1;
        this.discovered.add(hazard.id);
      }
    }
    this.sonarCooldownMs = 5000;
    this.hud.addLog(`Sonar pulse emitted. ${found} contacts mapped.`);
  }

  private tryPhotoCapture(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.photo) || this.photoCooldownMs > 0) {
      return;
    }
    this.photoDevelopMs = 1600;
    this.photoData = null;
    this.hud.addLog('Camera trigger pulled. Developing image...');
  }

  private finishPhotoCapture(): void {
    const target = this.resolveCaptureTarget();
    const nearbyHazards = this.hazards.filter(
      (hazard) => Phaser.Math.Distance.Between(this.state.position.x, this.state.position.y, hazard.position.x, hazard.position.y) < PHOTO_DISTANCE * 1.7,
    );
    const fallbackSignatures = nearbyHazards.slice(0, 3).map((hazard) => `${hazard.kind.toUpperCase()}-${hazard.radius.toFixed(0)}`);
    const fallbackDanger = nearbyHazards.reduce((sum, hazard) => sum + hazard.radius, 0) / 150;
    const elementId = target ? `${target.baseElementId}:v${this.resolveViewBucket(target.position)}` : 'unknown';
    const baseElementId = target?.baseElementId ?? 'unknown';
    const template = this.photoLibrary.get(elementId);
    const objectiveCompleted = target?.objectiveId ? this.markObjectiveComplete(target.objectiveId) : false;
    const newlyCataloged = this.hud.trackFoundElement(baseElementId, template?.label ?? 'OFF-TARGET');

    this.photoData = {
      elementId,
      label: template?.label ?? 'OFF-TARGET',
      signatures: template?.signatures ?? (fallbackSignatures.length > 0 ? fallbackSignatures : ['NOISE']),
      danger: template?.danger ?? fallbackDanger,
      textureKey: template?.textureKey ?? 'photo-unknown',
    };
    this.photoCooldownMs = 3500;

    if (objectiveCompleted && target?.objectiveId) {
      this.hud.addLog(`Objective ${target.objectiveId} documented.`);
    } else if (target) {
      this.hud.addLog(newlyCataloged ? `New contact logged: ${this.photoData.label}.` : `Known contact: ${this.photoData.label}.`);
    } else {
      this.hud.addLog('No valid target in camera cone. Image is noise.');
    }
  }

  private checkEndStates(): void {
    if (this.state.oxygen <= 0) {
      this.gameOverMessage = 'OXYGEN DEPLETED';
      return;
    }
    if (this.state.hull <= 0) {
      this.gameOverMessage = 'HULL INTEGRITY LOST';
      return;
    }
    if (allObjectivesComplete(this.objectives)) {
      this.gameOverMessage = 'MISSION COMPLETE // TRANSMISSION SENT';
      this.hud.addLog('All objectives documented.');
    }
  }
}
