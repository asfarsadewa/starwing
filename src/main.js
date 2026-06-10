import * as THREE from "three";
import { poll, input } from "./input.js";
import { buildShip, animateShip } from "./ship.js";
import { buildWorld, updateWorld } from "./world.js";
import { LaserPool, Spawner, ParticleBurst } from "./entities.js";
import {
  unlockAudio, sfxLaser, sfxExplosion, sfxHit, sfxRing, sfxRoll,
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
const ship = buildShip();
scene.add(ship);

const lasers = new LaserPool(scene);
const spawner = new Spawner(scene, BOUNDS);
const particles = new ParticleBurst(scene);

// ------------------------------------------------------------- DOM refs

const $ = (id) => document.getElementById(id);
const hud = $("hud");
const titleScreen = $("title-screen");
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

// ------------------------------------------------------------- game state

const BASE_SPEED = 52;
const BOOST_SPEED = 110;

const state = {
  mode: "title", // title | playing | gameover
  pos: new THREE.Vector2(0, 0),
  vel: new THREE.Vector2(0, 0),
  shield: 100,
  boost: 100,
  boosting: false,
  speed: BASE_SPEED,
  score: 0,
  combo: 0,
  comboTimer: 0,
  fireCooldown: 0,
  muzzleFlip: 0,
  roll: 0,          // current barrel-roll angle offset
  rollTarget: 0,    // accumulated target
  invuln: 0,
  elapsed: 0,
  shake: 0,
};

const best = () => Number(localStorage.getItem("starwing-best") || 0);

function resetGame() {
  state.pos.set(0, 0);
  state.vel.set(0, 0);
  state.shield = 100;
  state.boost = 100;
  state.score = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.fireCooldown = 0;
  state.roll = 0;
  state.rollTarget = 0;
  state.invuln = 0;
  state.elapsed = 0;
  spawner.clear();
  for (const l of lasers.pool) lasers.kill(l);
}

function startGame() {
  resetGame();
  state.mode = "playing";
  titleScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  unlockAudio();
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
  sfxExplosion(true);
  triggerShake();
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

  if (state.mode !== "playing") {
    if (input.start) startGame();
    ship.visible = true;
    // idle attract: ship drifts gently
    ship.position.set(Math.sin(t * 0.6) * 2.5, Math.cos(t * 0.83) * 1.2 - 0.5, 0);
    ship.rotation.z = Math.sin(t * 0.6) * -0.25;
    ship.rotation.x = Math.cos(t * 0.83) * 0.1;
    animateShip(ship, t, false);
    updateWorld(world, dt, 22);
    particles.update(dt, 22);
    camera.position.set(0, 2.4, 10);
    camera.lookAt(0, 0, -10);
    renderer.render(scene, camera);
    return;
  }

  // ---------------- movement ----------------
  state.elapsed += dt;

  const ACCEL = 90;
  const FRICTION = 6.5;
  state.vel.x += input.x * ACCEL * dt;
  state.vel.y += input.y * ACCEL * dt;
  state.vel.multiplyScalar(Math.max(0, 1 - FRICTION * dt));
  state.pos.addScaledVector(state.vel, dt);
  state.pos.x = THREE.MathUtils.clamp(state.pos.x, -BOUNDS.x, BOUNDS.x);
  state.pos.y = THREE.MathUtils.clamp(state.pos.y, -BOUNDS.y, BOUNDS.y);

  // boost
  state.boosting = input.boost && state.boost > 1;
  if (state.boosting) {
    state.boost = Math.max(0, state.boost - 28 * dt);
  } else {
    state.boost = Math.min(100, state.boost + 12 * dt);
  }
  const targetSpeed = state.boosting ? BOOST_SPEED : BASE_SPEED;
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

  // invuln flicker
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
    state.fireCooldown = 0.14;
    state.muzzleFlip ^= 1;
    const muzzleLocal = ship.userData.muzzles[state.muzzleFlip];
    _v3a.copy(muzzleLocal).applyMatrix4(ship.matrixWorld);
    // aim slightly toward reticle center ahead of ship
    _v3b.set(state.pos.x, state.pos.y, -120).sub(_v3a);
    lasers.fire(_v3a, _v3b);
    sfxLaser();
  }
  lasers.update(dt);

  // ---------------- world & entities ----------------
  updateWorld(world, dt, state.speed);
  spawner.update(dt, state.speed, state.elapsed);
  particles.update(dt, state.speed * 0.4);

  // ---------------- collisions ----------------
  for (const e of spawner.entities) {
    if (e.dead) continue;

    // laser hits (rings are not shootable)
    if (e.kind !== "ring") {
      for (const l of lasers.pool) {
        if (!l.active) continue;
        if (l.mesh.position.distanceTo(e.obj.position) < e.radius + 0.6) {
          lasers.kill(l);
          e.obj.userData.hp -= 1;
          if (e.obj.userData.hp <= 0) {
            particles.burst(e.obj.position, e.kind === "rock" ? 40 : 28, 20);
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

    // ship proximity
    const d = e.obj.position.distanceTo(ship.position);
    if (e.kind === "ring") {
      // fly through the hoop: near its plane, inside its radius
      if (Math.abs(e.obj.position.z) < 2.5 && d < e.radius * 0.85) {
        state.shield = Math.min(100, state.shield + 12);
        state.boost = Math.min(100, state.boost + 40);
        addScore(200);
        sfxRing();
        particles.burst(ship.position, 30, 14);
        spawner.remove(e);
      }
    } else if (d < e.radius + 1.1) {
      particles.burst(e.obj.position, 30, 16);
      sfxExplosion(false);
      spawner.remove(e);
      damage(e.kind === "rock" ? 30 : 18);
    }
  }

  // ---------------- HUD ----------------
  scoreEl.textContent = String(state.score).padStart(6, "0");
  shieldFill.style.width = `${state.shield}%`;
  boostFill.style.width = `${state.boost}%`;
  alertEl.classList.toggle("hidden", state.shield > 25);

  state.comboTimer -= dt;
  if (state.comboTimer <= 0 && state.combo > 0) {
    state.combo = 0;
    comboEl.textContent = "";
  }

  // twin reticle projected from ship aim line
  _v3a.set(state.pos.x, state.pos.y, -40);
  projectToScreen(_v3a, reticleNear);
  _v3a.set(state.pos.x, state.pos.y, -120);
  projectToScreen(_v3a, reticleFar);

  renderer.render(scene, camera);
}

// first interaction unlocks audio (browser autoplay policy)
window.addEventListener("keydown", unlockAudio, { once: true });
window.addEventListener("pointerdown", unlockAudio, { once: true });

// dev hook: jump straight into gameplay for smoke tests
if (new URLSearchParams(location.search).has("autostart")) startGame();

tick();
