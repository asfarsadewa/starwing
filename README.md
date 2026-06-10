# STARWING — Vector Squadron

A Starfox-style 3D rail shooter built with [Three.js](https://threejs.org/). Fly an
Arwing-inspired star fighter through the Meteo Corridor: blast drones, shatter
asteroids, thread boost rings, and chase a high score.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
```

`npm run build` produces a static bundle in `dist/` — deployable anywhere.

## Controls

| Action      | Keyboard          | Gamepad        |
| ----------- | ----------------- | -------------- |
| Steer       | WASD / Arrow keys | Left stick     |
| Fire lasers | Space             | A / RT         |
| Boost       | Shift             | X / LT         |
| Barrel roll | Q / E             | LB / RB        |
| Start       | Enter             | Start          |

The HUD shows a live gamepad indicator (top-right). Pads are detected via the
Gamepad API; on some browsers you must press a button once before the pad is exposed.

## Gameplay

- **Drones** weave toward you — 120 pts each.
- **Asteroids** take 2–3 hits — 60 pts.
- **Gold rings** restore shield (+12) and boost (+40), and award 200 pts. Fly through them.
- **Combo multiplier** (up to ×8) builds with consecutive kills; taking a hit resets it.
- **Barrel roll** grants brief invulnerability.
- Best score persists in `localStorage`.

## Tech notes

- Everything is procedural: the ship is composed Three.js primitives, particle/nebula
  textures are generated on a canvas, and all sound effects are synthesized with
  WebAudio oscillators and filtered noise — zero binary assets.
- Pooled lasers and a ring-buffer particle system keep allocations out of the frame loop.
- `?autostart` query param skips the title screen (used for smoke tests).
