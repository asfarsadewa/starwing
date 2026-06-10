import * as THREE from "three";
import { poll, input } from "./input.js";
import { buildShip, animateShip } from "./ship.js";
import { buildWorld, updateWorld } from "./world.js";
import { LaserPool, Spawner, ParticleBurst, PlasmaPool, Boss } from "./entities.js";
import { PILOTS } from "./pilots.js";
import { ExplosionFX } from "./fx.js";
import {
  unlockAudio, loadSfx, playMusic, playVoice,
  sfxLaser, sfxBoost, sfxExplosion, sfxHit, sfxRing, sfxRoll,
  sfxAlarm, sfxSelect, sfxEnemyShot,
} from "./audio.js";

// ------------------------------------------------------------- renderer

const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  62, window.innerWidth / window.innerHeight, 0.1, 600
);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------- world & actors

const world = buildWorld(scene);

const BOUNDS = { x: 15, y: 8.5 };
let pilotIndex = 0;
let ship = buildShip(PILOTS[0].ship);
scene.add(ship);

const lasers = new LaserPool(scene);
const spawner = new Spawner(scene, BOUNDS);
const particles = new ParticleBurst(scene);
const plasma = new PlasmaPool(scene);
const boss = new Boss(scene);
const explosions = new ExplosionFX(scene);
window.__fx = explosions; // debug/smoke-test breadcrumb

loadSfx();

// ------------------------------------------------------------- DOM refs

const $ = (id) => document.getElementById(id);
const hud = $("hud");
const titleScreen = $("title-screen");
const selectScreen = $("select-screen");
const gameoverScreen = $("gameover-screen");
const scoreEl = $("score");
const comboEl = $("combo");
const shieldFill = $("shield-fill");
const boostFill = $("boost-fill");
const padStatus = $("pad-status");
const alertEl = $("alert");
const reticleFar = $("reticle-far");
const reticleNear = $("reticle-near");
const appEl = $("app");
const zoneLabel = $("zone-label");
const bossWarning = $("boss-warning");
const bossHud = $("boss-hud");
const bossFill = $("boss-fill");

// ------------------------------------------------------------- pilot select UI

const cardsRoot = $("pilot-cards");
for (const p of PILOTS) {
  const card = document.createElement("div");
  card.className = "pilot-card";
  const statsHtml = Object.entries(p.stats)
    .map(([k, n]) => {
      const pips = Array.from({ length: 5 },
        (_, i) => `<i class="pip${i < n ? " on" : ""}"></i>`).join("");
      return `<div class="pstat"><span>${k}</span><div class="pips">${pips}</div></div>`;
    })
    .join("");
  card.innerHTML = `
    <img src="${p.avatar}" alt="${p.name}" draggable="false" />
    <div class="pilot-name">${p.name}</div>
    <div class="pilot-ship">${p.shipName}</div>
    <p class="pilot-blurb">${p.blurb}</p>
    <div class="pilot-stats">${statsHtml}</div>`;
  cardsRoot.appendChild(card);
}
const cards = [...cardsRoot.children];

function selectPilot(i) {
  pilotIndex = (i + PILOTS.length) % PILOTS.length;
  cards.forEach((c, idx) => c.classList.toggle("selected", idx === pilotIndex));
  // rebuild the 3D ship preview / play ship
  scene.remove(ship);
  ship = buildShip(PILOTS[pilotIndex].ship);
  scene.add(ship);
}
selectPilot(0);

// ------------------------------------------------------------- game state

const SECTORS = [
  "SECTOR α — METEO CORRIDOR",
  "SECTOR β — VOIDMAW WAKE",
  "SECTOR γ — DEEP FORGE",
  "SECTOR δ — EVENT HORIZON",
];
const BOSS_AT_FIRST = 75;     // seconds into the run
const BOSS_INTERVAL = 110;    // seconds between bosses

const params = new URLSearchParams(location.search);

const state = {
  mode: "title", // title | select | playing | gameover
  caps: PILOTS[0].caps,
  pos: new THREE.Vector2(0, 0),
  vel: new THREE.Vector2(0, 0),
  shield: 100,
  boost: 100,
  boosting: false,
  wasBoosting: false,
  speed: 52,
  score: 0,
  combo: 0,
  comboTimer: 0,
  fireCooldown: 0,
  muzzleFlip: 0,
  roll: 0,
  rollTarget: 0,
  invuln: 0,
  elapsed: 0,
  sector: 1,
  bossAt: BOSS_AT_FIRST,
  bossPhase: null, // null | "warning" | "fight"
  warningTimer: 0,
};

const best = () => Number(localStorage.getItem("starwing-best") || 0);

function resetGame() {
  const caps = PILOTS[pilotIndex].caps;
  state.caps = caps;
  state.pos.set(0, 0);
  state.vel.set(0, 0);
  state.shield = caps.maxShield;
  state.boost = 100;
  state.speed = caps.baseSpeed;
  state.score = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.fireCooldown = 0;
  state.roll = 0;
  state.rollTarget = 0;
  state.invuln = 0;
  state.elapsed = 0;
  state.sector = 1;
  state.bossAt = params.has("boss") ? 6 : BOSS_AT_FIRST;
  state.bossPhase = null;
  state.wasBoosting = false;
  spawner.clear();
  plasma.clear();
  boss.despawn();
  for (const l of lasers.pool) lasers.kill(l);
  lasers.setColor(caps.laserColor);
  zoneLabel.textContent = SECTORS[0];
  bossHud.classList.add("hidden");
  bossWarning.classList.add("hidden");
}

function showTitle() {
  state.mode = "title";
  titleScreen.classList.remove("hidden");
  selectScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  hud.classList.add("hidden");
  playMusic("title");
}

function showSelect() {
  state.mode = "select";
  titleScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  selectScreen.classList.remove("hidden");
  hud.classList.add("hidden");
  playMusic("title");
}

function startGame() {
  resetGame();
  state.mode = "playing";
  selectScreen.classList.add("hidden");
  titleScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  playMusic("level");
  playVoice(PILOTS[pilotIndex].id);
}

function gameOver() {
  state.mode = "gameover";
  if (state.score > best()) {
    localStorage.setItem("starwing-best", String(state.score));
  }
  $("final-score").textContent = String(state.score).padStart(6, "0");
  $("best-score").textContent = String(best()).padStart(6, "0");
  hud.classList.add("hidden");
  gameoverScreen.classList.remove("hidden");
  particles.burst(ship.position, 120, 30);
  explosions.spawn(ship.position, 9);
  sfxExplosion(true);
  triggerShake();
  playMusic("title");
  playVoice("gameover");
}

function triggerShake() {
  appEl.classList.remove("shake");
  void appEl.offsetWidth; // restart animation
  appEl.classList.add("shake");
}

function addScore(points) {
  state.combo += 1;
  state.comboTimer = 2.0;
  const mult = Math.min(8, 1 + Math.floor(state.combo / 3));
  state.score += points * mult;
  comboEl.textContent = mult > 1 ? `×${mult} COMBO` : "";
}

// ------------------------------------------------------------- helpers

const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();

function projectToScreen(worldPos, el) {
  _v3b.copy(worldPos).project(camera);
  const x = (_v3b.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-_v3b.y * 0.5 + 0.5) * window.innerHeight;
  el.style.transform = `translate(${x}px, ${y}px)`;
}

function damage(amount) {
  if (state.invuln > 0) return;
  state.shield -= amount;
  state.invuln = 0.8;
  state.combo = 0;
  comboEl.textContent = "";
  sfxHit();
  triggerShake();
  if (state.shield <= 0) {
    state.shield = 0;
    gameOver();
  }
}

function defeatBoss() {
  // chain of explosions around the boss
  for (let i = 0; i < 6; i++) {
    _v3a.copy(boss.group.position);
    _v3a.x += (Math.random() - 0.5) * 10;
    _v3a.y += (Math.random() - 0.5) * 6;
    particles.burst(_v3a, 50, 26);
    explosions.spawn(_v3a, 10 + Math.random() * 8);
  }
  sfxExplosion(true);
  playVoice("bossdown");
  triggerShake();
  addScore(5000);
  boss.despawn();
  plasma.clear();
  state.bossPhase = null;
  state.bossAt = state.elapsed + BOSS_INTERVAL;
  state.sector += 1;
  zoneLabel.textContent = SECTORS[(state.sector - 1) % SECTORS.length];
  bossHud.classList.add("hidden");
  // small reward breather
  state.shield = Math.min(state.caps.maxShield, state.shield + 30);
  state.boost = 100;
}

// ------------------------------------------------------------- main loop

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  poll();

  // pad indicator
  if (input.padConnected) {
    padStatus.textContent = "◉ PAD LINKED";
    padStatus.classList.add("pad-on");
    padStatus.classList.remove("pad-off");
  } else {
    padStatus.textContent = "⊘ NO PAD";
    padStatus.classList.add("pad-off");
    padStatus.classList.remove("pad-on");
  }

  // ---------------- non-playing modes ----------------
  if (state.mode !== "playing") {
    if (state.mode === "title" && input.start) {
      sfxSelect();
      showSelect();
    } else if (state.mode === "select") {
      if (input.menuLeft) { sfxSelect(); selectPilot(pilotIndex - 1); }
      if (input.menuRight) { sfxSelect(); selectPilot(pilotIndex + 1); }
      if (input.start || input.firePressed) startGame();
    } else if (state.mode === "gameover" && input.start) {
      showSelect();
    }

    ship.visible = true;
    ship.position.set(Math.sin(t * 0.6) * 2.5, Math.cos(t * 0.83) * 1.2 - 0.5, 0);
    ship.rotation.set(Math.cos(t * 0.83) * 0.1, 0, Math.sin(t * 0.6) * -0.25);
    animateShip(ship, t, false);
    updateWorld(world, dt, 22);
    particles.update(dt, 22);
    explosions.update(dt, 22);
    camera.position.set(0, 2.4, 10);
    camera.lookAt(0, 0, -10);
    camera.fov = 62;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    return;
  }

  // ---------------- movement ----------------
  const caps = state.caps;
  state.elapsed += dt;

  const FRICTION = 6.5;
  state.vel.x += input.x * caps.accel * dt;
  state.vel.y += input.y * caps.accel * dt;
  state.vel.multiplyScalar(Math.max(0, 1 - FRICTION * dt));
  state.pos.addScaledVector(state.vel, dt);
  state.pos.x = THREE.MathUtils.clamp(state.pos.x, -BOUNDS.x, BOUNDS.x);
  state.pos.y = THREE.MathUtils.clamp(state.pos.y, -BOUNDS.y, BOUNDS.y);

  // boost
  state.boosting = input.boost && state.boost > 1;
  if (state.boosting && !state.wasBoosting) sfxBoost();
  state.wasBoosting = state.boosting;
  if (state.boosting) {
    state.boost = Math.max(0, state.boost - caps.boostDrain * dt);
  } else {
    state.boost = Math.min(100, state.boost + 12 * dt);
  }
  // sectors get faster
  const sectorK = 1 + (state.sector - 1) * 0.08;
  const targetSpeed = (state.boosting ? caps.boostSpeed : caps.baseSpeed) * sectorK;
  state.speed = THREE.MathUtils.lerp(state.speed, targetSpeed, dt * 3);

  // barrel roll
  if (input.rollLeft) { state.rollTarget += Math.PI * 2; state.invuln = Math.max(state.invuln, 0.6); sfxRoll(); }
  if (input.rollRight) { state.rollTarget -= Math.PI * 2; state.invuln = Math.max(state.invuln, 0.6); sfxRoll(); }
  state.roll = THREE.MathUtils.damp(state.roll, state.rollTarget, 8, dt);
  if (Math.abs(state.rollTarget - state.roll) < 0.01 && state.rollTarget !== 0) {
    state.roll = 0;
    state.rollTarget = 0;
  }

  state.invuln = Math.max(0, state.invuln - dt);

  // apply to ship
  ship.position.set(state.pos.x, state.pos.y, 0);
  const bank = THREE.MathUtils.clamp(-state.vel.x * 0.09, -0.9, 0.9);
  const pitch = THREE.MathUtils.clamp(state.vel.y * 0.05, -0.5, 0.5);
  ship.rotation.set(pitch, -bank * 0.35, bank + state.roll);

  ship.visible = state.invuln <= 0 || Math.floor(t * 20) % 2 === 0;

  animateShip(ship, t, state.boosting);

  // ---------------- camera ----------------
  camera.position.x = THREE.MathUtils.damp(camera.position.x, state.pos.x * 0.45, 5, dt);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, 2.4 + state.pos.y * 0.35, 5, dt);
  camera.position.z = 10;
  camera.lookAt(state.pos.x * 0.8, state.pos.y * 0.8, -20);
  const targetFov = state.boosting ? 74 : 62;
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 4, dt);
  camera.updateProjectionMatrix();

  // ---------------- firing ----------------
  state.fireCooldown -= dt;
  if (input.fire && state.fireCooldown <= 0) {
    state.fireCooldown = caps.fireRate;
    state.muzzleFlip ^= 1;
    const muzzleLocal = ship.userData.muzzles[state.muzzleFlip];
    _v3a.copy(muzzleLocal).applyMatrix4(ship.matrixWorld);
    _v3b.set(state.pos.x, state.pos.y, -120).sub(_v3a);
    lasers.fire(_v3a, _v3b);
    sfxLaser();
  }
  lasers.update(dt);

  // ---------------- world & entities ----------------
  const bossBusy = state.bossPhase !== null;
  updateWorld(world, dt, state.speed);
  spawner.update(dt, state.speed, state.elapsed, bossBusy);
  particles.update(dt, state.speed * 0.4);
  explosions.update(dt, state.speed * 0.4);
  plasma.update(dt);

  // ---------------- boss flow ----------------
  if (!bossBusy && state.elapsed >= state.bossAt) {
    state.bossPhase = "warning";
    state.warningTimer = 3.2;
    bossWarning.classList.remove("hidden");
    sfxAlarm();
    playVoice("warning");
  }

  if (state.bossPhase === "warning") {
    state.warningTimer -= dt;
    if (state.warningTimer <= 0) {
      bossWarning.classList.add("hidden");
      state.bossPhase = "fight";
      const hpScale = 1 + (state.sector - 1) * 0.5;
      boss.spawn(Math.round(60 * hpScale));
      bossHud.classList.remove("hidden");
    }
  } else if (state.bossPhase === "fight" && boss.active) {
    const fired = boss.update(dt, t, ship.position, plasma);
    if (fired) sfxEnemyShot();
    bossFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    window.__bossDir = boss.group.position.x - state.pos.x; // debug/smoke-test breadcrumb

    // player lasers vs boss
    for (const l of lasers.pool) {
      if (!l.active) continue;
      if (l.mesh.position.distanceTo(boss.group.position) < 6.2) {
        lasers.kill(l);
        particles.burst(l.mesh.position, 10, 9);
        if (boss.hit(caps.laserDamage)) {
          defeatBoss();
          break;
        }
      }
    }

    // plasma vs ship
    for (const p of plasma.pool) {
      if (!p.active) continue;
      if (p.mesh.position.distanceTo(ship.position) < 1.5) {
        plasma.kill(p);
        particles.burst(ship.position, 18, 12);
        damage(14);
      }
    }
  }

  // ---------------- collisions (field entities) ----------------
  for (const e of spawner.entities) {
    if (e.dead) continue;

    if (e.kind !== "ring") {
      for (const l of lasers.pool) {
        if (!l.active) continue;
        if (l.mesh.position.distanceTo(e.obj.position) < e.radius + 0.6) {
          lasers.kill(l);
          e.obj.userData.hp -= caps.laserDamage;
          if (e.obj.userData.hp <= 0) {
            particles.burst(e.obj.position, e.kind === "rock" ? 40 : 28, 20);
            explosions.spawn(e.obj.position, e.kind === "rock" ? e.radius * 4 : 5);
            sfxExplosion(e.kind === "rock");
            addScore(e.kind === "drone" ? 120 : 60);
            spawner.remove(e);
          } else {
            particles.burst(l.mesh.position, 8, 8);
          }
          break;
        }
      }
    }
    if (e.dead) continue;

    const d = e.obj.position.distanceTo(ship.position);
    if (e.kind === "ring") {
      if (Math.abs(e.obj.position.z) < 2.5 && d < e.radius * 0.85) {
        state.shield = Math.min(caps.maxShield, state.shield + 12);
        state.boost = Math.min(100, state.boost + 40);
        addScore(200);
        sfxRing();
        particles.burst(ship.position, 30, 14);
        spawner.remove(e);
      }
    } else if (d < e.radius + 1.1) {
      particles.burst(e.obj.position, 30, 16);
      explosions.spawn(e.obj.position, 5);
      sfxExplosion(false);
      spawner.remove(e);
      damage(e.kind === "rock" ? 30 : 18);
    }
  }

  // ---------------- HUD ----------------
  scoreEl.textContent = String(state.score).padStart(6, "0");
  shieldFill.style.width = `${(state.shield / caps.maxShield) * 100}%`;
  boostFill.style.width = `${state.boost}%`;
  alertEl.classList.toggle("hidden", state.shield > caps.maxShield * 0.25);

  state.comboTimer -= dt;
  if (state.comboTimer <= 0 && state.combo > 0) {
    state.combo = 0;
    comboEl.textContent = "";
  }

  _v3a.set(state.pos.x, state.pos.y, -40);
  projectToScreen(_v3a, reticleNear);
  _v3a.set(state.pos.x, state.pos.y, -120);
  projectToScreen(_v3a, reticleFar);

  renderer.render(scene, camera);
}

// first interaction unlocks audio (browser autoplay policy)
window.addEventListener("keydown", unlockAudio, { once: true });
window.addEventListener("pointerdown", unlockAudio, { once: true });

// dev hooks: ?autostart[=pilotId] jumps into gameplay; ?select shows hangar;
// ?boss makes the first boss arrive ~6s in
const autostart = params.get("autostart");
if (autostart !== null) {
  const idx = PILOTS.findIndex((p) => p.id === autostart);
  if (idx >= 0) selectPilot(idx);
  startGame();
} else if (params.has("select")) {
  showSelect();
} else {
  playMusic("title");
}

tick();
