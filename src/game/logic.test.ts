import { describe, expect, it } from 'vitest';
import { START_POSITION, WORLD_HEIGHT } from './constants';
import { allObjectivesComplete, applyCollisionDamage, completeNearbyObjective, computePressure, drainResources, stepSubmarine } from './logic';
import type { Objective, SubmarineState } from './types';

function baseState(overrides: Partial<SubmarineState> = {}): SubmarineState {
  return {
    position: { ...START_POSITION },
    heading: 0,
    speed: 0,
    hull: 100,
    oxygen: 100,
    pressure: 0,
    ...overrides,
  };
}

describe('stepSubmarine', () => {
  it('moves forward and turns with input', () => {
    const result = stepSubmarine(baseState(), { thrust: 1, turn: 1 }, 1);
    expect(result.speed).toBeGreaterThan(0);
    expect(result.heading).toBeGreaterThan(0);
    expect(result.position.x).not.toBe(START_POSITION.x);
    expect(result.position.y).not.toBe(START_POSITION.y);
  });
});

describe('drainResources', () => {
  it('decreases oxygen and applies pressure by depth', () => {
    const result = drainResources(baseState({ speed: 60, position: { x: 400, y: WORLD_HEIGHT } }), 1);
    expect(result.oxygen).toBeLessThan(100);
    expect(result.pressure).toBeGreaterThan(90);
    expect(result.hull).toBeLessThan(100);
  });

  it('pressure grows with lower depth', () => {
    expect(computePressure(0)).toBeLessThan(computePressure(WORLD_HEIGHT));
  });
});

describe('objective completion', () => {
  it('marks nearby objective complete', () => {
    const objectives: Objective[] = [
      { id: 'OBJ-1', label: 'CHOIR', position: { x: 200, y: 200 }, radius: 100, completed: false },
      { id: 'OBJ-2', label: 'ALTAR', position: { x: 1000, y: 1000 }, radius: 100, completed: false },
    ];
    const id = completeNearbyObjective(objectives, { x: 220, y: 210 });
    expect(id).toBe('OBJ-1');
    expect(objectives[0].completed).toBe(true);
    expect(allObjectivesComplete(objectives)).toBe(false);
  });
});

describe('collision damage', () => {
  it('monster deals more damage than regular collision', () => {
    const regular = applyCollisionDamage(baseState(), false);
    const monster = applyCollisionDamage(baseState(), true);
    expect(monster.hull).toBeLessThan(regular.hull);
  });
});
