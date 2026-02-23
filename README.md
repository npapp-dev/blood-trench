# Blood Trench

Browser horror-submersible game inspired by the tension loop of Iron Lung: blind navigation by instruments, coordinate-driven objectives, constrained information, photo collection, and escalating survival pressure.

Around 80-90% vibe coded with Codex 5.3. 

<img width="1282" height="730" alt="image" src="https://github.com/user-attachments/assets/5bde8779-443b-40d9-8c34-de96b9cea4b0" />


## Stack

- TypeScript
- Vite
- Phaser 3
- Vitest

## Run

```bash
npm install
npm run dev
```

## Controls

- `W` / `S`: thrust forward/back
- `A` / `D`: rotate heading
- `SPACE`: sonar pulse (reveals nearby hazards on map)
- `P`: capture photo (completes nearby objective)
- `R`: restart after death/success

## Objective

1. Navigate by coordinates and heading inside the blood trench map.
2. Capture all objective photos at marked locations.
3. Return to the start position alive.

Fail states:

- Oxygen reaches 0%.
- Hull integrity reaches 0%.

## Tests

```bash
npm test
```
