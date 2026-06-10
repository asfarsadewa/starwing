import * as THREE from "three";

export const WORLD_DEPTH = 320; // how far ahead things spawn

// Soft round particle texture drawn on a canvas (no external assets).
export function makeGlowTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, "0.55)"));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene) {
  scene.fog = new THREE.FogExp2(0x060a18, 0.0065);
  scene.background = new THREE.Color(0x04060f);

  // --- painted nebula backdrop, far behind the parallax starfield ---
  new THREE.TextureLoader().load("/img/nebula.png", (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      fog: false,
      depthWrite: false,
      // keep it dim so gameplay reads clearly against it
      color: 0x8890a8,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(860, 484), mat);
    plane.position.set(0, 0, -340);
    plane.renderOrder = -1;
    scene.add(plane);
  });

  // --- lights ---
  const key = new THREE.DirectionalLight(0xbfd8ff, 2.4);
  key.position.set(6, 10, 4);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xff5a7a, 1.1);
  rim.position.set(-8, -3, -6);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x223044, 1.4));

  // --- starfield (two layers for parallax) ---
  const starTex = makeGlowTexture();
  const starLayers = [];

  for (const [count, size, spread, speed] of [
    [900, 1.6, 260, 1.0],
    [500, 3.0, 200, 1.8],
  ]) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
      pos[i * 3 + 2] = -Math.random() * WORLD_DEPTH;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size,
      map: starTex,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xcfe8ff,
    });
    const points = new THREE.Points(geo, mat);
    points.userData.speed = speed;
    scene.add(points);
    starLayers.push(points);
  }

  // --- distant nebula billboards ---
  const nebulaColors = [0x1d4d6e, 0x5e2447, 0x23395e];
  for (let i = 0; i < 7; i++) {
    const color = nebulaColors[i % nebulaColors.length];
    const tex = makeGlowTexture(
      `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},0.8)`,
      "rgba(0,0,0,0)"
    );
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    const s = 120 + Math.random() * 160;
    sprite.scale.set(s, s * 0.7, 1);
    sprite.position.set(
      (Math.random() - 0.5) * 300,
      (Math.random() - 0.5) * 120,
      -WORLD_DEPTH + 30 + Math.random() * 60
    );
    scene.add(sprite);
  }

  // --- speed-line tunnel hint: faint wire rings receding ---
  const ringGeo = new THREE.TorusGeometry(26, 0.06, 6, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x1a4a5e,
    transparent: true,
    opacity: 0.35,
  });
  const guideRings = [];
  for (let i = 0; i < 10; i++) {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = -i * (WORLD_DEPTH / 10);
    scene.add(ring);
    guideRings.push(ring);
  }

  return { starLayers, guideRings };
}

export function updateWorld(world, dt, speed) {
  for (const layer of world.starLayers) {
    const pos = layer.geometry.attributes.position;
    const arr = pos.array;
    const v = speed * layer.userData.speed * dt;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 2] += v;
      if (arr[i + 2] > 12) arr[i + 2] -= WORLD_DEPTH;
    }
    pos.needsUpdate = true;
  }

  for (const ring of world.guideRings) {
    ring.position.z += speed * dt;
    if (ring.position.z > 12) ring.position.z -= WORLD_DEPTH;
  }
}
