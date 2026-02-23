import { HAZARD_COUNT, MONSTER_COUNT, OBJECTIVE_COUNT, START_POSITION, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import type { Hazard, Objective, Vec2 } from './types';

const labels = ['CHOIR', 'ALTAR', 'TOWER', 'SPINE', 'GATE', 'NEST', 'ORBIT', 'VEIL'];

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ (value >>> 15), value | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPosition(random: () => number, margin: number): Vec2 {
  return {
    x: margin + random() * (WORLD_WIDTH - margin * 2),
    y: margin + random() * (WORLD_HEIGHT - margin * 2),
  };
}

function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function generateObjectives(seed: number): Objective[] {
  const random = mulberry32(seed);
  const objectives: Objective[] = [];

  while (objectives.length < OBJECTIVE_COUNT) {
    const position = randomPosition(random, 220);
    if (distance(position, START_POSITION) < 500) {
      continue;
    }
    if (objectives.some((objective) => distance(position, objective.position) < 330)) {
      continue;
    }
    objectives.push({
      id: `OBJ-${objectives.length + 1}`,
      label: labels[objectives.length % labels.length],
      position,
      radius: 130,
      completed: false,
    });
  }

  return objectives;
}

export function generateHazards(seed: number): Hazard[] {
  const random = mulberry32(seed * 11 + 19);
  const hazards: Hazard[] = [];

  for (let index = 0; index < HAZARD_COUNT; index += 1) {
    hazards.push({
      id: `HZ-${index + 1}`,
      kind: index % 5 === 0 ? 'flesh' : 'rock',
      position: randomPosition(random, 120),
      radius: 30 + random() * 45,
    });
  }

  for (let index = 0; index < MONSTER_COUNT; index += 1) {
    hazards.push({
      id: `MN-${index + 1}`,
      kind: 'flesh',
      position: {
        x: WORLD_WIDTH * 0.72 + random() * 180,
        y: WORLD_HEIGHT * 0.68 + random() * 200,
      },
      radius: 120,
    });
  }

  return hazards;
}

export function createMission(seed = 13): { objectives: Objective[]; hazards: Hazard[] } {
  return {
    objectives: generateObjectives(seed),
    hazards: generateHazards(seed),
  };
}
