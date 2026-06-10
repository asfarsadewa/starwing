# STARWING — Vector Squadron

A Starfox-style 3D rail shooter built with [Three.js](https://threejs.org/). Pick a
pilot, fly their fighter through the Meteo Corridor: blast drones, shatter asteroids,
thread boost rings, survive the VOIDMAW SIEGE CORE, and chase a high score.

## Pilots

| Pilot | Ship | Profile |
| ----- | ---- | ------- |
| **Lt. Aria Vega** | *Swift Fang* | Balanced all-rounder. Green lasers. |
| **Rex "Hex" Volkov** | *Needle Nine* | Fast + rapid fire, fragile shield. Amber lasers. |
| **"Anvil" Tarka** | *Ironclad* | Heavy shield, double-damage cannons, slow. Violet lasers. |

Each ship is a distinct procedural silhouette (proportions, tails, engine pods,
palette) with its own capability profile. Avatars were generated with gpt-image-2;
prompts are kept in `public/avatars/avatars.prompts.jsonl`.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
```

`npm run build` produces a static bundle in `dist/` — deployable anywhere.

## Controls

| Action       | Keyboard          | Gamepad          |
| ------------ | ----------------- | ---------------- |
| Steer        | WASD / Arrow keys | Left stick       |
| Fire lasers  | Space             | A / RT           |
| Boost        | Shift             | X / LT           |
| Barrel roll  | Q / E             | LB / RB          |
| Start        | Enter             | Start            |
| Pilot select | ← → + Enter       | Stick/dpad + A   |

The HUD shows a live gamepad indicator (top-right). Pads are detected via the
Gamepad API; on some browsers you must press a button once before the pad is exposed.

## Gameplay

- **Drones** weave toward you — 120 pts each.
- **Asteroids** take 2–3 hits — 60 pts.
- **Gold rings** restore shield (+12) and boost (+40), and award 200 pts. Fly through them.
- **Combo multiplier** (up to ×8) builds with consecutive kills; taking a hit resets it.
- **Barrel roll** grants brief invulnerability.
- **Boss**: ~75s in, the VOIDMAW SIEGE CORE warps in — dodge its aimed plasma volleys
  (it fires faster as it takes damage) and burn it down for 5000 pts. Each defeat
  advances the sector: faster scroll, tougher boss, new zone name.
- Best score persists in `localStorage`.

## Audio

- BGM: *Starforge Sprint* (level) and *Starforge Sprint (1)* (title/hangar) in
  `public/audio/`, looped via HTMLAudio after the first user gesture.
- Laser + boost SFX are ElevenLabs-generated samples (`public/sfx/`), played through
  WebAudio buffers with pitch jitter so rapid fire doesn't sound machine-stamped.
- All other SFX (explosions, hits, rings, alarm, menus) are synthesized live with
  WebAudio oscillators and filtered noise.

## Tech notes

- Ships, boss, particle/nebula textures are all procedural Three.js primitives and
  canvas-generated textures.
- Pooled lasers/plasma and a ring-buffer particle system keep allocations out of the
  frame loop.
- Dev hooks: `?select` opens the hangar, `?autostart[=vega|hex|anvil]` jumps into
  gameplay, `?boss` makes the first boss arrive ~6s in.
- `node scripts/smoke.mjs` / `smoke-flow.mjs` drive headless Chrome (puppeteer-core)
  through the boss fight and menu flow; dev server must be running.
