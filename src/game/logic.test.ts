import { describe, expect, it } from 'vitest';
import { HULL_COLLISION_DAMAGE, START_POSITION, WORLD_HEIGHT } from './constants';
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

  it('produces near-equivalent steady-state speed across frame rates', () => {
    function simulate(steps: number, totalSec: number): SubmarineState {
      let state = baseState();
      const dt = totalSec / steps;
      for (let i = 0; i < steps; i += 1) {
        state = stepSubmarine(state, { thrust: 1, turn: 0 }, dt);
      }
      return state;
    }
    const at60 = simulate(120, 2);
    const at30 = simulate(60, 2);
    const at144 = simulate(288, 2);
    // Pre-fix this gap was ~2x; with continuous-time drag it is within a few percent.
    expect(Math.abs(at60.speed - at30.speed) / at60.speed).toBeLessThan(0.1);
    expect(Math.abs(at60.speed - at144.speed) / at60.speed).toBeLessThan(0.1);
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
  it('regular hazard deducts HULL_COLLISION_DAMAGE', () => {
    const result = applyCollisionDamage(baseState(), false);
    expect(result.hull).toBeCloseTo(100 - HULL_COLLISION_DAMAGE, 5);
  });

  it('monster deducts 1.8x HULL_COLLISION_DAMAGE', () => {
    const result = applyCollisionDamage(baseState(), true);
    expect(result.hull).toBeCloseTo(100 - HULL_COLLISION_DAMAGE * 1.8, 5);
  });

  it('reverses speed by -0.35', () => {
    const result = applyCollisionDamage(baseState({ speed: 100 }), false);
    expect(result.speed).toBeCloseTo(-35, 5);
  });
});
