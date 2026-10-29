# Harrison's Road to the Cup

Harrison's Road to the Cup is a browser-based 8-bit soccer game built with TypeScript, Vite, and Canvas. It blends classic arcade football with a progression system, career mode, boss encounters, save data, and stylized pixel-art presentation.

## Features

- 8-bit pixel-art presentation
- Soccer match gameplay on a canvas-based field
- Career progression and ladder-style play
- Boss encounters and special opponent logic
- Save/profile management with progression data
- Shop and upgrade systems
- Vibrant audio cues and music
- Automated tests with Vitest

## Tech Stack

- TypeScript
- Vite
- Canvas 2D rendering
- Vitest

## Project Structure

```text
.
├── docs/
│   └── superpowers/
│       ├── plans/
│       └── specs/
├── src/
│   ├── art/
│   ├── audio/
│   ├── engine/
│   ├── game/
│   ├── meta/
│   ├── scenes/
│   ├── viewer/
│   ├── main.ts
│   └── ...
├── tools/
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Then open the local Vite URL in your browser.

### Production build

```bash
npm run build
```

### Run tests

```bash
npm test
```

### Type check only

```bash
npm run typecheck
```

## Available Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — run TypeScript checks and create a production build
- `npm run typecheck` — run TypeScript validation only
- `npm test` — run the Vitest suite
- `npm run sheet` — run sprite sheet tooling

## Notes

This repository includes extensive design documentation in `docs/superpowers/`, including feature plans and technical specs for progression, career mode, save slots, stamina, and boss logic. These docs provide the conceptual roadmap behind the game’s systems.

## Contributing

For local development, keep changes focused on the relevant subsystem (art, audio, game logic, scenes, or profiles) and validate with the relevant tests before submitting changes.
