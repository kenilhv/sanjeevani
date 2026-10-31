// Everything drawn over the floor at runtime: heatmap tints, selection glow, and the warm pools of light after dark.
import * as THREE from 'three';
import { C } from '../style/palette.js';
import { canvasTex } from '../style/kit.js';
import { nineSlice, seeded } from './shell-geo.js';

const INSET = 0.15, RADIUS = 0.7, GLOW_R = 1.1;
let fillTex, glowTex, poolTex;

function textures() {
  if (fillTex) return;
  fillTex = canvasTex(128, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.shadowColor = '#fff'; x.shadowBlur = 8; x.fillStyle = '#fff';
    x.beginPath(); x.roundRect(5, 5, w * 2, h * 2, 58); x.fill();
    x.beginPath(); x.roundRect(-w, -h, w * 2 - 5, h * 2 - 5, 58); x.fill();
    x.beginPath(); x.roundRect(5, -h, w * 2, h * 2 - 5, 58); x.fill();
    x.beginPath(); x.roundRect(-w, 5, w * 2 - 5, h * 2, 58); x.fill();
  });
  glowTex = canvasTex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const ring = (lw, blur, color, alpha) => {
      x.save(); x.globalAlpha = alpha; x.shadowColor = color; x.shadowBlur = blur; x.strokeStyle = color; x.lineWidth = lw;
      x.beginPath(); x.roundRect(46, 46, w - 92, h - 92, 66); x.stroke(); x.stroke(); x.restore();
    };
    ring(12, 46, C.teal, 0.7); ring(5, 22, C.tealLight, 0.9); ring(2.5, 4, '#ffffff', 0.95);
  });
  poolTex = canvasTex(256, 256, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,214,160,1)'); g.addColorStop(0.32, 'rgba(255,196,132,.62)'); g.addColorStop(0.7, 'rgba(255,176,110,.16)'); g.addColorStop(1, 'rgba(255,170,100,0)');
    x.clearRect(0, 0, w, h); x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}

/** One heatmap plane and one selection ring per room. Both are invisible (no draw call) until something asks for them. */
export function roomLayers(room) {
  textures();
  const r = room.rect, w = r.w - 2 * INSET, d = r.d - 2 * INSET;
  const overlay = new THREE.Mesh(nineSlice(w, d, RADIUS), new THREE.MeshBasicMaterial({ map: fillTex, transparent: true, opacity: 0, depthWrite: false, color: '#ffffff' }));
  overlay.position.set(r.x + INSET, 0.008, r.z + INSET);
  overlay.visible = false; overlay.userData.dynamic = true; overlay.renderOrder = 0;
  const g = 0.18;
  const glow = new THREE.Mesh(nineSlice(r.w - 2 * g, r.d - 2 * g, GLOW_R), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false }));
  glow.position.set(r.x + g, 0.012, r.z + g);
  glow.visible = false; glow.userData.dynamic = true; glow.renderOrder = 2;
  return { overlay, glow };
}

export function createTints(rooms) {
  const active = new Set();
  const state = (id) => {
    const e = rooms.get(id);
    if (!e) return null;
    return (e.tintState ??= { color: new THREE.Color('#ffffff'), target: new THREE.Color('#ffffff'), a: 0, ta: 0, glow: 0, tg: 0, entry: e });
  };
  let selected = null;
  return {
    setTint(id, color, a = 0.45) {
      const s = state(id);
      if (!s) return;
      if (color == null) s.ta = 0;
      else { s.target.set(color); s.ta = a; if (s.a < 0.01) s.color.set(color); }
      active.add(s);
    },
    highlight(id) {
      if (selected && selected !== id) { const p = state(selected); if (p) { p.tg = 0; active.add(p); } }
      selected = id;
      if (id) { const s = state(id); if (s) { s.tg = 1; active.add(s); } }
    },
    update(dt, t) {
      const k = 1 - Math.exp(-dt * 7), kg = 1 - Math.exp(-dt * 9), breath = 0.84 + 0.16 * Math.sin(t * 2.4);
      for (const s of active) {
        s.a += (s.ta - s.a) * k;
        s.color.lerp(s.target, k);
        s.glow += (s.tg - s.glow) * kg;
        const { overlay, glowMesh } = s.entry;
        overlay.material.opacity = s.a; overlay.material.color.copy(s.color); overlay.visible = s.a > 0.004;
        glowMesh.material.opacity = s.glow * breath; glowMesh.visible = s.glow > 0.01;
        if (s.ta === 0 && s.tg === 0 && s.a < 0.004 && s.glow < 0.01) { s.a = s.glow = 0; overlay.visible = glowMesh.visible = false; active.delete(s); }
      }
    },
  };
}

/** Additive warm pools. All quads share one texture and one material, so a whole floor of ceiling lights is one draw call. */
export function lightPools(spots, y) {
  textures();
  const pos = [], uv = [], idx = [];
  for (const { x, z, r } of spots) {
    const b = pos.length / 3;
    pos.push(x - r, 0, z - r, x + r, 0, z - r, x + r, 0, z + r, x - r, 0, z + r);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.y = y; m.visible = false; m.userData.dynamic = true; m.renderOrder = 2;
  return m;
}

export function roomPools(rooms) {
  const out = [], rnd = seeded(9);
  for (const room of rooms) {
    const r = room.rect, sp = room.circulation ? 4.6 : 5.2, nx = Math.max(1, Math.round(r.w / sp)), nz = Math.max(1, Math.round(r.d / sp));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) out.push({ x: r.x + ((i + 0.5) * r.w) / nx, z: r.z + ((j + 0.5) * r.d) / nz, r: (Math.max(r.w / nx, r.d / nz) * 0.74 + rnd() * 0.2) });
  }
  return out;
}
