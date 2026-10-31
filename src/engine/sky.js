// Time of day: sun, fill, backdrop and ctx.night all read from one keyframed table, so a day can be swept freely.
import * as THREE from 'three';
import { BUILDING, SITE } from '../world/plan.js';
import { C } from '../style/palette.js';
import { lerp, smooth, snap, spring, step } from './motion.js';

const RAD = Math.PI / 180;
const CENTRE = new THREE.Vector3((SITE.x0 + SITE.x1) / 2, 0, (SITE.z0 + SITE.z1) / 2);
const FLOOR_Y = [-3, 9];                       // the part of the world that must keep crisp shadow texels
const CAST_M = 0.016, NORMAL_M = 0.026;        // shadow bias in metres; the shadow pass already draws back faces, so these stay tiny

// The backdrop goes through the same tone mapper as the scene. Inverting Khronos Neutral keeps its colours exactly as authored.
function untone([r, g, b]) {
  const m = Math.min(r, g, b), x = m < 0.04 ? Math.sqrt(m / 6.25) : m + 0.04, off = x - m;
  return [r + off, g + off, b + off];
}
const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

const NIGHT_BG = ['#454b92', '#2f336f', '#1e2052'], MOON = '#a3b4ff', NIGHT_SKY = '#7f8de2', NIGHT_GND = '#3b3569';
const DAY_BG = [C.backdropLight, C.backdrop, C.backdropDeep];
// az is a compass bearing (90 east, 180 south, 270 west). The path is art-directed, not astronomical: a true morning sun sits
// behind the default SE camera and flattens everything, so daytime stays on camera-left where shadows show the forms.
// Intensities are tuned so that hemi/π + sun·sin(el)/π ≈ 1.1 at midday, which lands palette colours on screen as written.
const K = (h, az, el, sun, sunI, sky, gnd, hemi, bounce, soft, shade, night, bg, glow, glowI, bloom) =>
  ({ h, row: [az, el, ...rgb(sun), sunI, ...rgb(sky), ...rgb(gnd), hemi, bounce, soft, shade, night, ...bg.flatMap((b) => untone(rgb(b))), ...rgb(glow), glowI, bloom] });
const KEYS = [
  K(0,    200, 54, MOON,      0.72, NIGHT_SKY, NIGHT_GND, 1.75, 0.10, 0.17, 0.62, 1,    NIGHT_BG, '#6a72c8', 0.05, 1),
  K(4.9,  150, 46, MOON,      0.64, NIGHT_SKY, NIGHT_GND, 1.75, 0.10, 0.17, 0.62, 1,    NIGHT_BG, '#6a72c8', 0.05, 1),
  K(5.7,  112,  3, '#ff9a86', 0.30, '#9a98dc', '#5c4c78', 1.70, 0.12, 0.2,  0.55, 0.78, ['#8a76b4', '#655d9e', '#43417c'], '#ff9d8a', 0.16, 0.8),
  K(6.4,  122, 10, '#ffb08c', 1.05, '#e2d6f2', '#cda9b6', 1.95, 0.20, 0.2,  0.72, 0.34, ['#f3d6cf', '#cbbdd4', '#9ca1c8'], '#ffc2a0', 0.2,  0.3),
  K(7.6,  165, 28, '#ffe4c6', 1.62, '#f0f3fc', '#e8d4d0', 2.10, 0.26, 0.15, 0.85, 0,    ['#dde3ec', '#c3cddc', '#a6b4c9'], '#fff0d8', 0.05, 0),
  K(10,   207, 50, '#fff1dc', 1.66, '#f4f8ff', '#e9d8d3', 2.18, 0.26, 0.12, 0.9,  0,    DAY_BG, '#ffffff', 0.02, 0),
  K(13,   236, 58, '#fff3e0', 1.66, '#f4f8ff', '#e9d8d3', 2.18, 0.26, 0.11, 0.9,  0,    DAY_BG, '#ffffff', 0.02, 0),
  K(15.6, 252, 40, '#ffeccf', 1.72, '#f6f5fb', '#ecd8cf', 2.12, 0.26, 0.13, 0.88, 0,    ['#d9dee6', '#c2cad8', '#a7b1c6'], '#ffe9d0', 0.04, 0),
  K(17.3, 270, 18, '#ffb56c', 2.5,  '#e4e0f4', '#d9bfc2', 1.72, 0.16, 0.17, 0.82, 0.04, ['#f8dfc4', '#e0c5ba', '#b0a8bd'], '#ffc080', 0.2,  0.15),
  K(18.4, 282,  7, '#ff8a5c', 1.9,  '#c9b4d8', '#a98aa8', 1.62, 0.14, 0.2,  0.7,  0.3,  ['#eeb197', '#bd8fa6', '#7f6f9e'], '#ff9a6a', 0.26, 0.5),
  K(19.2, 290,  2, '#c08fd8', 0.5,  '#8f8ad4', '#524878', 1.60, 0.12, 0.2,  0.5,  0.74, ['#7f6eb0', '#5e5598', '#3f3b77'], '#c98fc0', 0.12, 0.85),
  K(20.2, 205, 50, MOON,      0.68, NIGHT_SKY, NIGHT_GND, 1.75, 0.10, 0.17, 0.62, 1,    NIGHT_BG, '#6a72c8', 0.05, 1),
];
const AZ = 0, EL = 1, SUN = 2, SUN_I = 5, SKY = 6, GND = 9, HEMI = 12, BOUNCE = 13, SOFT = 14, SHADE = 15, NIGHT = 16, BG = 17, GLOW = 26, GLOW_I = 29, BLOOM = 30;

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 1., 1.); }`;
const fragmentShader = /* glsl */`
  uniform vec3 uA, uB, uC, uGlow;
  uniform vec2 uGlowAt;
  uniform float uAspect, uGlowI, uStars, uTime, uVeil;
  varying vec2 vUv;
  float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
  float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float stars(vec2 p) {
    vec2 g = floor(p), f = fract(p) - .5;
    float h = rnd(g);
    if (h < .94) return 0.;
    vec2 o = (vec2(rnd(g + 3.1), rnd(g + 7.7)) - .5) * .7;
    float twinkle = .62 + .38 * sin(uTime * (.8 + h * 2.) + h * 40.);
    return smoothstep(.05 + (h - .94), .0, length(f - o)) * twinkle * (h - .9) * 8.;
  }
  void main() {
    vec2 p = (vUv - vec2(.5, .53)) * vec2(uAspect, 1.);
    float r = length(p) / (.5 * sqrt(uAspect * uAspect + 1.));
    vec3 c = mix(uA, uB, smoothstep(0., .62, r));
    c = mix(c, uC, smoothstep(.42, 1.04, r));
    vec2 g = (vUv - uGlowAt) * vec2(uAspect, 1.);
    c += uGlow * uGlowI * exp(-dot(g, g) * 2.4);
    c *= 1. - .1 * smoothstep(.7, 1.16, r);
    if (uStars > .01) c += vec3(.72, .78, 1.) * stars(vUv * vec2(uAspect, 1.) * 42.) * uStars * .42;
    gl_FragColor = vec4(c, uVeil);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor.rgb += (ign(gl_FragCoord.xy) - .5) / 255.;
  }`;

export function createSky({ scene, renderer, rig, ctx }) {
  const cur = new Float32Array(KEYS[0].row.length);
  const hours = spring(10);
  const dir = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), inv = new THREE.Matrix4();
  let started = false, tanEl = 1, mapSize = 2048, lastTop = -1, dirty = true;

  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.castShadow = true;
  sun.target.position.copy(CENTRE);
  const hemi = new THREE.HemisphereLight('#ffffff', '#dddddd', 2);
  const bounce = new THREE.DirectionalLight('#ffd6c0', 0.25);
  bounce.target.position.copy(CENTRE);
  // A faint warm lift over the building at night. The shell already lights its rooms, so this only ties them together:
  // any stronger and the tiles wash out to white. One pool, because two would double up wherever the plates overlap.
  const warm = new THREE.SpotLight('#ffd2a0', 0, 0, Math.atan(27 / 72), 0.72, 0);
  warm.position.set(BUILDING.w / 2, 72, BUILDING.d / 2);
  warm.target.position.set(BUILDING.w / 2, 0, BUILDING.d / 2);
  scene.add(sun, sun.target, hemi, bounce, bounce.target, warm, warm.target);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const uniforms = {
    uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uC: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
    uGlowAt: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1.6 }, uGlowI: { value: 0 }, uStars: { value: 0 }, uTime: { value: 0 }, uVeil: { value: 1 },
  };
  // Drawn after all opaque geometry at the far plane, so early-z skips every pixel the diorama covers.
  const backdrop = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthWrite: false }));
  backdrop.frustumCulled = false; backdrop.renderOrder = 1e6; backdrop.raycast = () => {};
  const veilMat = new THREE.ShaderMaterial({ uniforms: { ...uniforms, uVeil: { value: 0 } }, vertexShader, fragmentShader, depthWrite: false, depthTest: false, transparent: true });
  const veil = new THREE.Mesh(geo, veilMat);
  veil.frustumCulled = false; veil.renderOrder = 2e6; veil.visible = false; veil.raycast = () => {};
  scene.add(backdrop, veil);

  function sample(h) {
    const n = KEYS.length;
    let i = n - 1;
    while (i > 0 && KEYS[i].h > h) i--;
    const a = KEYS[i], b = KEYS[(i + 1) % n], end = i + 1 < n ? b.h : 24, u = (h - a.h) / (end - a.h);
    for (let k = 0; k < cur.length; k++) cur[k] = lerp(a.row[k], b.row[k], u);
    cur[AZ] = a.row[AZ] + (((b.row[AZ] - a.row[AZ] + 540) % 360) - 180) * u;
  }

  function apply() {
    const az = cur[AZ] * RAD, el = cur[EL] * RAD, ce = Math.cos(el);
    dir.set(Math.sin(az) * ce, Math.sin(el), -Math.cos(az) * ce);
    tanEl = Math.tan(el);
    sun.position.copy(CENTRE).addScaledVector(dir, 160);
    sun.color.setRGB(cur[SUN], cur[SUN + 1], cur[SUN + 2]);
    sun.intensity = cur[SUN_I];
    sun.shadow.intensity = cur[SHADE];
    hemi.color.setRGB(cur[SKY], cur[SKY + 1], cur[SKY + 2]);
    hemi.groundColor.setRGB(cur[GND], cur[GND + 1], cur[GND + 2]);
    hemi.intensity = cur[HEMI];
    bounce.position.set(CENTRE.x - dir.x * 100, 26, CENTRE.z - dir.z * 100);
    bounce.intensity = cur[BOUNCE];
    warm.intensity = smooth((cur[NIGHT] - 0.12) / 0.8) * 0.42;
    uniforms.uA.value.setRGB(cur[BG], cur[BG + 1], cur[BG + 2]);
    uniforms.uB.value.setRGB(cur[BG + 3], cur[BG + 4], cur[BG + 5]);
    uniforms.uC.value.setRGB(cur[BG + 6], cur[BG + 7], cur[BG + 8]);
    uniforms.uGlow.value.setRGB(cur[GLOW], cur[GLOW + 1], cur[GLOW + 2]);
    uniforms.uGlowI.value = cur[GLOW_I];
    uniforms.uStars.value = smooth((cur[NIGHT] - 0.55) / 0.45);
    renderer.setClearColor(uniforms.uC.value);
    ctx.night = cur[NIGHT];
    dirty = true;
  }

  /** Fit the shadow frustum to the site as seen from the sun. Depth reaches up to a flying plate, width stays tight. */
  function fitShadow(top) {
    const cam = sun.shadow.camera;
    cam.position.copy(sun.position);
    cam.up.set(0, 1, 0);
    cam.lookAt(CENTRE);
    cam.updateMatrixWorld(true);
    inv.copy(cam.matrixWorld).invert();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const x of [SITE.x0, SITE.x1]) for (const z of [SITE.z0, SITE.z1]) for (const y of [FLOOR_Y[0], FLOOR_Y[1], top]) {
      v.set(x, y, z).applyMatrix4(inv);
      if (y !== top || top <= FLOOR_Y[1]) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      z0 = Math.min(z0, -v.z); z1 = Math.max(z1, -v.z);
    }
    Object.assign(cam, { left: x0 - 1, right: x1 + 1, top: y1 + 1, bottom: y0 - 1, near: z0 - 3, far: z1 + 3 });
    cam.updateProjectionMatrix();
    const range = cam.far - cam.near, texel = (cam.right - cam.left) / mapSize;
    sun.shadow.radius = cur[SOFT] / texel;
    sun.shadow.bias = -(CAST_M + texel * 0.6) / range;
    sun.shadow.normalBias = NORMAL_M + texel * 0.5;
    lastTop = top;
    dirty = false;
  }

  sample(hours.x);
  apply();

  return {
    sun,
    get night() { return cur[NIGHT]; },
    get bloom() { return cur[BLOOM]; },
    get tanEl() { return tanEl; },
    setHours(h) {
      if (!started) { started = true; snap(hours, h); sample(((h % 24) + 24) % 24); apply(); return; }
      hours.g += ((h - hours.g + 36) % 24 + 24) % 24 - 12;
    },
    setMapSize(size) {
      if (size === mapSize && sun.shadow.map) return;
      mapSize = size;
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      dirty = true;
    },
    setVeil(a) {
      veilMat.uniforms.uVeil.value = a;
      veil.visible = a > 0.002;
    },
    resize(w, h) { uniforms.uAspect.value = w / h; },
    update(dt, t, top) {
      if (Math.abs(hours.g - hours.x) > 1e-4 || Math.abs(hours.v) > 1e-4) {
        step(hours, 6, dt);
        sample(((hours.x % 24) + 24) % 24);
        apply();
      }
      uniforms.uTime.value = t;
      uniforms.uGlowAt.value.set(0.5 + dir.dot(rig.right) * 0.46, 0.53 + dir.dot(rig.up) * 0.46);
      if (dirty || Math.abs(top - lastTop) > 0.2) fitShadow(top);
    },
  };
}
