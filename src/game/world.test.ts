import { describe, expect, it } from 'vitest';
import { OBJECTIVE_COUNT } from './constants';
import { createMission, generateObjectives } from './world';

describe('generateObjectives', () => {
  it('is deterministic for same seed', () => {
    const first = generateObjectives(1337);
    const second = generateObjectives(1337);
    expect(first).toEqual(second);
  });

  it('creates mission objective count', () => {
    const objectives = generateObjectives(42);
    expect(objectives).toHaveLength(OBJECTIVE_COUNT);
  });
});

describe('createMission', () => {
  it('includes hazards and objectives', () => {
    const mission = createMission(99);
    expect(mission.objectives.length).toBeGreaterThan(0);
    expect(mission.hazards.length).toBeGreaterThan(0);
  });
});
