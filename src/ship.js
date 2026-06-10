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
  // wingtip cannon muzzles in ship-local space (pre-scale)
  ship.userData.muzzles = [
    new THREE.Vector3(-tipX, -0.62, -1.3),
    new THREE.Vector3(tipX, -0.62, -1.3),
  ];

  return ship;
}

// Per-frame engine flicker / boost stretch / nav-light strobe
export function animateShip(ship, t, boosting) {
  const { plume, trail, glowDisc, engineLight, navLights } = ship.userData;
  const flicker = 0.85 + Math.sin(t * 47) * 0.08 + Math.sin(t * 91) * 0.07;
  const boostK = boosting ? 1.9 : 1.0;
  plume.scale.set(flicker * boostK * 0.9, flicker * boostK * 0.9, flicker * boostK);
  trail.scale.set(boostK * 0.8, boostK * 0.8, flicker * (boosting ? 2.4 : 1));
  trail.material.opacity = boosting ? 0.34 : 0.14;
  glowDisc.scale.setScalar(flicker * (boosting ? 1.35 : 1));
  engineLight.intensity = 14 * flicker * boostK;

  // aviation strobe: short double-blink every ~1.2s
  const phase = (t % 1.2) / 1.2;
  const on = phase < 0.07 || (phase > 0.14 && phase < 0.21);
  for (const nav of navLights) nav.material.opacity = on ? 1 : 0.15;
}
