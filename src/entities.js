import * as THREE from "three";
import { WORLD_DEPTH, makeGlowTexture } from "./world.js";

// ---------------------------------------------------------------- lasers

const LASER_GEO = new THREE.CapsuleGeometry(0.09, 2.2, 4, 8);
LASER_GEO.rotateX(Math.PI / 2);
const LASER_MAT = new THREE.MeshBasicMaterial({
  color: 0x58ff9b,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

export class LaserPool {
  constructor(scene, size = 40) {
    this.scene = scene;
    this.material = LASER_MAT.clone();
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const m = new THREE.Mesh(LASER_GEO, this.material);
      m.visible = false;
      scene.add(m);
      this.pool.push({ mesh: m, active: false, vel: new THREE.Vector3() });
    }
  }

  fire(origin, dir, speed = 220) {
    const slot = this.pool.find((l) => !l.active);
    if (!slot) return;
    slot.active = true;
    slot.mesh.visible = true;
    slot.mesh.position.copy(origin);
    slot.vel.copy(dir).normalize().multiplyScalar(speed);
    slot.mesh.lookAt(origin.clone().add(dir));
  }

  update(dt) {
    for (const l of this.pool) {
      if (!l.active) continue;
      l.mesh.position.addScaledVector(l.vel, dt);
      if (l.mesh.position.z < -WORLD_DEPTH || l.mesh.position.z > 20) {
        l.active = false;
        l.mesh.visible = false;
      }
    }
  }

  kill(l) {
    l.active = false;
    l.mesh.visible = false;
  }

  setColor(color) {
    this.material.color.set(color);
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
      if (p.mesh.position.z > 16 || p.mesh.position.z < -WORLD_DEPTH) {
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

const BOSS_HULL = new THREE.MeshStandardMaterial({
  color: 0x3d2433,
  metalness: 0.7,
  roughness: 0.35,
  emissive: 0x8a1230,
  emissiveIntensity: 0.3,
  flatShading: true,
});
const BOSS_CORE = new THREE.MeshBasicMaterial({
  color: 0xff2e55,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
});

export class Boss {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    const shell = new THREE.Mesh(new THREE.OctahedronGeometry(5, 1), BOSS_HULL);
    shell.scale.set(1.3, 0.9, 1);
    this.group.add(shell);
    this.shell = shell;

    this.core = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 16), BOSS_CORE);
    this.group.add(this.core);

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(7.2, 0.45, 8, 40),
      BOSS_HULL
    );
    this.group.add(this.ring);

    // cannon spikes
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const spikeGeo = new THREE.ConeGeometry(0.7, 3.2, 6);
      spikeGeo.rotateX(Math.PI / 2);
      const spike = new THREE.Mesh(spikeGeo, BOSS_HULL);
      spike.position.set(Math.cos(a) * 7.2, Math.sin(a) * 7.2, -1);
      this.group.add(spike);
    }

    const light = new THREE.PointLight(0xff2e55, 30, 40);
    this.group.add(light);

    this.group.visible = false;
    scene.add(this.group);

    this.active = false;
    this.hp = 0;
    this.maxHp = 1;
    this.fireTimer = 0;
    this.flash = 0;
    this.entranceT = 0;
  }

  spawn(maxHp) {
    this.active = true;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.fireTimer = 2.5;
    this.entranceT = 0;
    this.group.visible = true;
    this.group.position.set(0, 0, -220);
  }

  update(dt, t, shipPos, plasma) {
    if (!this.active) return;

    // entrance glide, then hold at combat depth
    this.entranceT += dt;
    const targetZ = -58;
    this.group.position.z = THREE.MathUtils.damp(
      this.group.position.z, targetZ, 1.2, dt
    );

    // weave
    this.group.position.x = Math.sin(t * 0.43) * 10;
    this.group.position.y = Math.sin(t * 0.61) * 4.5;

    this.ring.rotation.z += dt * 0.7;
    this.ring.rotation.x = Math.sin(t * 0.5) * 0.3;
    this.shell.rotation.y += dt * 0.4;
    this.core.scale.setScalar(1 + Math.sin(t * 6) * 0.12);

    // damage flash decay
    this.flash = Math.max(0, this.flash - dt * 4);
    BOSS_HULL.emissiveIntensity = 0.3 + this.flash * 1.2;

    // aimed triple volley once in position
    if (this.entranceT > 2.5) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        // harder volleys as hp drops
        const rage = 1 - this.hp / this.maxHp;
        this.fireTimer = THREE.MathUtils.lerp(2.0, 1.0, rage);
        const origin = this.group.position.clone();
        origin.z += 4;
        for (const spread of [-3.5, 0, 3.5]) {
          const target = new THREE.Vector3(
            shipPos.x + spread, shipPos.y + spread * 0.4, 0
          );
          plasma.fire(origin, target, 55 + rage * 25);
        }
        return true; // fired this frame (caller plays sfx)
      }
    }
    return false;
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

const ENEMY_BODY = new THREE.MeshStandardMaterial({
  color: 0x8a2738,
  metalness: 0.6,
  roughness: 0.4,
  emissive: 0xff2244,
  emissiveIntensity: 0.25,
});
const ENEMY_CORE = new THREE.MeshBasicMaterial({
  color: 0xffd24b,
  blending: THREE.AdditiveBlending,
  transparent: true,
});

function buildDrone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.0), ENEMY_BODY);
  body.scale.set(1, 0.6, 1.3);
  g.add(body);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), ENEMY_CORE);
  g.add(core);
  const ringGeo = new THREE.TorusGeometry(1.25, 0.07, 6, 24);
  const ring = new THREE.Mesh(ringGeo, ENEMY_BODY);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  g.userData.ring = ring;
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
  }

  spawn(kind) {
    const b = this.bounds;
    const x = (Math.random() - 0.5) * 2 * b.x;
    const y = (Math.random() - 0.5) * 2 * b.y;
    let obj, radius;

    if (kind === "drone") {
      obj = buildDrone();
      radius = 1.3;
      obj.userData.hp = 1;
      obj.userData.weaveSeed = Math.random() * 10;
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

  update(dt, speed, elapsed, suppressSpawns = false) {
    if (!suppressSpawns) {
      // spawn cadence ramps up with elapsed time
      const intensity = Math.min(1, elapsed / 90);

      this.droneTimer -= dt;
      if (this.droneTimer <= 0) {
        this.spawn("drone");
        this.droneTimer = THREE.MathUtils.lerp(2.4, 0.7, intensity) * (0.6 + Math.random() * 0.8);
      }

      this.rockTimer -= dt;
      if (this.rockTimer <= 0) {
        this.spawn("rock");
        this.rockTimer = THREE.MathUtils.lerp(1.6, 0.45, intensity) * (0.6 + Math.random() * 0.8);
      }

      this.ringTimer -= dt;
      if (this.ringTimer <= 0) {
        this.spawn("ring");
        this.ringTimer = 6 + Math.random() * 5;
      }
    }

    for (const e of this.entities) {
      if (e.dead) continue;
      e.obj.position.z += speed * dt;

      if (e.kind === "drone") {
        const t = elapsed + e.obj.userData.weaveSeed;
        e.obj.position.x += Math.sin(t * 2.1) * dt * 6;
        e.obj.position.y += Math.cos(t * 1.7) * dt * 4;
        e.obj.userData.ring.rotation.z += dt * 3;
        e.obj.rotation.y += dt * 1.2;
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
    this.droneTimer = 1.2;
    this.rockTimer = 0.6;
    this.ringTimer = 5.0;
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
