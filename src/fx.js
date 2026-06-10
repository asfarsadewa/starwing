import * as THREE from "three";

// Animated explosion billboards driven by a 4x4 sprite atlas
// (public/fx/explosion-atlas.png, 16 frames, row-major).

const COLS = 4;
const ROWS = 4;
const FRAMES = COLS * ROWS;
const FPS = 22;

export class ExplosionFX {
  constructor(scene, url = "/fx/explosion-atlas.png", poolSize = 14) {
    this.scene = scene;
    this.pool = [];
    this.ready = false;

    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      for (let i = 0; i < poolSize; i++) {
        // per-sprite texture clone so each can show a different frame
        const t = tex.clone();
        t.needsUpdate = true;
        t.repeat.set(1 / COLS, 1 / ROWS);
        const mat = new THREE.SpriteMaterial({
          map: t,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.visible = false;
        this.scene.add(sprite);
        this.pool.push({ sprite, tex: t, active: false, age: 0, scale: 6 });
      }
      this.ready = true;
    });
  }

  spawn(position, scale = 6) {
    if (!this.ready) return;
    const slot = this.pool.find((s) => !s.active) ?? this.pool[0];
    slot.active = true;
    slot.age = 0;
    slot.scale = scale;
    slot.sprite.visible = true;
    slot.sprite.position.copy(position);
    slot.sprite.material.rotation = Math.random() * Math.PI * 2;
    this._setFrame(slot, 0);
  }

  _setFrame(slot, frame) {
    const col = frame % COLS;
    const row = Math.floor(frame / COLS);
    // atlas is row-major from the top; UV origin is bottom-left
    slot.tex.offset.set(col / COLS, 1 - (row + 1) / ROWS);
  }

  update(dt, scrollSpeed = 0) {
    for (const slot of this.pool) {
      if (!slot.active) continue;
      slot.age += dt;
      slot.sprite.position.z += scrollSpeed * dt;
      const frame = Math.floor(slot.age * FPS);
      if (frame >= FRAMES) {
        slot.active = false;
        slot.sprite.visible = false;
        continue;
      }
      this._setFrame(slot, frame);
      // grow slightly over the burn
      const k = 1 + slot.age * 1.1;
      slot.sprite.scale.set(slot.scale * k, slot.scale * k, 1);
      slot.sprite.material.opacity = frame > FRAMES - 4 ? (FRAMES - frame) / 4 : 1;
    }
  }
}
