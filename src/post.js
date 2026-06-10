import * as THREE from "three";

// VHS-on-a-CRT post pass: the scene renders into a target, then a fullscreen
// quad replays it through a tape deck — curvature, tracking-band skew, chroma
// bleed, ghosting, washout, grain, dropouts, wobble, scanlines, vignette.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

  void main() {
    vec2 uv = vUv;

    // CRT glass curvature
    vec2 cc = uv - 0.5;
    uv += cc * dot(cc, cc) * 0.14;

    // tape wobble: per-line horizontal jitter + a slow breathing sway
    uv.x += sin(uv.y * 7.0 + time * 2.1) * 0.0014
          + sin(uv.y * 31.0 - time * 5.3) * 0.0006;

    // roaming tracking band: a horizontal stripe that skews hard and
    // carries dropout static with it
    float bandPos = fract(time * 0.11) * 1.2 - 0.1;
    float inBand = 1.0 - smoothstep(0.0, 0.03, abs(uv.y - bandPos));
    float skewSeed = hash(floor(time * 16.0));
    uv.x += inBand * (skewSeed - 0.5) * 0.18;

    // occasional whole-frame horizontal jump (head-switch tear)
    float frameSeed = hash(floor(time * 6.0));
    if (frameSeed > 0.93) {
      uv.x += (hash(floor(time * 6.0) + 7.0) - 0.5)
            * 0.06 * step(0.85, fract(uv.y * 2.0 + time * 3.0));
    }

    vec2 px = 1.0 / resolution;

    // chroma bleed: RGB sampled apart, then smeared sideways
    vec3 col;
    col.r = texture2D(tDiffuse, uv + vec2(px.x * 2.6, 0.0)).r;
    col.g = texture2D(tDiffuse, uv).g;
    col.b = texture2D(tDiffuse, uv - vec2(px.x * 2.0, 0.0)).b;

    vec3 smear = (
      texture2D(tDiffuse, uv + vec2(px.x * 5.0, 0.0)).rgb +
      texture2D(tDiffuse, uv - vec2(px.x * 5.0, 0.0)).rgb +
      texture2D(tDiffuse, uv + vec2(0.0, px.y * 1.6)).rgb +
      texture2D(tDiffuse, uv - vec2(0.0, px.y * 1.6)).rgb
    ) * 0.25;
    col = mix(col, smear, 0.4);

    // ghost echoes (tape print-through): two faint delayed copies
    col += texture2D(tDiffuse, uv - vec2(px.x * 16.0, 0.0)).rgb * 0.11;
    col += texture2D(tDiffuse, uv - vec2(px.x * 34.0, 0.0)).rgb * 0.05;

    // washed out: desaturate, lift the blacks, squash the highlights
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, 0.72);
    col = col * 0.88 + 0.055;

    // scanlines + slight interlace flicker
    float scan = 0.8 + 0.2 * sin(uv.y * resolution.y * 3.14159
                                 + step(0.5, fract(time * 30.0)) * 3.14159);
    col *= scan;

    // tape grain
    col += (hash2(uv * resolution.xy + time * 60.0) - 0.5) * 0.07;

    // white dropout streaks riding the tracking band
    float streak = step(0.72, hash2(vec2(floor(uv.y * resolution.y * 0.5),
                                         floor(time * 22.0))));
    col += inBand * streak * 0.4;

    // vignette + darkened off-glass edges
    col *= 1.0 - dot(cc, cc) * 1.1;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);

    // back to sRGB-ish for the screen
    col = pow(max(col, 0.0), vec3(0.4545));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class RetroPost {
  constructor(renderer) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(2, 2, {
      samples: 4, // keep MSAA when rendering off-screen
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(2, 2) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.setSize(window.innerWidth, window.innerHeight);
  }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.rt.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.material.uniforms.resolution.value.set(Math.floor(w * pr), Math.floor(h * pr));
  }

  render(scene, camera, time) {
    this.material.uniforms.time.value = time;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
