import * as THREE from "three";
import { WORLD_DEPTH, makeGlowTexture } from "./world.js";

// ---------------------------------------------------------------- lasers

// Weapon styles per pilot: bolt (classic), needle (thin fast tracer),
// orb (heavy slow plasma sphere).
const WEAPON_GEOS = {
  bolt: new THREE.CapsuleGeometry(0.09, 2.2, 4, 8),
  needle: new THREE.CapsuleGeometry(0.045, 3.6, 4, 8),
  orb: new THREE.SphereGeometry(0.34, 12, 12),
};
WEAPON_GEOS.bolt.rotateX(Math.PI / 2);
WEAPON_GEOS.needle.rotateX(Math.PI / 2);

const LASER_MAT = new THREE.MeshBasicMaterial({
  color: 0x58ff9b,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

// halo scale per weapon style — the bolt core stays crisp, the halo sells the energy
const WEAPON_HALO = { bolt: 2.2, needle: 1.5, orb: 3.4 };

export class LaserPool {
  constructor(scene, size = 40) {
    this.scene = scene;
    this.material = LASER_MAT.clone();
    this.speed = 220;
    this.type = "bolt";
    this.haloTex = makeGlowTexture();
    this.haloMat = new THREE.SpriteMaterial({
      map: this.haloTex,
      color: 0x58ff9b,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.pool = [];
    for (let i = 0; i < size; i++) {
      const m = new THREE.Mesh(WEAPON_GEOS.bolt, this.material);
      m.visible = false;
      const halo = new THREE.Sprite(this.haloMat);
      halo.scale.setScalar(WEAPON_HALO.bolt);
      m.add(halo);
      scene.add(m);
      this.pool.push({ mesh: m, halo, active: false, vel: new THREE.Vector3(), age: 0 });
    }

    // shared flash pool: muzzle pops + impact hits
    this.flashMat = new THREE.SpriteMaterial({
      map: this.haloTex,
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.flashes = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(this.flashMat.clone());
      s.visible = false;
      scene.add(s);
      this.flashes.push({ sprite: s, life: 0, max: 0.09, size: 2 });
    }
  }

  // swap the whole pool to a pilot's weapon style
  configure({ type = "bolt", color = 0x58ff9b, speed = 220 } = {}) {
    const geo = WEAPON_GEOS[type] ?? WEAPON_GEOS.bolt;
    this.type = type;
    this.material.color.set(color);
    this.haloMat.color.set(color);
    this.speed = speed;
    for (const l of this.pool) {
      l.mesh.geometry = geo;
      l.halo.scale.setScalar(WEAPON_HALO[type] ?? 2.2);
    }
    for (const f of this.flashes) f.sprite.material.color.set(color);
  }

  fire(origin, dir, speed = this.speed) {
    const slot = this.pool.find((l) => !l.active);
    if (!slot) return;
    slot.active = true;
    slot.age = 0;
    slot.mesh.visible = true;
    slot.mesh.position.copy(origin);
    slot.vel.copy(dir).normalize().multiplyScalar(speed);
    slot.mesh.lookAt(origin.clone().add(dir));
    this.flashAt(origin, 2.4, 0.07); // muzzle pop
  }

  // bright expanding flash — used for muzzle pops and impact hits
  flashAt(position, size = 3, duration = 0.09) {
    const f = this.flashes.find((x) => x.life <= 0) ?? this.flashes[0];
    f.life = duration;
    f.max = duration;
    f.size = size;
    f.sprite.visible = true;
    f.sprite.position.copy(position);
  }

  update(dt) {
    for (const l of this.pool) {
      if (!l.active) continue;
      l.age += dt;
      l.mesh.position.addScaledVector(l.vel, dt);
      if (this.type === "orb") {
        // heavy plasma breathes as it travels
        const pulse = 1 + Math.sin(l.age * 26) * 0.18;
        l.mesh.scale.setScalar(pulse);
      }
      if (l.mesh.position.z < -WORLD_DEPTH || l.mesh.position.z > 20) {
        this.kill(l);
      }
    }
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      f.sprite.scale.setScalar(f.size * (1.6 - k * 0.6));
      f.sprite.material.opacity = k;
      if (f.life <= 0) f.sprite.visible = false;
    }
  }

  kill(l) {
    l.active = false;
    l.mesh.visible = false;
    l.mesh.scale.setScalar(1);
  }
}

// ---------------------------------------------------------------- enemy plasma

const PLASMA_GEO = new THREE.SphereGeometry(0.45, 10, 10);
const PLASMA_MAT = new THREE.MeshBasicMaterial({
  color: 0xff4d6e,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

export class PlasmaPool {
  constructor(scene, size = 30) {
    this.scene = scene;
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const m = new THREE.Mesh(PLASMA_GEO, PLASMA_MAT);
      m.visible = false;
      scene.add(m);
      this.pool.push({ mesh: m, active: false, vel: new THREE.Vector3() });
    }
  }

  fire(origin, target, speed = 55) {
    const slot = this.pool.find((p) => !p.active);
    if (!slot) return;
    slot.active = true;
    slot.mesh.visible = true;
    slot.mesh.position.copy(origin);
    slot.vel.copy(target).sub(origin).normalize().multiplyScalar(speed);
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.mesh.position.addScaledVector(p.vel, dt);
      const s = 1 + Math.sin(performance.now() * 0.02) * 0.15;
      p.mesh.scale.setScalar(s);
      // die just past the play plane so misses never streak through the camera
      if (p.mesh.position.z > 6 || p.mesh.position.z < -WORLD_DEPTH) {
        this.kill(p);
      }
    }
  }

  kill(p) {
    p.active = false;
    p.mesh.visible = false;
  }

  clear() {
    for (const p of this.pool) this.kill(p);
  }
}

// ---------------------------------------------------------------- boss

// VOIDMAW SIEGE CORE — obsidian citadel: spiked carapace around a glowing
// maw-eye, three rotating scythe-blade shield arms, four turret pods.
// Phase 2 (below half HP): carapace ignites, blades spin up, radial bursts.

const BOSS_HULL = new THREE.MeshStandardMaterial({
  color: 0x14080d,
  metalness: 0.8,
  roughness: 0.3,
  emissive: 0x6e0a1e,
  emissiveIntensity: 0.25,
  flatShading: true,
});
const BOSS_BLADE = new THREE.MeshStandardMaterial({
  color: 0x241019,
  metalness: 0.85,
  roughness: 0.25,
  emissive: 0xc01430,
  emissiveIntensity: 0.6,
  flatShading: true,
});
const BOSS_CORE = new THREE.MeshBasicMaterial({
  color: 0xff2e55,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const BOSS_MAW = new THREE.MeshBasicMaterial({
  color: 0xff7a3a,
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

function buildScytheArm() {
  // a curved blade arm assembled from offset segments
  const arm = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const len = 2.6 - i * 0.35;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.55 - i * 0.08, len, 0.35), BOSS_BLADE);
    seg.position.set(Math.sin(i * 0.45) * 1.1, 5.2 + i * 1.7, 0);
    seg.rotation.z = -i * 0.32;
    arm.add(seg);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 4), BOSS_BLADE);
  tip.position.set(2.1, 11.2, 0);
  tip.rotation.z = -1.7;
  arm.add(tip);
  return arm;
}

export class Boss {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    // spiked carapace citadel
    const carapace = new THREE.Mesh(new THREE.IcosahedronGeometry(4.4, 0), BOSS_HULL);
    carapace.scale.set(1.25, 1, 0.9);
    this.group.add(carapace);
    this.carapace = carapace;

    // carapace spikes
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const spikeGeo = new THREE.ConeGeometry(0.55, 2.6, 4);
      const spike = new THREE.Mesh(spikeGeo, BOSS_HULL);
      spike.position.set(Math.cos(a) * 4.6, Math.sin(a) * 3.9, -0.5);
      spike.rotation.z = a - Math.PI / 2;
      this.group.add(spike);
    }

    // the maw: core eye behind concentric pulsing rings
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), BOSS_CORE);
    this.core.position.z = 2.2;
    this.group.add(this.core);

    this.mawRings = [];
    for (const [r, z] of [[2.2, 2.6], [2.9, 2.1], [3.6, 1.6]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 28), BOSS_MAW);
      ring.position.z = z;
      this.group.add(ring);
      this.mawRings.push(ring);
    }

    // three rotating scythe-blade shield arms
    this.bladeRing = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const arm = buildScytheArm();
      arm.rotation.z = (i / 3) * Math.PI * 2;
      this.bladeRing.add(arm);
    }
    this.bladeRing.position.z = -1;
    this.group.add(this.bladeRing);

    // turret pods (volley origins)
    this.turrets = [];
    for (const [tx, ty] of [[-4.2, 2.4], [4.2, 2.4], [-3.2, -3.2], [3.2, -3.2]]) {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), BOSS_BLADE);
      pod.position.set(tx, ty, 1.6);
      this.group.add(pod);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), BOSS_CORE);
      eye.position.set(tx, ty, 2.2);
      this.group.add(eye);
      this.turrets.push(pod);
    }

    const light = new THREE.PointLight(0xff2e55, 36, 50);
    light.position.z = 4;
    this.group.add(light);
    this.light = light;

    this.group.visible = false;
    scene.add(this.group);

    this.active = false;
    this.hp = 0;
    this.maxHp = 1;
    this.fireTimer = 0;
    this.burstTimer = 0;
    this.flash = 0;
    this.entranceT = 0;
    this.phase = 1;
    this.turretFlip = 0;
  }

  spawn(maxHp) {
    this.active = true;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.fireTimer = 2.5;
    this.burstTimer = 6;
    this.entranceT = 0;
    this.phase = 1;
    this.group.visible = true;
    this.group.position.set(0, 0, -220);
  }

  // returns "volley" | "burst" | "phase2" | null so the caller can react
  update(dt, t, shipPos, plasma) {
    if (!this.active) return null;
    let event = null;

    this.entranceT += dt;
    this.group.position.z = THREE.MathUtils.damp(this.group.position.z, -58, 1.2, dt);
    this.group.position.x = Math.sin(t * 0.43) * 10;
    this.group.position.y = Math.sin(t * 0.61) * 4.5;

    const rage = 1 - this.hp / this.maxHp;
    const p2 = this.phase === 2;

    // phase transition at half HP
    if (!p2 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      event = "phase2";
    }

    // animation: slow menace in phase 1, frenzy in phase 2
    this.bladeRing.rotation.z += dt * (p2 ? 1.6 : 0.45);
    this.carapace.rotation.z -= dt * 0.1;
    this.core.scale.setScalar(1 + Math.sin(t * (p2 ? 11 : 6)) * 0.15);
    for (let i = 0; i < this.mawRings.length; i++) {
      const ring = this.mawRings[i];
      ring.rotation.z += dt * (i % 2 ? -1 : 1) * (p2 ? 2.2 : 0.9);
      ring.scale.setScalar(1 + Math.sin(t * 4 + i * 1.3) * 0.07);
    }
    BOSS_HULL.emissiveIntensity = (p2 ? 0.55 : 0.25) + this.flash * 1.2;
    BOSS_BLADE.emissiveIntensity = (p2 ? 0.8 : 0.35) + this.flash;
    this.light.intensity = (p2 ? 50 : 36) * (1 + this.flash);
    this.flash = Math.max(0, this.flash - dt * 4);

    if (this.entranceT > 2.5) {
      // aimed volleys from alternating turret pods
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = THREE.MathUtils.lerp(p2 ? 1.4 : 2.0, p2 ? 0.8 : 1.2, rage);
        this.turretFlip = (this.turretFlip + 1) % this.turrets.length;
        const origin = this.turrets[this.turretFlip].getWorldPosition(new THREE.Vector3());
        for (const spread of [-3.5, 0, 3.5]) {
          plasma.fire(
            origin,
            new THREE.Vector3(shipPos.x + spread, shipPos.y + spread * 0.4, 0),
            55 + rage * 25
          );
        }
        event = event ?? "volley";
      }

      // phase 2: periodic radial maw burst — a dodge check
      if (p2) {
        this.burstTimer -= dt;
        if (this.burstTimer <= 0) {
          this.burstTimer = 5.5;
          const origin = this.group.position.clone();
          origin.z += 3;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + t;
            plasma.fire(
              origin,
              new THREE.Vector3(
                origin.x + Math.cos(a) * 14,
                origin.y + Math.sin(a) * 9,
                0
              ),
              42
            );
          }
          event = event ?? "burst";
        }
      }
    }
    return event;
  }

  hit(dmg) {
    this.hp -= dmg;
    this.flash = 1;
    return this.hp <= 0;
  }

  despawn() {
    this.active = false;
    this.group.visible = false;
  }
}

// ---------------------------------------------------------------- enemies

// Voidmaw fleet palette: obsidian hulls, blood-red trim, sickly orange glows.
const FOE_HULL = new THREE.MeshStandardMaterial({
  color: 0x1c1216,
  metalness: 0.75,
  roughness: 0.35,
  flatShading: true,
});
const FOE_TRIM = new THREE.MeshStandardMaterial({
  color: 0x6e1020,
  metalness: 0.5,
  roughness: 0.4,
  emissive: 0xc01430,
  emissiveIntensity: 0.85,
});
const FOE_GLOW = new THREE.MeshBasicMaterial({
  color: 0xff3a2a,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const FOE_EYE = new THREE.MeshBasicMaterial({
  color: 0xffb02a,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

// "Talon" — angular interceptor: arrowhead fuselage, forward-swept blade
// wings with glowing red edges, single cyclops sensor slit, twin engines.
function buildTalon() {
  const g = new THREE.Group();

  const fuselageGeo = new THREE.ConeGeometry(0.55, 2.8, 4);
  fuselageGeo.rotateX(Math.PI / 2); // nose toward +Z (facing the player)
  fuselageGeo.rotateZ(Math.PI / 4);
  const fuselage = new THREE.Mesh(fuselageGeo, FOE_HULL);
  fuselage.scale.set(1, 0.55, 1);
  g.add(fuselage);

  // cyclops sensor slit
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.1), FOE_EYE);
  eye.position.set(0, 0.08, 1.1);
  g.add(eye);

  // forward-swept blade wings
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.7), FOE_HULL);
    wing.position.set(side * 1.05, 0, -0.15);
    wing.rotation.y = side * 0.55; // swept toward the viewer — predatory
    wing.rotation.z = side * 0.18;
    g.add(wing);

    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.09, 0.12), FOE_TRIM);
    edge.position.set(side * 1.12, 0, 0.13);
    edge.rotation.y = side * 0.55;
    edge.rotation.z = side * 0.18;
    g.add(edge);
  }

  // dorsal blade fin
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.9), FOE_TRIM);
  fin.position.set(0, 0.38, -0.7);
  fin.rotation.x = 0.35;
  g.add(fin);

  // twin engines (player sees these recede after a flyby)
  for (const side of [-1, 1]) {
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), FOE_GLOW);
    glow.position.set(side * 0.3, 0, -1.35);
    glow.rotation.y = Math.PI;
    g.add(glow);
  }

  return g;
}

// "Mantis" — heavy gunship: armored thorax, two raised gun arms with
// charge-glow tips, under-slung sensor cluster. Holds range and shoots back.
function buildMantis() {
  const g = new THREE.Group();

  const thorax = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), FOE_HULL);
  thorax.scale.set(1.15, 0.8, 1.3);
  g.add(thorax);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.14, 6, 8), FOE_TRIM
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.z = 0.35;
  g.add(collar);

  // raised gun arms ending in glowing emitters
  g.userData.emitters = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.18), FOE_HULL);
    shoulder.position.set(side * 0.95, 0.45, 0.3);
    shoulder.rotation.z = side * 0.55;
    g.add(shoulder);

    const armGeo = new THREE.CylinderGeometry(0.09, 0.13, 1.2, 6);
    armGeo.rotateX(Math.PI / 2);
    const arm = new THREE.Mesh(armGeo, FOE_TRIM);
    arm.position.set(side * 1.35, 0.78, 0.75);
    g.add(arm);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), FOE_EYE);
    tip.position.set(side * 1.35, 0.78, 1.4);
    g.add(tip);
    g.userData.emitters.push(tip);
  }

  // under-slung sensor cluster
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), FOE_EYE);
  sensor.scale.set(1, 0.55, 1);
  sensor.position.set(0, -0.55, 0.7);
  g.add(sensor);

  // engine block
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), FOE_GLOW);
  glow.position.set(0, 0, -1.35);
  glow.rotation.y = Math.PI;
  g.add(glow);

  return g;
}

const ASTEROID_MAT = new THREE.MeshStandardMaterial({
  color: 0x5a554e,
  metalness: 0.05,
  roughness: 0.95,
  flatShading: true,
});

function buildAsteroid() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  // jitter vertices for a rocky look
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    v.multiplyScalar(0.78 + Math.random() * 0.5);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, ASTEROID_MAT);
}

const RING_MAT = new THREE.MeshBasicMaterial({
  color: 0xffc24b,
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending,
});
const RING_GEO = new THREE.TorusGeometry(3.4, 0.18, 8, 40);

export class Spawner {
  constructor(scene, bounds) {
    this.scene = scene;
    this.bounds = bounds; // {x, y} half-extents of play area
    this.entities = [];
    this.droneTimer = 1.2;
    this.rockTimer = 0.6;
    this.ringTimer = 5.0;
    this.mantisTimer = 26; // gunships join the fight a bit later
  }

  spawn(kind, at = null) {
    const b = this.bounds;
    const x = at ? at.x : (Math.random() - 0.5) * 2 * b.x;
    const y = at ? at.y : (Math.random() - 0.5) * 2 * b.y;
    let obj, radius;

    if (kind === "drone") {
      obj = buildTalon();
      radius = 1.4;
      obj.userData.hp = 1;
      obj.userData.weaveSeed = Math.random() * 10;
    } else if (kind === "mantis") {
      obj = buildMantis();
      radius = 1.7;
      obj.userData.hp = 3;
      obj.userData.weaveSeed = Math.random() * 10;
      obj.userData.fireTimer = 1.5 + Math.random();
      obj.userData.muzzleFlip = 0;
    } else if (kind === "rock") {
      obj = buildAsteroid();
      const s = 1.2 + Math.random() * 2.6;
      obj.scale.setScalar(s);
      radius = s * 1.05;
      obj.userData.hp = s > 2.4 ? 3 : 2;
      obj.userData.spin = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).multiplyScalar(1.5);
    } else {
      obj = new THREE.Mesh(RING_GEO, RING_MAT);
      radius = 3.4;
    }

    obj.position.set(x, y, -WORLD_DEPTH);
    this.scene.add(obj);
    this.entities.push({ kind, obj, radius, dead: false });
  }

  // 3-talon V formation around a shared center
  spawnV() {
    const b = this.bounds;
    const cx = (Math.random() - 0.5) * 1.2 * b.x;
    const cy = (Math.random() - 0.5) * 1.2 * b.y;
    this.spawn("drone", { x: cx, y: cy });
    this.spawn("drone", { x: cx - 3.4, y: cy + 2.0 });
    this.spawn("drone", { x: cx + 3.4, y: cy + 2.0 });
  }

  update(dt, speed, elapsed, suppressSpawns = false) {
    if (!suppressSpawns) {
      // spawn cadence ramps up with elapsed time
      const intensity = Math.min(1, elapsed / 90);

      this.droneTimer -= dt;
      if (this.droneTimer <= 0) {
        // sometimes a whole V wing instead of a lone fighter
        if (Math.random() < 0.3) this.spawnV();
        else this.spawn("drone");
        this.droneTimer = THREE.MathUtils.lerp(1.3, 0.55, intensity) * (0.6 + Math.random() * 0.8);
      }

      this.rockTimer -= dt;
      if (this.rockTimer <= 0) {
        this.spawn("rock");
        this.rockTimer = THREE.MathUtils.lerp(1.0, 0.4, intensity) * (0.6 + Math.random() * 0.8);
      }

      this.ringTimer -= dt;
      if (this.ringTimer <= 0) {
        this.spawn("ring");
        this.ringTimer = 6 + Math.random() * 5;
      }

      this.mantisTimer -= dt;
      if (this.mantisTimer <= 0 && elapsed > 12) {
        this.spawn("mantis");
        this.mantisTimer = THREE.MathUtils.lerp(8, 4.5, intensity) * (0.7 + Math.random() * 0.6);
      }
    }

    for (const e of this.entities) {
      if (e.dead) continue;
      e.obj.position.z += speed * dt;

      if (e.kind === "drone") {
        const t = elapsed + e.obj.userData.weaveSeed;
        e.obj.position.x += Math.sin(t * 2.1) * dt * 6;
        e.obj.position.y += Math.cos(t * 1.7) * dt * 4;
        // bank into the weave like a real fighter
        e.obj.rotation.z = Math.sin(t * 2.1) * -0.5;
        e.obj.rotation.x = Math.cos(t * 1.7) * 0.15;
      } else if (e.kind === "mantis") {
        const t = elapsed + e.obj.userData.weaveSeed;
        // gunships drift slowly, holding a firing line
        e.obj.position.x += Math.sin(t * 0.8) * dt * 2.5;
        e.obj.position.y += Math.cos(t * 0.6) * dt * 1.5;
        e.obj.rotation.z = Math.sin(t * 0.8) * -0.15;
        // charge-glow pulse on the gun tips
        const pulse = 1 + Math.sin(t * 5) * 0.25;
        for (const tip of e.obj.userData.emitters) tip.scale.setScalar(pulse);
      } else if (e.kind === "rock") {
        const s = e.obj.userData.spin;
        e.obj.rotation.x += s.x * dt;
        e.obj.rotation.y += s.y * dt;
        e.obj.rotation.z += s.z * dt;
      } else {
        e.obj.rotation.z += dt * 0.8;
      }

      if (e.obj.position.z > 14) this.remove(e);
    }

    this.entities = this.entities.filter((e) => !e.dead);
  }

  remove(e) {
    e.dead = true;
    this.scene.remove(e.obj);
  }

  clear() {
    for (const e of this.entities) this.scene.remove(e.obj);
    this.entities = [];
    this.droneTimer = 0.6; // first contact comes fast
    this.rockTimer = 1.0;
    this.ringTimer = 5.0;
    this.mantisTimer = 13;
  }
}

// ---------------------------------------------------------------- particles

export class ParticleBurst {
  constructor(scene, max = 600) {
    this.scene = scene;
    this.max = max;
    this.cursor = 0;
    this.alive = 0;

    this.positions = new Float32Array(max * 3);
    this.velocities = new Float32Array(max * 3);
    this.life = new Float32Array(max); // remaining life, <=0 means dead

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.6,
      map: makeGlowTexture("rgba(255,180,90,1)"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffbe6e,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // park dead particles far away
    this.positions.fill(99999);
  }

  burst(center, count = 26, power = 18) {
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      this.positions[idx * 3] = center.x;
      this.positions[idx * 3 + 1] = center.y;
      this.positions[idx * 3 + 2] = center.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const v = power * (0.3 + Math.random() * 0.7);
      this.velocities[idx * 3] = Math.sin(phi) * Math.cos(theta) * v;
      this.velocities[idx * 3 + 1] = Math.sin(phi) * Math.sin(theta) * v;
      this.velocities[idx * 3 + 2] = Math.cos(phi) * v;
      this.life[idx] = 0.6 + Math.random() * 0.5;
    }
  }

  update(dt, scrollSpeed) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3] = 99999;
        continue;
      }
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += (this.velocities[i * 3 + 2] + scrollSpeed) * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
