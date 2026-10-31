// Flow layer: soft glowing dashed ribbons along everyone's remaining route, rebuilt a few times a second.
// One mesh per plate, so ribbons ride with the plate when it moves.
import * as THREE from 'three';
import { C } from '../style/palette.js';

const MAX = 12000, MAX_PTS = 320, HALF = 0.21, HZ = 4;
const VERT = `attribute vec3 aInfo; attribute vec3 aTint; varying vec3 vInfo; varying vec3 vTint;
void main() { vInfo = aInfo; vTint = aTint; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform float uT; uniform float uA; varying vec3 vInfo; varying vec3 vTint;
void main() {
  float across = 1.0 - vInfo.y * vInfo.y, core = smoothstep(0.42, 0.72, across), glow = across * across;
  float d = fract(vInfo.x * 1.3 - uT * 1.25), on = smoothstep(0.0, 0.1, d) * smoothstep(0.62, 0.5, d);
  gl_FragColor = vec4(mix(vTint, vec3(1.0), core * on * 0.12), (glow * 0.62 + core * on * 0.38) * vInfo.z * uA);
  #include <colorspace_fragment>
}`;

const tint = (hex) => new THREE.Color(hex);
const STAFF = tint(C.teal), PATIENT = tint(C.coral), URGENT = tint(C.danger);

export function createFlow(engine) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uT: { value: 0 }, uA: { value: 0 } },
  });
  const layers = engine.floors.map((floor) => {
    const pos = new Float32Array(MAX * 3), info = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), idx = new Uint16Array(MAX * 3);
    const g = new THREE.BufferGeometry();
    const attr = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr(pos, 3)); g.setAttribute('aInfo', attr(info, 3)); g.setAttribute('aTint', attr(col, 3));
    g.setIndex(attr(idx, 1)); g.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'flow'; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
    floor.add(mesh);
    return { g, mesh, pos, info, col, idx, v: 0, i: 0 };
  });
  const rx = new Float32Array(MAX_PTS), rz = new Float32Array(MAX_PTS), sx = new Float32Array(MAX_PTS * 2), sz = new Float32Array(MAX_PTS * 2);
  let on = false, alpha = 0, clock = 0;

  function strip(L, n, c) {
    if (n < 2 || L.v + n * 2 > MAX) return;
    let total = 0;
    for (let i = 1; i < n; i++) total += Math.hypot(sx[i] - sx[i - 1], sz[i] - sz[i - 1]);
    if (total < 0.5) return;
    let along = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = sx[b] - sx[a], tz = sz[b] - sz[a];
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      if (i) along += Math.hypot(sx[i] - sx[i - 1], sz[i] - sz[i - 1]);
      const fade = Math.min(1, along / 0.5) * Math.min(1, (total - along) / 1.1);
      for (let s = -1; s <= 1; s += 2) {
        const v = L.v++;
        L.pos[v * 3] = sx[i] - tz * HALF * s; L.pos[v * 3 + 1] = 0.035; L.pos[v * 3 + 2] = sz[i] + tx * HALF * s;
        L.info[v * 3] = along; L.info[v * 3 + 1] = s; L.info[v * 3 + 2] = fade;
        L.col[v * 3] = c.r; L.col[v * 3 + 1] = c.g; L.col[v * 3 + 2] = c.b;
      }
      if (i) {
        const q = L.v - 4;
        L.idx[L.i++] = q; L.idx[L.i++] = q + 1; L.idx[L.i++] = q + 2;
        L.idx[L.i++] = q + 1; L.idx[L.i++] = q + 3; L.idx[L.i++] = q + 2;
      }
    }
  }

  function rebuild(twin, people) {
    for (const L of layers) { L.v = 0; L.i = 0; }
    for (let k = 0; k < people.length; k++) {
      const P = people[k], a = P.actor;
      if (a.hidden || a.kind === 'visitor' || (a.anim !== 'walk' && a.anim !== 'run' && a.anim !== 'push')) continue;
      if (!engine.floorVisible(P.floor)) continue;
      const route = twin.routeOf?.(a.id);
      if (!route?.length) continue;
      // Corners are softened with one Chaikin pass: a grid path reads as a route, not a staircase.
      let n = 0; rx[n] = P.x; rz[n++] = P.z;
      for (let i = 0; i < route.length && n < MAX_PTS; i++) {
        const dx = route[i].x - rx[n - 1], dz = route[i].z - rz[n - 1];
        if (dx * dx + dz * dz < 0.01) continue;
        rx[n] = route[i].x; rz[n++] = route[i].z;
      }
      let m = 0; sx[m] = rx[0]; sz[m++] = rz[0];
      for (let i = 0; i < n - 1; i++) {
        sx[m] = rx[i] * 0.75 + rx[i + 1] * 0.25; sz[m++] = rz[i] * 0.75 + rz[i + 1] * 0.25;
        sx[m] = rx[i] * 0.25 + rx[i + 1] * 0.75; sz[m++] = rz[i] * 0.25 + rz[i + 1] * 0.75;
      }
      sx[m] = rx[n - 1]; sz[m++] = rz[n - 1];
      strip(layers[P.floor], m, a.anim === 'run' ? URGENT : a.kind === 'patient' ? PATIENT : STAFF);
    }
    for (const L of layers) {
      for (const k of ['position', 'aInfo', 'aTint']) { const b = L.g.attributes[k]; b.clearUpdateRanges(); b.addUpdateRange(0, L.v * 3); b.needsUpdate = true; }
      const ix = L.g.index; ix.clearUpdateRanges(); ix.addUpdateRange(0, L.i); ix.needsUpdate = true;
      L.g.setDrawRange(0, L.i);
    }
  }

  return {
    set(v) { on = v; if (v) clock = 1; },
    update(dt, t, twin, people) {
      alpha += ((on ? 1 : 0) - alpha) * (1 - Math.exp(-dt * 7));
      const show = alpha > 0.01;
      for (const L of layers) L.mesh.visible = show && L.i > 0;
      if (!show) return;
      mat.uniforms.uT.value = t; mat.uniforms.uA.value = alpha;
      if (on && (clock += dt) >= 1 / HZ) { clock = 0; rebuild(twin, people); }
    },
  };
}
