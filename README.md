# Harrison's Road to the Cup

A browser-based 8-bit soccer game built with TypeScript, Vite, and Canvas.

Live game:
https://dialmasterorg.github.io/SoccerGame/

## Overview

Harrison's Road to the Cup is an arcade-style football game with pixel-art presentation, match flow, progression, career mode, boss encounters, save/profile systems, and unlockable upgrades.

This project is built around a modular architecture:
- `src/game/` — match logic, AI, tuning, players, and world rules
- `src/scenes/` — menus, match screens, career screens, and UI flow
- `src/meta/` — saves, progression, and profile data
- `src/art/` — sprites, kits, venues, and rendering helpers
- `src/audio/` — music and sound cues
- `docs/superpowers/` — design specs and feature plans

## Features

- 8-bit pixel-art presentation
- Match-based soccer gameplay
- Career / ladder progression
- Boss fights and special opponents
- Save/profile tracking
- Shop and upgrade systems
- Audio cues and music
- Test coverage via Vitest

## How to Play

The game is built for browser play and supports keyboard and gamepad input. On-screen prompts are the best guidance for exact controls in each screen.

### Keyboard
Use the controls shown in-game for each screen, especially:
- Arrow keys / WASD for navigation and movement
- Enter / Space for confirm / start
- Esc for back / pause / cancel

### Gamepad
Gamepad support is included in the input system. In the built-in sprite viewer, the repo documents debug controls as:

- A animation
- X kit
- B power form
- Y expression
- D-pad facing

For the main game, follow the prompts shown on screen.

### Debug / Sprite Viewer
The app includes a sprite viewer mode with the `?viewer` query parameter. It shows a small on-screen HUD with the current animation and art controls.

Viewer controls:
- Keys: 1–5 animation · K kit · G power form · F facing · E expression
- Gamepad: A animation · X kit · B power form · Y expression · D-pad facing

## Requirements

This repo uses Vite 8, which requires Node.js 20.19+ or 22.12+.

## Running Locally

### Prerequisites
- Node.js 20.19+ or 22.12+
- npm

### Install
```bash
npm install
```

### Start the dev server
```bash
npm run dev
```

Then open the local URL printed in the terminal.

### Production build
```bash
npm run build
```

### Run tests
```bash
npm test
```

### Type-check only
```bash
npm run typecheck
```

## Available Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — run TypeScript checks and create a production build
- `npm run typecheck` — type-check without building
- `npm test` — run Vitest
- `npm run keepers` — run keeper-oriented tooling or checks
- `npm run tryouts` — run tryout-related tooling or checks
- `npm run sheet` — run sprite sheet generation tooling

## Repository Layout

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

## Design Notes

The repository includes extensive planning docs under `docs/superpowers/`, including feature specs and plans for progression, save slots, stamina, boss fights, and career flow. These documents describe the broader design of the game and the implementation roadmap.

## Development Notes

This project is organized around modular game systems and clean separation of concerns:
- `src/game/` holds gameplay rules and AI
- `src/scenes/` handles screen flow and menu logic
- `src/meta/` covers save state and progression
- `src/art/` covers rendering and sprite generation
- `src/audio/` handles cues and music

## License

No explicit license file was found in the repository snapshot. Please confirm licensing terms before reusing, redistributing, or commercializing the project.

## Contributing

Contributions are welcome. Keep changes focused and validate with the relevant tests before submitting.
