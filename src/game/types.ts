export interface Vec2 {
  x: number;
  y: number;
}

export interface Objective {
  id: string;
  label: string;
  position: Vec2;
  radius: number;
  completed: boolean;
}

export type HazardKind = 'rock' | 'flesh';

export interface Hazard {
  id: string;
  position: Vec2;
  radius: number;
  kind: HazardKind;
}

export interface SubmarineState {
  position: Vec2;
  heading: number;
  speed: number;
  hull: number;
  oxygen: number;
  pressure: number;
}

export interface ControlInput {
  thrust: number;
  turn: number;
}
