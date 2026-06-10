# STARWING — Vector Squadron

A Starfox-style 3D rail shooter built with [Three.js](https://threejs.org/). Pick a
pilot, fly their fighter through the Meteo Corridor: blast drones, shatter asteroids,
thread boost rings, survive the VOIDMAW SIEGE CORE, and chase a high score.

## Pilots

| Pilot | Ship | Profile |
| ----- | ---- | ------- |
| **Lt. Aria Vega** | *Swift Fang* | Balanced all-rounder. Twin green bolts. |
| **Rex "Hex" Volkov** | *Needle Nine* | Fast + rapid fire, fragile shield. Amber needle tracers. |
| **"Anvil" Tarka** | *Ironclad* | Heavy shield, double-damage, slow. Violet plasma orbs. |

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

- **Talon interceptors** weave and bank toward you — 120 pts each.
- **Mantis gunships** hold mid-range and fire aimed plasma — 3 hits, 120 pts.
- **Asteroids** take 2–3 hits — 60 pts.
- **Gold rings** restore shield (+12) and boost (+40), and award 200 pts. Fly through them.
- **Combo multiplier** (up to ×8) builds with consecutive kills; taking a hit resets it.
- **Barrel roll** grants brief invulnerability.
- **Boss**: ~75s in, the **VOIDMAW — Herald of the Forge** warps in: a spiked obsidian
  citadel with three rotating scythe arms, four turret pods, and a glowing maw. Below
  half HP it enters phase 2 — blades spin up, volleys quicken, and it adds radial
  8-way maw bursts. Worth 5000 pts; each defeat advances the sector (faster scroll,
  tougher boss, new zone name). It also talks. It is not friendly.
- Best score persists in `localStorage`.

## Audio

- BGM: *Starforge Sprint* (level) and *Starforge Sprint (1)* (title/hangar) in
  `public/audio/`, looped via HTMLAudio after the first user gesture.
- Laser + boost SFX are ElevenLabs-generated samples (`public/sfx/`), played through
  WebAudio buffers with pitch jitter so rapid fire doesn't sound machine-stamped.
- Voice barks (`public/voice/`) are Gemini TTS (English): per-pilot launch lines and a
  ship-computer announcer for boss warning / boss kill / game over. The manifest with
  voices and acting directions lives at `public/voice/voice.manifest.json`.
- All other SFX (explosions, hits, rings, alarm, menus) are synthesized live with
  WebAudio oscillators and filtered noise.

## Generated art

- Title logo (`public/img/logo.png`): gpt-image-2 chrome key-art, chroma-keyed to alpha.
- Nebula backdrop (`public/img/nebula.png`): painted starscape on a far plane behind
  the parallax starfield.
- Explosion VFX (`public/fx/explosion-atlas.png`): 16-frame 4×4 sprite atlas played as
  animated billboards (additive, pooled) on kills, collisions, and boss death.
- Pilot avatars (`public/avatars/`). All generation prompts are kept next to the
  assets (`*.prompts.jsonl`) for reproducibility.

## Tech notes

- Ships, boss, and particle textures are procedural Three.js primitives and
  canvas-generated textures; hero art assets above are AI-generated bitmaps.
- Pooled lasers/plasma and a ring-buffer particle system keep allocations out of the
  frame loop.
- Dev hooks: `?select` opens the hangar, `?autostart[=vega|hex|anvil]` jumps into
  gameplay, `?boss` makes the first boss arrive ~6s in.
- `node scripts/smoke.mjs` / `smoke-flow.mjs` drive headless Chrome (puppeteer-core)
  through the boss fight and menu flow; dev server must be running.
