// The floating island: one painted top surface, cake-slice strata around the rim, a soft shadow on the void beneath.
import * as THREE from 'three';
import { C } from '../style/palette.js';
import { SITE, ZONES, BUILDING } from './plan.js';
import { ball, canvasTex, mat } from '../style/kit.js';
import { rgb, blend, roundedShape, seeded, whenFonts, SANS } from './shell-geo.js';

const PX = 48;
export const GROUND_Y = -0.02;
const RADIUS = 3.2;

const shapePath = {
  rect: (x, y, w, h, r = 0) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; },
  fillet: (cx, cz, sx, sz, r) => { const p = new Path2D(); p.moveTo(cx, cz); p.lineTo(cx + sx * r, cz); p.quadraticCurveTo(cx, cz, cx, cz + sz * r); p.closePath(); return p; },
};

function roads() {
  const { street, spur, apron, parking } = ZONES;
  const layby = new Path2D();
  // The mouth widths come from ROUTES.carDropoff, so a car cutting from lane to bay stays on tarmac the whole way.
  layby.moveTo(-3.8, street.z + 0.2);
  layby.bezierCurveTo(-1.4, street.z + 0.2, -0.6, 29, 2.6, 29);
  layby.lineTo(15.2, 29);
  layby.bezierCurveTo(18.2, 29, 18.8, street.z + 0.2, 21.4, street.z + 0.2);
  layby.lineTo(12.9, street.z + 0.2);
  layby.bezierCurveTo(12, 33.1, 11.7, 32.2, 10.6, 32.2);
  layby.lineTo(6.2, 32.2);
  layby.bezierCurveTo(5.1, 32.2, 4.9, 33.1, 4.1, street.z + 0.2);
  layby.closePath();
  return [
    shapePath.rect(street.x - 1, street.z, street.w + 2, street.d),
    shapePath.rect(spur.x, spur.z, spur.w, spur.d + 0.2),
    shapePath.rect(spur.x + 0.5, parking.z + parking.d - 0.5, 5.1, spur.z - parking.z - parking.d + 1),
    shapePath.rect(apron.x - 0.3, apron.z, apron.w + 0.3, apron.d, [0, 1.2, 1.2, 0]),
    shapePath.rect(parking.x, parking.z, parking.w, parking.d, 0.9),
    shapePath.fillet(spur.x, spur.z + spur.d, -1, -1, 4.4),
    shapePath.fillet(spur.x + spur.w, spur.z + spur.d, 1, -1, 2.2),
    shapePath.fillet(spur.x, apron.z + apron.d, -1, 1, 1.8),
    layby,
  ];
}

function smoothPath(x, pts) {
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) x.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  const l = pts[pts.length - 1]; x.lineTo(l[0], l[1]);
}
function gardenPath(x, pts, w) {
  x.lineCap = 'round'; x.lineJoin = 'round';
  smoothPath(x, pts); x.strokeStyle = 'rgba(120,150,110,.28)'; x.lineWidth = w + 0.34; x.stroke();
  smoothPath(x, pts); x.strokeStyle = C.pavingDeep; x.lineWidth = w + 0.13; x.stroke();
  smoothPath(x, pts); x.strokeStyle = C.paving; x.lineWidth = w; x.stroke();
}

function lawn(x, rnd, W, D) {
  const { x0, z0 } = SITE;
  x.fillStyle = C.grass; x.fillRect(x0, z0, W, D);
  // Mowing stripes change direction at the garden edge, which is what makes a lawn look looked-after.
  x.save(); x.beginPath(); x.rect(0, z0, W, D); x.clip();
  for (let i = 0; i * 2.1 < D; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.075)' : 'rgba(40,110,60,.035)'; x.fillRect(x0, z0 + i * 2.1, W, 2.1); }
  x.restore();
  x.save(); x.beginPath(); x.rect(x0, z0, -x0, D); x.clip();
  for (let i = 0; i * 1.9 < 9; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.075)' : 'rgba(40,110,60,.035)'; x.fillRect(x0 + i * 1.9, z0, 1.9, D); }
  x.restore();
  for (let i = 0; i < 26000; i++) {
    x.fillStyle = rnd() > 0.5 ? 'rgba(255,255,240,.10)' : 'rgba(40,110,70,.10)';
    x.fillRect(x0 + rnd() * W, z0 + rnd() * D, 0.05 + rnd() * 0.09, 0.05 + rnd() * 0.05);
  }
}

function pavement(x, rnd) {
  const { plaza } = ZONES;
  x.fillStyle = C.pavingDeep; x.fillRect(plaza.x, plaza.z, plaza.w, plaza.d);
  const base = new THREE.Color(C.paving), warm = new THREE.Color('#f6efe4'), cool = new THREE.Color('#e5ddd0'), col = new THREE.Color();
  for (let j = 0; j < 3; j++) for (let i = 0; i < 38; i++) {
    const r = rnd();
    col.copy(base).lerp(r > 0.5 ? warm : cool, (r > 0.5 ? r - 0.5 : 0.5 - r) * 1.4);
    x.fillStyle = `#${col.getHexString()}`;
    x.fillRect(plaza.x + i + 0.03 + (j % 2) * 0, plaza.z + j + 0.03, 0.94, 0.94);
  }
  // Entrance mat: a teal-bordered welcome that points the eye at the main doors.
  x.fillStyle = 'rgba(47,196,196,.28)'; x.beginPath(); x.roundRect(4.9, 26.25, 5.2, 1.9, 0.28); x.fill();
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.roundRect(5.15, 26.45, 4.7, 1.5, 0.18); x.fill();
  // Tactile lane from the zebra to the doors.
  x.fillStyle = C.lineYellow;
  for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(7.1 + k * 0.27, 28.25 + i * 0.25, 0.07, 0, 7); x.fill(); }
}

function roadSurface(x, rnd, W, D) {
  const paths = roads(), { x0, z0 } = SITE;
  for (const [w, a] of [[1.4, 0.05], [1.0, 0.07], [0.7, 0.09]]) { x.strokeStyle = `rgba(50,60,60,${a})`; x.lineWidth = w; paths.forEach((p) => x.stroke(p)); }
  x.strokeStyle = C.curb; x.lineWidth = 0.5; x.lineJoin = 'round'; paths.forEach((p) => x.stroke(p));
  x.fillStyle = C.asphalt; paths.forEach((p) => x.fill(p));
  // Aggregate, and a subtle wear path down each lane.
  x.save(); paths.forEach((p) => x.clip(p, 'nonzero')); x.restore();
  const road = new Path2D(); paths.forEach((p) => road.addPath(p));
  x.save(); x.clip(road, 'nonzero');
  for (let i = 0; i < 26000; i++) {
    x.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(20,24,34,.08)';
    x.fillRect(x0 + rnd() * W, z0 + rnd() * D, 0.05, 0.05);
  }
  x.fillStyle = 'rgba(30,34,46,.06)';
  x.fillRect(SITE.x0, 34.5, W, 1.0); x.fillRect(SITE.x0, 36.6, W, 1.0);
  x.restore();
}

function dash(x, x0, z0, x1, z1, on, off, w, color) {
  x.save(); x.strokeStyle = color; x.lineWidth = w; x.setLineDash([on, off]); x.lineCap = 'butt';
  x.beginPath(); x.moveTo(x0, z0); x.lineTo(x1, z1); x.stroke(); x.restore();
}
function arrow(x, cx, cz, dir) {
  x.save(); x.translate(cx, cz); x.scale(1, dir); x.fillStyle = C.lineWhite;
  x.beginPath(); x.moveTo(0, -1.3); x.lineTo(0.55, -0.45); x.lineTo(0.16, -0.45); x.lineTo(0.16, 1.1); x.lineTo(-0.16, 1.1); x.lineTo(-0.16, -0.45); x.lineTo(-0.55, -0.45); x.closePath(); x.fill();
  x.restore();
}
function zebra(x, x0, z0, x1, z1) {
  const horizontalBars = z1 - z0 > x1 - x0 ? false : true;
  x.fillStyle = C.lineWhite;
  if (!horizontalBars) for (let z = z0; z + 0.45 <= z1 + 0.01; z += 0.9) x.fillRect(x0, z, x1 - x0, 0.45);
  else for (let v = x0; v + 0.45 <= x1 + 0.01; v += 0.9) x.fillRect(v, z0, 0.45, z1 - z0);
}

function markings(x, { padProp, bayProp }) {
  const { street, spur, apron, parking } = ZONES, W = C.lineWhite, Y = C.lineYellow;
  const mid = street.z + street.d / 2 - 0.05;
  x.fillStyle = W;
  x.fillRect(street.x, street.z + 0.34, spur.x - 4.4 - street.x, 0.09);
  x.fillRect(street.x, street.z + street.d - 0.42, street.w, 0.09);
  dash(x, street.x, mid, 5.4, mid, 2, 1.4, 0.15, W);
  dash(x, 10.3, mid, street.x + street.w, mid, 2, 1.4, 0.15, W);
  zebra(x, 5.9, street.z + 0.5, 9.1, street.z + street.d - 0.5);
  zebra(x, 5.9, 29.25, 9.1, 31.95);
  zebra(x, spur.x + 0.4, 30.05, spur.x + spur.w - 0.4, 32.2);
  arrow(x, 45.0, 27.4, 1); arrow(x, 48.9, 27.4, -1);
  dash(x, 47.0, 27.6, 47.0, 29.6, 1.4, 1, 0.14, W);
  // Drop-off lay-by: double yellow kerb line and a "set down" outline.
  x.fillStyle = Y; x.fillRect(3.2, 29.22, 11.6, 0.09); x.fillRect(3.2, 29.42, 11.6, 0.09);
  x.strokeStyle = W; x.lineWidth = 0.09; x.setLineDash([0.6, 0.4]); x.beginPath(); x.moveTo(3, 31.95); x.lineTo(5.6, 31.95); x.moveTo(9.6, 31.95); x.lineTo(14, 31.95); x.stroke(); x.setLineDash([]);

  // Apron: pale concrete with the ambulance bay framed and everything else hatched keep-clear.
  x.fillStyle = C.asphaltLight;
  x.beginPath(); x.roundRect(apron.x, apron.z, apron.w - 0.4, apron.d - 0.4, [0, 1, 1, 0]); x.fill();
  const hatch = (hx, hz, hw, hd) => {
    x.save(); x.beginPath(); x.rect(hx, hz, hw, hd); x.clip();
    x.strokeStyle = Y; x.lineWidth = 0.2;
    for (let d = -hd; d < hw + hd; d += 0.72) { x.beginPath(); x.moveTo(hx + d, hz); x.lineTo(hx + d + hd, hz + hd); x.stroke(); }
    x.restore();
    x.strokeStyle = Y; x.lineWidth = 0.13; x.strokeRect(hx, hz, hw, hd);
  };
  hatch(38.5, 15.0, 7.6, 2.9);
  hatch(38.5, 22.1, 7.6, 1.2);
  x.strokeStyle = Y; x.lineWidth = 0.16; x.strokeRect(38.5, 18.15, 7.6, 3.7);
  x.fillStyle = W; x.fillRect(38.55, 18.2, 0.5, 3.6);
  for (const z of [16.4, 23.6]) { x.fillStyle = 'rgba(255,255,255,.0)'; x.fillRect(46, z, 0, 0); }

  // Staff car park.
  x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(parking.x + 0.3, parking.z + 5.3, parking.w - 0.6, 2);
  if (!bayProp) {
    x.fillStyle = W;
    for (let i = 0; i <= 5; i++) x.fillRect(parking.x + i * 2.6 - 0.05, parking.z + 0.15, 0.1, 5.05);
  }
  x.fillStyle = 'rgba(255,255,255,.55)'; x.font = `800 1.4px ${SANS}`;
  x.fillStyle = C.lineYellow; x.fillRect(parking.x + 0.5, parking.z + 5.9, parking.w - 1, 0.08);

  if (!padProp) {
    const cx = 46, cz = -1.5;
    x.fillStyle = '#d7dbe2'; x.beginPath(); x.arc(cx, cz, 5.4, 0, 7); x.fill();
    x.strokeStyle = Y; x.lineWidth = 0.28; x.beginPath(); x.arc(cx, cz, 4.8, 0, 7); x.stroke();
    x.fillStyle = W; x.fillRect(cx - 1.6, cz - 2, 0.7, 4); x.fillRect(cx + 0.9, cz - 2, 0.7, 4); x.fillRect(cx - 1.6, cz - 0.3, 3.2, 0.6);
  } else {
    x.fillStyle = 'rgba(205,212,222,.92)'; x.beginPath(); x.arc(46, -1.5, 5.7, 0, 7); x.fill();
  }
}

function paintSite(x, W, D, opts) {
  const rnd = seeded(11), { x0, z0 } = SITE;
  x.setTransform(PX, 0, 0, PX, -x0 * PX, -z0 * PX);
  lawn(x, rnd, W, D);
  // Soft dark halo where turf meets the building, so the facade stands in the ground rather than on it.
  for (const [w, a] of [[3.4, 0.03], [2.4, 0.04], [1.6, 0.05], [0.9, 0.07]]) {
    x.strokeStyle = `rgba(50,70,60,${a})`; x.lineWidth = w; x.lineJoin = 'round';
    x.strokeRect(-0.2, -0.2, BUILDING.w + 0.4, BUILDING.d + 0.4);
  }
  // Garden and service paths under everything hard.
  gardenPath(x, [[-0.2, 27.6], [-3.2, 27.5], [-5.7, 26.4], [-5.9, 24.2], [-4.6, 19.3], [-5.7, 14.2], [-4.6, 9], [-5.8, 1.2], [-5.2, -1.3], [-2.8, -2.55], [2, -2.6]], 1.05);
  gardenPath(x, [[2, -2.6], [14, -2.45], [26, -2.65], [38, -2.45], [41.6, -2.1]], 1.05);
  gardenPath(x, [[38, 28.2], [40, 30.5], [43.5, 31.1]], 0.95);
  pond(x, rnd, -4.2, 30.3, 1.25, 1.75);
  pavement(x, rnd);
  roadSurface(x, rnd, W, D);
  markings(x, opts);
}

function pond(x, rnd, cx, cz, rx, rz) {
  x.save(); x.translate(cx, cz); x.rotate(0.22);
  x.fillStyle = C.pavingDeep; x.beginPath(); x.ellipse(0, 0, rx + 0.3, rz + 0.3, 0, 0, 7); x.fill();
  const g = x.createRadialGradient(-0.2, -0.4, 0.2, 0, 0, rz);
  g.addColorStop(0, '#c4eef2'); g.addColorStop(1, '#8dd3e0');
  x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, rx, rz, 0, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 0.05;
  for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(-0.1, 0.3 - i * 0.5, 0.5 + i * 0.1, 0.2, 0, 0, 3.4); x.stroke(); }
  x.fillStyle = '#5fb878';
  for (const [a, b] of [[0.5, 1.1], [-0.4, -0.9], [0.1, 1.6]]) { x.beginPath(); x.ellipse(a, b, 0.22, 0.16, a, 0, 7); x.fill(); }
  x.restore();
}

/** The word sits on its own decal: crisper than the 48 px/m site map, and repaintable once Inter has loaded. */
function ambulanceDecal(ground) {
  const draw = (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = C.lineYellow; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `800 ${h * 0.82}px ${SANS}`;
    if ('letterSpacing' in x) x.letterSpacing = `${h * 0.14}px`;
    x.fillText('AMBULANCE', w / 2, h / 2 + 4);
  };
  const tex = canvasTex(1536, 176, draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 1.28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.9 }));
  m.position.set(44.3, GROUND_Y + 0.01, 24.45);
  m.userData.dynamic = true; m.renderOrder = 1;
  ground.add(m);
  whenFonts(() => { draw(tex.image.getContext('2d'), tex.image.width, tex.image.height); tex.needsUpdate = true; });
}

function surfaceColour(x, z) {
  const { street } = ZONES;
  if (z >= street.z && z <= street.z + street.d) return rgb(C.asphalt);
  if (z > street.z + street.d) return rgb(C.curb);
  return rgb(C.grass);
}

/** Outline of the rounded slab, densely sampled so strata can wobble and zones can colour the rim. */
function outline(step = 1.1, seg = 14) {
  const { x0, z0, x1, z1 } = SITE, r = RADIUS, pts = [];
  const line = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / step); for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]); };
  const arc = (cx, cz, a0) => { for (let i = 0; i < seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } };
  line(x0 + r, z0, x1 - r, z0); arc(x1 - r, z0 + r, -Math.PI / 2);
  line(x1, z0 + r, x1, z1 - r); arc(x1 - r, z1 - r, 0);
  line(x1 - r, z1, x0 + r, z1); arc(x0 + r, z1 - r, Math.PI / 2);
  line(x0, z1 - r, x0, z0 + r); arc(x0 + r, z0 + r, Math.PI);
  return pts;
}

function wobble(n, seed) {
  const rnd = seeded(seed), terms = [[4, 1], [9, 0.6], [17, 0.42], [31, 0.28], [53, 0.16]].map(([k, a]) => [k, a, rnd() * 6.283]);
  return (i) => terms.reduce((s, [k, a, ph]) => s + a * Math.sin((i / n) * 6.283 * k + ph), 0) / 1.6;
}

function strata() {
  const pts = outline(), n = pts.length, { x0, z0, x1, z1 } = SITE, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  const soilTop = '#caa688', soilLow = '#b38a6c', dark = '#8f6c58', r1 = '#b4b9c6', r2 = '#a0a6b6', r3 = '#8f96a8', r4 = '#7f8799', r5 = '#70788c';
  const w1 = wobble(n, 3), w2 = wobble(n, 8), w3 = wobble(n, 21), w4 = wobble(n, 34);
  const noY = () => 0;
  // Each ring: depth y, inset d, colour, plus wobble functions. Doubled rows at the same wobble make a crisp colour change, like cake.
  const rings = [
    { y: GROUND_Y, d: 0.07, c: null },
    { y: -0.07, d: 0.0, c: null },
    { y: -0.17, d: -0.02, c: null, k: 0.92 },
    { y: -0.27, d: 0.0, c: null, k: 0.84 },
    { y: -0.27, d: 0.0, c: dark, wy: noY },
    { y: -0.33, d: 0.015, c: dark, wy: (i) => w1(i) * 0.03 },
    { y: -0.33, d: 0.015, c: soilTop, wy: (i) => w1(i) * 0.03 },
    { y: -0.72, d: 0.03, c: soilLow, wy: (i) => w1(i) * 0.08 },
    { y: -1.12, d: 0.05, c: soilLow, wy: (i) => w2(i) * 0.15 },
    { y: -1.14, d: 0.06, c: r1, wy: (i) => w2(i) * 0.15 },
    { y: -1.62, d: 0.08, c: r2, wy: (i) => w2(i) * 0.1 + w3(i) * 0.1 },
    { y: -1.86, d: 0.1, c: r2, wy: (i) => w3(i) * 0.18 },
    { y: -1.88, d: 0.11, c: r3, wy: (i) => w3(i) * 0.18 },
    { y: -2.5, d: 0.34, c: r4, wy: (i) => w3(i) * 0.3, wd: (i) => w4(i) * 0.14 },
    { y: -3.2, d: 1.1, c: r4, wy: (i) => w4(i) * 0.4, wd: (i) => w3(i) * 0.3 },
    { y: -3.9, d: 2.7, c: r5, wy: (i) => w1(i) * 0.5 + w4(i) * 0.2, wd: (i) => w2(i) * 0.5 },
    { y: -4.5, d: 6.0, c: r5, wy: (i) => w2(i) * 0.6, wd: (i) => w3(i) * 0.9 },
    { y: -4.9, d: 12, c: r5, wy: (i) => w3(i) * 0.5 },
  ];
  const pos = [], col = [], idx = [];
  rings.forEach((r) => {
    for (let i = 0; i < n; i++) {
      const [px, pz] = pts[i], d = r.d + (r.wd ? r.wd(i) : 0), sx = 1 - (2 * d) / W, sz = 1 - (2 * d) / D;
      pos.push(cx + (px - cx) * sx, r.y + (r.wy ? r.wy(i) : 0), cz + (pz - cz) * sz);
      const c = r.c ? rgb(r.c) : blend(surfaceColour(px, pz), [0, 0, 0], 1 - (r.k ?? 1));
      col.push(c[0], c[1], c[2]);
    }
  });
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) {
    const a = r * n + i, b = r * n + ((i + 1) % n), c = (r + 1) * n + i, d = (r + 1) * n + ((i + 1) % n);
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }));
  m.castShadow = false; m.receiveShadow = true; m.userData.dynamic = true;
  return m;
}

/** A few embedded stones so the soil band has something to discover at full zoom. */
function pebbles(group) {
  const pts = outline(1.1), rnd = seeded(5), soft = ['#b4b9c6', '#9ea4b4', '#c9b39c', '#d9cdbd'];
  for (let i = 0; i < 90; i++) {
    const [x, z] = pts[Math.floor(rnd() * pts.length)], y = -0.42 - rnd() * 1.7, r = 0.1 + rnd() * 0.17;
    const p = ball(r, soft[Math.floor(rnd() * 4)], { x, y, z, seg: 8, sx: 1 + rnd() * 0.5, sy: 0.7, sz: 1 + rnd() * 0.5, shadow: false });
    group.add(p);
  }
}

/** Sits below the slab with no plane of its own, so it works over whatever sky colour the engine is drawing. */
function floatShadow(ground) {
  const tex = canvasTex(1024, 1024, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.filter = 'blur(64px)';
    x.fillStyle = 'rgba(66,80,110,.42)';
    x.beginPath(); x.roundRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6, w * 0.1); x.fill();
    x.filter = 'none';
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(112, 92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  m.position.set((SITE.x0 + SITE.x1) / 2, -11, (SITE.z0 + SITE.z1) / 2);
  m.renderOrder = -10; m.userData.dynamic = true;
  ground.add(m);
  return m;
}

export function buildIsland(ground, opts) {
  const { x0, z0, x1, z1 } = SITE, W = x1 - x0, D = z1 - z0;
  const tex = canvasTex(W * PX, D * PX, (x) => paintSite(x, W, D, opts));
  const geo = new THREE.ShapeGeometry(roundedShape(x0, z0, x1, z1, RADIUS), 14);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x0) / W, 1 - (p.getZ(i) - z0) / D);
  const top = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
  top.position.y = GROUND_Y; top.receiveShadow = true; top.userData.dynamic = true;
  ground.add(top, strata());
  floatShadow(ground);
  ambulanceDecal(ground);
  const stones = new THREE.Group(); pebbles(stones); ground.add(stones);
  return { top, tex };
}
