import {
  ACCELERATION,
  DRAG,
  HULL_COLLISION_DAMAGE,
  HULL_PRESSURE_DAMAGE_PER_SEC,
  MAX_SPEED,
  OXYGEN_DRAIN_BASE,
  OXYGEN_DRAIN_SPEED_FACTOR,
  PHOTO_DISTANCE,
  TURN_SPEED,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import type { ControlInput, Hazard, Objective, SubmarineState, Vec2 } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function stepSubmarine(state: SubmarineState, input: ControlInput, dtSec: number): SubmarineState {
  const heading = state.heading + input.turn * TURN_SPEED * dtSec;
  const speed = clamp(state.speed + input.thrust * ACCELERATION * dtSec, -MAX_SPEED * 0.4, MAX_SPEED) * DRAG;
  const nextX = clamp(state.position.x + Math.cos(heading) * speed * dtSec, 0, WORLD_WIDTH);
  const nextY = clamp(state.position.y + Math.sin(heading) * speed * dtSec, 0, WORLD_HEIGHT);

  return {
    ...state,
    heading,
    speed,
    position: { x: nextX, y: nextY },
  };
}

export function computePressure(y: number): number {
  return 18 + (y / WORLD_HEIGHT) * 82;
}

export function drainResources(state: SubmarineState, dtSec: number): SubmarineState {
  const oxygenLoss = (OXYGEN_DRAIN_BASE + Math.abs(state.speed) * OXYGEN_DRAIN_SPEED_FACTOR) * dtSec;
  const pressure = computePressure(state.position.y);
  const pressureDamage = pressure > 74 ? ((pressure - 74) / 26) * HULL_PRESSURE_DAMAGE_PER_SEC * dtSec : 0;
  return {
    ...state,
    pressure,
    oxygen: clamp(state.oxygen - oxygenLoss, 0, 100),
    hull: clamp(state.hull - pressureDamage, 0, 100),
  };
}

export function detectCollision(state: SubmarineState, hazards: Hazard[]): Hazard | null {
  for (const hazard of hazards) {
    if (distance(state.position, hazard.position) < hazard.radius + 14) {
      return hazard;
    }
  }
  return null;
}

export function applyCollisionDamage(state: SubmarineState, isMonster: boolean): SubmarineState {
  const damage = isMonster ? HULL_COLLISION_DAMAGE * 1.8 : HULL_COLLISION_DAMAGE;
  return {
    ...state,
    hull: clamp(state.hull - damage, 0, 100),
    speed: state.speed * -0.35,
  };
}

export function completeNearbyObjective(objectives: Objective[], submarinePosition: Vec2): string | null {
  const objective = objectives.find(
    (candidate) => !candidate.completed && distance(candidate.position, submarinePosition) <= Math.max(candidate.radius, PHOTO_DISTANCE),
  );

  if (!objective) {
    return null;
  }

  objective.completed = true;
  return objective.id;
}

export function allObjectivesComplete(objectives: Objective[]): boolean {
  return objectives.every((objective) => objective.completed);
}
