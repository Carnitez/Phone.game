# Critter Grove

A cozy, zero-friction creature-collecting mobile game. See `CLAUDE.md` for the
full build specification (product spec, tech stack, phases, and definitions
of done).

## Stack

Phaser 3 + TypeScript, built with Vite, wrapped for mobile with Capacitor.

## Development

```bash
npm install
npm run dev      # local dev server (browser, MockAdService)
npm test         # Vitest — core game logic
npm run build    # production build
```

## Layout

- `src/core` — pure game logic (economy, creatures, breeding, RNG, save schema). No Phaser imports; fully unit-testable.
- `src/game` — Phaser scenes, rendering, input, audio.
- `src/services` — AdService, SaveManager, analytics stub.
- `src/data` — creature definitions, rarity tables, economy constants.
