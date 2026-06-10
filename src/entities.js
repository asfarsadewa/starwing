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
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const m = new THREE.Mesh(LASER_GEO, LASER_MAT);
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

  update(dt, speed, elapsed) {
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
