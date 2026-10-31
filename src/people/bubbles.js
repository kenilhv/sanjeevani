// Round icon bubbles over heads. One instanced quad and one canvas atlas, faced to the camera each frame.
import * as THREE from 'three';
import { C } from '../style/palette.js';

const { sin, PI } = Math;
export const ICONS = ['call', 'heart', 'pill', 'zzz', 'alert', 'chat'];
const CELL = 192;

const heart = (x, cx, cy, s) => {
  x.beginPath(); x.moveTo(cx, cy + s * 0.92);
  x.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.82, cy - s * 1.12, cx, cy - s * 0.36);
  x.bezierCurveTo(cx + s * 0.82, cy - s * 1.12, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.92); x.fill();
};
const DRAW = {
  call(x, cx, cy) {
    x.fillStyle = '#f2b632';
    x.beginPath(); x.moveTo(cx - 40, cy + 22); x.quadraticCurveTo(cx - 28, cy + 10, cx - 27, cy - 10); x.arc(cx, cy - 12, 27, PI, 0); x.quadraticCurveTo(cx + 28, cy + 10, cx + 40, cy + 22); x.closePath(); x.fill();
    x.beginPath(); x.roundRect(cx - 42, cy + 20, 84, 10, 5); x.fill();
    x.beginPath(); x.arc(cx, cy + 36, 9, 0, PI * 2); x.fill();
    x.beginPath(); x.arc(cx, cy - 42, 7, 0, PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(cx - 12, cy - 12, 5, 11, 0.3, 0, PI * 2); x.fill();
  },
  heart(x, cx, cy) { x.fillStyle = C.coralDeep; heart(x, cx, cy + 2, 40); x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(cx - 20, cy - 13, 7, 10, 0.6, 0, PI * 2); x.fill(); },
  pill(x, cx, cy) {
    x.save(); x.translate(cx, cy); x.rotate(-PI / 4);
    x.beginPath(); x.roundRect(-46, -20, 92, 40, 20); x.clip();
    x.fillStyle = C.coral; x.fillRect(-46, -20, 46, 40);
    x.fillStyle = C.teal; x.fillRect(0, -20, 46, 40);
    x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(-38, -13, 76, 8);
    x.restore();
  },
  zzz(x, cx, cy) {
    x.strokeStyle = C.info; x.lineJoin = x.lineCap = 'round';
    const z = (ox, oy, s, w) => { x.lineWidth = w; x.beginPath(); x.moveTo(ox - s, oy - s); x.lineTo(ox + s, oy - s); x.lineTo(ox - s, oy + s); x.lineTo(ox + s, oy + s); x.stroke(); };
    z(cx - 22, cy + 18, 19, 10); z(cx + 18, cy - 8, 13, 8); z(cx + 40, cy - 32, 8, 6);
  },
  alert(x, cx, cy) {
    x.fillStyle = '#ffffff';
    x.beginPath(); x.roundRect(cx - 11, cy - 44, 22, 58, 11); x.fill();
    x.beginPath(); x.arc(cx, cy + 34, 13, 0, PI * 2); x.fill();
  },
  chat(x, cx, cy) {
    x.fillStyle = C.tealDeep;
    for (const d of [-32, 0, 32]) { x.beginPath(); x.arc(cx + d, cy, 11.5, 0, PI * 2); x.fill(); }
  },
};

function atlas() {
  const cv = document.createElement('canvas'); cv.width = CELL * ICONS.length; cv.height = CELL;
  const x = cv.getContext('2d');
  ICONS.forEach((name, i) => {
    const ox = i * CELL, cx = ox + CELL / 2, cy = CELL / 2 - 10, r = 74;
    x.save(); x.beginPath(); x.rect(ox, 0, CELL, CELL); x.clip();
    x.shadowColor = 'rgba(40,34,60,.3)'; x.shadowBlur = 12; x.shadowOffsetY = 4;
    x.fillStyle = name === 'alert' ? C.danger : '#ffffff';
    x.beginPath(); x.arc(cx, cy, r, 0, PI * 2); x.fill();
    x.beginPath(); x.moveTo(cx - 17, cy + r - 8); x.quadraticCurveTo(cx, cy + r + 8, cx, cy + r + 20); x.quadraticCurveTo(cx + 3, cy + r + 6, cx + 17, cy + r - 8); x.closePath(); x.fill();
    x.restore();
    x.save(); x.beginPath(); x.rect(ox, 0, CELL, CELL); x.clip();
    DRAW[name](x, cx, cy);
    x.restore();
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createBubbles(scene, cap) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const icon = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aIcon', icon);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
    uniforms: { map: { value: atlas() }, n: { value: ICONS.length } },
    vertexShader: `attribute float aIcon; uniform float n; varying vec2 vUv;
      void main() { vUv = vec2((uv.x + aIcon) / n, uv.y); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv;
      void main() { gl_FragColor = texture2D(map, vUv); if (gl_FragColor.a < 0.01) discard;
      #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; mesh.renderOrder = 20; mesh.count = 0; mesh.visible = false;
  scene.add(mesh);
  const arr = mesh.instanceMatrix.array;
  let n = 0, e = null;
  return {
    begin(camera) { n = 0; e = camera.matrixWorld.elements; },
    /** Advances this person's bubble spring and writes the quad. want: icon name, or null. */
    add(P, want, x, y, z, dt, t, size) {
      const id = want ? ICONS.indexOf(want) : -1;
      // Changing icon pops the old one away first, then the new one springs in.
      if (P.bIcon < 0) { if (id < 0) return; P.bIcon = id; }
      const target = P.bIcon === id ? 1 : 0;
      if (target === 0 && P.bS < 0.04) { P.bIcon = id; P.bS = 0; P.bV = 0; if (id < 0) return; }
      P.bV += ((P.bIcon === id ? 1 - P.bS : -P.bS) * 210 - P.bV * 15) * dt; P.bS += P.bV * dt;
      if (P.bS < 0) { P.bS = 0; P.bV = 0; }
      if (P.bS < 0.01 || n >= cap) return;
      const urgent = P.bIcon === 0 || P.bIcon === 4, beat = P.bIcon === 1 ? 1 + 0.08 * Math.max(0, sin(t * 5.2)) : urgent ? 1 + 0.05 * sin(t * 7) : 1;
      const s = size * P.bS * beat * (urgent ? 1.14 : 1), bob = sin(t * 2.2 + P.look.r * 40) * 0.035, o = n * 16;
      arr[o] = e[0] * s; arr[o + 1] = e[1] * s; arr[o + 2] = e[2] * s; arr[o + 3] = 0;
      arr[o + 4] = e[4] * s; arr[o + 5] = e[5] * s; arr[o + 6] = e[6] * s; arr[o + 7] = 0;
      arr[o + 8] = e[8]; arr[o + 9] = e[9]; arr[o + 10] = e[10]; arr[o + 11] = 0;
      arr[o + 12] = x; arr[o + 13] = y + bob + 0.52 * size * (0.55 + 0.45 * P.bS); arr[o + 14] = z; arr[o + 15] = 1;
      icon.array[n++] = P.bIcon;
    },
    end() {
      mesh.count = n; mesh.visible = n > 0;
      if (n) { mesh.instanceMatrix.needsUpdate = true; icon.needsUpdate = true; }
    },
  };
}
