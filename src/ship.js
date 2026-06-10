import * as THREE from "three";

// Procedural star fighters. buildShip(variant) produces one of three silhouettes
// driven by a palette + proportion params (see src/pilots.js).

function wingShape() {
  // Swept delta wing drawn in XZ, extruded thin on Y.
  const s = new THREE.Shape();
  s.moveTo(0, 1.1);     // root leading edge (toward nose)
  s.lineTo(2.6, -1.0);  // wingtip
  s.lineTo(2.3, -1.5);
  s.lineTo(0, -1.3);    // root trailing edge
  s.closePath();
  return s;
}

const DEFAULT_VARIANT = {
  hull: 0xe8eef5,
  dark: 0x2b3442,
  accent: 0xc81e3f,
  canopyGlow: 0x1899c2,
  glow: 0x7df5ff,
  bodyW: 1.0,    // fuselage width multiplier
  noseL: 1.0,    // nose length multiplier
  wingSpan: 1.0, // wing reach multiplier
  style: "vega", // vega | hex | anvil — silhouette extras
};

export function buildShip(variant = {}) {
  const v = { ...DEFAULT_VARIANT, ...variant };

  const HULL = new THREE.MeshStandardMaterial({
    color: v.hull, metalness: 0.55, roughness: 0.32,
  });
  const DARK = new THREE.MeshStandardMaterial({
    color: v.dark, metalness: 0.7, roughness: 0.45,
  });
  const ACCENT = new THREE.MeshStandardMaterial({
    color: v.accent, metalness: 0.4, roughness: 0.35,
  });
  const CANOPY = new THREE.MeshStandardMaterial({
    color: 0x0c2a3a, metalness: 0.1, roughness: 0.05,
    emissive: v.canopyGlow, emissiveIntensity: 0.55,
  });
  const ENGINE_GLOW = new THREE.MeshBasicMaterial({
    color: v.glow, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const ship = new THREE.Group();

  // --- fuselage ---
  const noseH = 2.6 * v.noseL;
  const noseGeo = new THREE.ConeGeometry(0.42 * v.bodyW, noseH, 6);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, HULL);
  nose.position.z = -0.9 - noseH / 2;
  ship.add(nose);

  const bodyGeo = new THREE.CylinderGeometry(0.42 * v.bodyW, 0.62 * v.bodyW, 2.6, 6);
  bodyGeo.rotateX(-Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, HULL);
  body.position.z = 0.4;
  ship.add(body);

  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.34 * v.bodyW, 0.5, 3.4), DARK);
  keel.position.set(0, -0.34, 0.2);
  ship.add(keel);

  // --- canopy ---
  const canopyGeo = new THREE.SphereGeometry(0.4, 16, 12);
  canopyGeo.scale(0.75 * v.bodyW, 0.62, 1.5);
  const canopy = new THREE.Mesh(canopyGeo, CANOPY);
  canopy.position.set(0, 0.42, -0.45);
  ship.add(canopy);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 1.15), ACCENT);
  frame.position.set(0, 0.66, -0.45);
  ship.add(frame);

  // --- main wings ---
  const wGeo = new THREE.ExtrudeGeometry(wingShape(), {
    depth: 0.09, bevelEnabled: true,
    bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1,
  });
  wGeo.rotateX(Math.PI / 2);

  const tipX = 0.45 + 2.33 * v.wingSpan;

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wGeo, HULL);
    wing.position.set(side * 0.45 * v.bodyW, -0.05, 0.55);
    wing.scale.set(side * v.wingSpan, 1, 1);
    wing.rotation.z = side * -0.28;
    ship.add(wing);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.6 * v.wingSpan, 0.13, 0.34), ACCENT
    );
    stripe.position.set(side * (0.45 + 0.9 * v.wingSpan), -0.42, 0.62);
    stripe.rotation.z = side * -0.28;
    ship.add(stripe);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 1.0), DARK);
    fin.position.set(side * tipX, -0.62, 0.3);
    ship.add(fin);

    const cannonGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8);
    cannonGeo.rotateX(Math.PI / 2);
    const cannon = new THREE.Mesh(cannonGeo, DARK);
    cannon.position.set(side * tipX, -0.62, -0.55);
    ship.add(cannon);

    // anvil: heavy underwing engine pods
    if (v.style === "anvil") {
      const podGeo = new THREE.CylinderGeometry(0.26, 0.32, 1.6, 10);
      podGeo.rotateX(Math.PI / 2);
      const pod = new THREE.Mesh(podGeo, DARK);
      pod.position.set(side * (0.45 + 1.3 * v.wingSpan), -0.55, 1.0);
      ship.add(pod);
      const podGlow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), ENGINE_GLOW);
      podGlow.position.set(side * (0.45 + 1.3 * v.wingSpan), -0.55, 1.82);
      podGlow.rotation.y = Math.PI;
      ship.add(podGlow);
    }
  }

  // --- tails ---
  if (v.style === "hex") {
    // single tall swept dorsal fin
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 1.1), HULL);
    fin.position.set(0, 0.85, 1.5);
    fin.rotation.x = -0.25;
    ship.add(fin);
    const finTip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 1.12), ACCENT);
    finTip.position.set(0, 1.5, 1.32);
    finTip.rotation.x = -0.25;
    ship.add(finTip);
  } else {
    for (const side of [-1, 1]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.9), HULL);
      tail.position.set(side * 0.32, 0.62, 1.45);
      tail.rotation.z = side * -0.5;
      ship.add(tail);

      const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.92), ACCENT);
      tailTip.position.set(side * 0.55, 1.02, 1.45);
      tailTip.rotation.z = side * -0.5;
      ship.add(tailTip);
    }
  }

  // --- detail pass: intakes, antenna, nav lights ---
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.9), DARK);
    intake.position.set(side * 0.52 * v.bodyW, 0.12, 0.1);
    ship.add(intake);
    const intakeLip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.92), ACCENT);
    intakeLip.position.set(side * 0.52 * v.bodyW, 0.26, 0.1);
    ship.add(intakeLip);
  }

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), DARK);
  antenna.position.set(0, 0.45, 1.0);
  antenna.rotation.x = 0.4;
  ship.add(antenna);

  // wingtip nav lights: port red, starboard green (blinked in animateShip)
  const navLights = [];
  for (const side of [-1, 1]) {
    const navMat = new THREE.MeshBasicMaterial({
      color: side < 0 ? 0xff2a2a : 0x2aff5a,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), navMat);
    nav.position.set(side * tipX, -0.18, 0.1);
    ship.add(nav);
    navLights.push(nav);
  }

  // --- GERWALK frame: full leg + arm anatomy (Macross-style) ---
  // Fighter mode: legs Z-fold flat under the aft hull reading as engine
  // nacelles, arms tuck along the belly, gunpod hangs as a ventral pod.
  // Gerwalk: legs swing down-forward with a knee bend into a hover stance,
  // arms deploy forward and grip the gunpod, foot thrusters ignite.

  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.5 * v.bodyW, -0.22, 1.05);

    const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), DARK);
    hip.add(hipJoint);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.42), HULL);
    thigh.position.y = -0.5;
    hip.add(thigh);

    const thighTrim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.44), ACCENT);
    thighTrim.position.y = -0.2;
    hip.add(thighTrim);

    const knee = new THREE.Group();
    knee.position.y = -0.92;
    hip.add(knee);

    const kneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.48), ACCENT);
    knee.add(kneeCap);

    // chunky shin — doubles as the engine nacelle when folded
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.56), HULL);
    shin.position.y = -0.6;
    knee.add(shin);

    const shinVent = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.58), DARK);
    shinVent.position.y = -0.95;
    knee.add(shinVent);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.26, 0.8), DARK);
    foot.position.set(0, -1.22, -0.14);
    knee.add(foot);

    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.3), ACCENT);
    toe.position.set(0, -1.18, -0.58);
    knee.add(toe);

    // foot thruster — ignites in gerwalk
    const jet = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10), ENGINE_GLOW.clone());
    jet.material.opacity = 0;
    jet.rotation.x = Math.PI / 2;
    jet.position.set(0, -1.38, -0.05);
    knee.add(jet);

    hip.userData.knee = knee;
    hip.userData.jet = jet;
    hip.rotation.x = -1.55;          // fighter: thigh folded flat aft
    knee.rotation.x = 3.05;          // shin Z-folded forward under the thigh
    hip.scale.setScalar(0.55);       // stowed limbs compact into the hull
    hip.position.y = -0.05;
    ship.add(hip);
    legs.push(hip);
  }

  // arms: shoulder + elbow + hand, folded along the belly in fighter mode
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.52 * v.bodyW, -0.14, 0.3);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.34), DARK);
    shoulder.add(pad);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.58, 0.26), HULL);
    upper.position.y = -0.34;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.64;
    shoulder.add(elbow);

    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.52, 0.22), DARK);
    fore.position.y = -0.28;
    elbow.add(fore);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.26), ACCENT);
    hand.position.y = -0.58;
    elbow.add(hand);

    shoulder.userData.elbow = elbow;
    shoulder.userData.side = side;
    shoulder.rotation.x = -1.6;      // fighter: arm tucked aft along the belly
    elbow.rotation.x = 0.1;
    shoulder.scale.setScalar(0.6);   // stowed
    shoulder.position.y = -0.02;
    ship.add(shoulder);
    arms.push(shoulder);
  }

  // gunpod: ventral pod in fighter mode, gripped forward in gerwalk
  const gunpod = new THREE.Group();
  const podBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 1.7), DARK);
  gunpod.add(podBody);
  const podSpine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 1.2), ACCENT);
  podSpine.position.y = 0.16;
  gunpod.add(podSpine);
  const podBarrelGeo = new THREE.CylinderGeometry(0.075, 0.075, 1.1, 8);
  podBarrelGeo.rotateX(Math.PI / 2);
  const podBarrel = new THREE.Mesh(podBarrelGeo, DARK);
  podBarrel.position.z = -1.3;
  gunpod.add(podBarrel);
  const podTip = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), ENGINE_GLOW.clone());
  podTip.material.opacity = 0;
  podTip.position.z = -1.86;
  podTip.rotation.y = Math.PI;
  gunpod.add(podTip);
  const gunMuzzle = new THREE.Object3D();
  gunMuzzle.position.z = -1.95;
  gunpod.add(gunMuzzle);
  gunpod.position.set(0, -0.62, 0.55); // fighter: slung under the keel
  gunpod.userData.tip = podTip;
  ship.add(gunpod);

  // --- engine ---
  const nozzleGeo = new THREE.CylinderGeometry(0.5 * v.bodyW, 0.36 * v.bodyW, 0.5, 12);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzle = new THREE.Mesh(nozzleGeo, DARK);
  nozzle.position.z = 1.85;
  ship.add(nozzle);

  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.34 * v.bodyW, 16), ENGINE_GLOW);
  glowDisc.position.z = 2.12;
  glowDisc.rotation.y = Math.PI;
  ship.add(glowDisc);

  const plumeGeo = new THREE.ConeGeometry(0.3 * v.bodyW, 1.6, 12);
  plumeGeo.rotateX(-Math.PI / 2);
  const plume = new THREE.Mesh(plumeGeo, ENGINE_GLOW.clone());
  plume.material.opacity = 0.5;
  plume.position.z = 2.95;
  ship.add(plume);

  // long faint after-streak behind the plume (stretches hard while boosting)
  const trailGeo = new THREE.ConeGeometry(0.14 * v.bodyW, 5.0, 8);
  trailGeo.rotateX(-Math.PI / 2);
  const trail = new THREE.Mesh(trailGeo, ENGINE_GLOW.clone());
  trail.material.opacity = 0.16;
  trail.position.z = 4.8;
  ship.add(trail);

  const engineLight = new THREE.PointLight(v.glow, 14, 9);
  engineLight.position.z = 2.4;
  ship.add(engineLight);

  ship.scale.setScalar(0.62);

  ship.userData.plume = plume;
  ship.userData.trail = trail;
  ship.userData.glowDisc = glowDisc;
  ship.userData.engineLight = engineLight;
  ship.userData.navLights = navLights;
  ship.userData.legs = legs;
  ship.userData.arms = arms;
  ship.userData.gunpod = gunpod;
  ship.userData.gunMuzzle = gunMuzzle;
  ship.userData.transformK = 0;
  // wingtip cannon muzzles in ship-local space (pre-scale)
  ship.userData.muzzles = [
    new THREE.Vector3(-tipX, -0.62, -1.3),
    new THREE.Vector3(tipX, -0.62, -1.3),
  ];

  return ship;
}

// eased sub-stage of the master blend: 0 before `a`, 1 after `b`
function stage(k, a, b) {
  const x = THREE.MathUtils.clamp((k - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}

// GERWALK blend: k = 0 fighter, 1 gerwalk. Staged choreography:
// legs unfold first, then the arms deploy and take the gunpod.
export function applyTransform(ship, k) {
  ship.userData.transformK = k;
  const { legs, arms, gunpod } = ship.userData;
  const legK = stage(k, 0.0, 0.55);
  const armK = stage(k, 0.3, 0.85);

  for (const hip of legs) {
    // thigh sweeps from folded-flat-aft to down-forward
    hip.rotation.x = THREE.MathUtils.lerp(-1.55, 0.5, legK);
    // knee unfolds from the forward Z-fold to a bent hover stance
    hip.userData.knee.rotation.x = THREE.MathUtils.lerp(3.05, -0.55, legK);
    // stowed limbs are compacted into the hull; they expand as they deploy
    hip.scale.setScalar(THREE.MathUtils.lerp(0.55, 1, legK));
    hip.position.y = THREE.MathUtils.lerp(-0.05, -0.22, legK);
  }

  for (const shoulder of arms) {
    shoulder.rotation.x = THREE.MathUtils.lerp(-1.6, 0.25, armK);
    shoulder.rotation.z = shoulder.userData.side * 0.35 * armK; // elbows out, hands in
    shoulder.userData.elbow.rotation.x = THREE.MathUtils.lerp(0.1, 1.15, armK);
    shoulder.scale.setScalar(THREE.MathUtils.lerp(0.6, 1, armK));
    shoulder.position.y = THREE.MathUtils.lerp(-0.02, -0.14, armK);
  }

  // gunpod leaves the keel and is held forward between the hands
  gunpod.position.set(
    0,
    THREE.MathUtils.lerp(-0.62, -0.88, armK),
    THREE.MathUtils.lerp(0.55, -0.5, armK)
  );
  gunpod.rotation.x = -0.06 * armK; // slight up-angle, ready to fire
  gunpod.userData.tip.material.opacity = armK * 0.9;
}

// Per-frame engine flicker / boost stretch / nav-light strobe / gerwalk jets
export function animateShip(ship, t, boosting) {
  const { plume, trail, glowDisc, engineLight, navLights, legs } = ship.userData;
  const k = ship.userData.transformK ?? 0;
  const flicker = 0.85 + Math.sin(t * 47) * 0.08 + Math.sin(t * 91) * 0.07;
  const boostK = boosting ? 1.9 : 1.0;
  // in gerwalk, thrust vectors to the foot jets: main plume throttles down
  const plumeK = 1 - 0.55 * k;
  plume.scale.set(
    flicker * boostK * 0.9 * plumeK,
    flicker * boostK * 0.9 * plumeK,
    flicker * boostK * plumeK
  );
  trail.scale.set(boostK * 0.8, boostK * 0.8, flicker * (boosting ? 2.4 : 1) * plumeK);
  trail.material.opacity = (boosting ? 0.34 : 0.14) * plumeK;
  glowDisc.scale.setScalar(flicker * (boosting ? 1.35 : 1));
  engineLight.intensity = 14 * flicker * boostK;

  for (const hip of legs) {
    const jet = hip.userData.jet;
    jet.material.opacity = k * (0.55 + flicker * 0.45);
    jet.scale.setScalar(1 + k * flicker * 0.6);
  }

  // aviation strobe: short double-blink every ~1.2s
  const phase = (t % 1.2) / 1.2;
  const on = phase < 0.07 || (phase > 0.14 && phase < 0.21);
  for (const nav of navLights) nav.material.opacity = on ? 1 : 0.15;
}
