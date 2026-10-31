// Floors: a repeating tile per theme (crisp at any zoom), corridors with their own painted wayfinding,
// a soft painted AO layer so rooms feel lit, and the plate each floor sits on.
import * as THREE from 'three';
import { C, THEMES } from '../style/palette.js';
import { BUILDING, DOORS, ROOMS, roomById, roomsOnFloor } from './plan.js';
import { canvasTex, mat } from '../style/kit.js';
import { roundedShape, seeded, whenFonts, SANS } from './shell-geo.js';

const PAT = {
  ward: { w: 1.2, d: 0.6, bond: 0.5, nx: 6, nz: 12 },
  corridor: { w: 1.2, d: 0.6, bond: 0.5, nx: 6, nz: 12 },
  nurses: { w: 1.0, d: 0.5, bond: 0.5, nx: 6, nz: 12 },
  lobby: { w: 1.2, d: 1.2, nx: 6, nz: 6, flecks: 1 },
  er: { w: 0.6, d: 0.6, nx: 8, nz: 8 },
  imaging: { w: 0.8, d: 0.8, nx: 8, nz: 8 },
  lab: { w: 0.6, d: 0.6, nx: 8, nz: 8 },
  pharmacy: { w: 0.6, d: 0.6, nx: 8, nz: 8 },
  core: { w: 0.8, d: 0.8, nx: 8, nz: 8 },
  icu: { w: 0.6, d: 0.6, nx: 8, nz: 8 },
  or: { w: 0.5, d: 0.5, nx: 8, nz: 8, flecks: 0.4 },
};

const tileCanvases = new Map();
function drawTiles(name) {
  if (tileCanvases.has(name)) return tileCanvases.get(name);
  const th = THEMES[name], pat = PAT[name], S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), [tile, grout] = th.tile, rnd = seeded(name.length * 37 + name.charCodeAt(1));
  const tw = S / pat.nx, td = S / pat.nz, g = name === 'lobby' ? 2.4 : 3;
  const base = new THREE.Color(tile), light = new THREE.Color(name === 'ward' ? C.tilePinkLight : '#ffffff'), deep = new THREE.Color(grout), col = new THREE.Color();
  x.fillStyle = grout; x.fillRect(0, 0, S, S);
  const shades = Array.from({ length: pat.nz }, () => Array.from({ length: pat.nx }, () => {
    const r = rnd();
    col.copy(base);
    if (r > 0.55) col.lerp(light, (r - 0.55) * (name === 'ward' ? 1.5 : 0.75)); else col.lerp(deep, (0.55 - r) * 0.34);
    return `#${col.getHexString()}`;
  }));
  for (let r = 0; r < pat.nz; r++) {
    const off = r % 2 && pat.bond ? pat.bond * tw : 0;
    for (let i = -1; i < pat.nx; i++) {
      const px = i * tw + off, py = r * td, shade = shades[r][(i + pat.nx) % pat.nx];
      x.fillStyle = shade; x.fillRect(px + g / 2, py + g / 2, tw - g, td - g);
      x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(px + g / 2, py + g / 2, tw - g, 1.4); x.fillRect(px + g / 2, py + g / 2, 1.4, td - g);
      x.fillStyle = 'rgba(90,60,60,.05)'; x.fillRect(px + g / 2, py + td - g / 2 - 1.4, tw - g, 1.4); x.fillRect(px + tw - g / 2 - 1.4, py + g / 2, 1.4, td - g);
    }
  }
  if (pat.flecks) {
    for (let i = 0; i < 1400 * pat.flecks; i++) {
      const v = rnd();
      x.fillStyle = v > 0.66 ? 'rgba(180,150,120,.32)' : v > 0.33 ? 'rgba(255,255,255,.5)' : 'rgba(120,150,160,.2)';
      x.beginPath(); x.ellipse(rnd() * S, rnd() * S, 1 + rnd() * 2.2, 0.8 + rnd() * 1.6, rnd() * 3, 0, 7); x.fill();
    }
  }
  const out = { canvas: c, sx: pat.w * pat.nx, sz: pat.d * pat.nz };
  tileCanvases.set(name, out);
  return out;
}

const texCache = new Map();
function tileTexture(name) {
  if (texCache.has(name)) return texCache.get(name);
  const { canvas, sx, sz } = drawTiles(name), t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 12;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / sx, 1 / sz);
  texCache.set(name, t);
  return t;
}

const floorMats = new Map();
export const nightFloors = [];
function floorMat(key, map) {
  if (floorMats.has(key)) return floorMats.get(key);
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.58, emissive: '#ffcf9e', emissiveMap: map, emissiveIntensity: 0 });
  floorMats.set(key, m); nightFloors.push(m);
  return m;
}

const quadsMesh = (rects, material) => {
  const pos = [], nor = [], uv = [];
  for (const [x0, z0, x1, z1] of rects) for (const [x, z] of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) { pos.push(x, 0, z); nor.push(0, 1, 0); uv.push(x, z); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true; m.userData.dynamic = true;
  return m;
};

const rectsAround = ({ x, z, w, d }, v) => {
  if (!v) return [[x, z, x + w, z + d]];
  return [[x, z, x + w, v.z0], [x, v.z1, x + w, z + d], [x, v.z0, v.x0, v.z1], [v.x1, v.z0, x + w, v.z1]];
};

function wayfinding(floor, room) {
  const r = room.rect, PXM = 128, W = r.w * PXM, H = r.d * PXM;
  const { canvas: tiles, sx, sz } = drawTiles('corridor');
  const draw = (x) => {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.save(); x.scale((sx * PXM) / tiles.width, (sz * PXM) / tiles.height);
    x.fillStyle = x.createPattern(tiles, 'repeat'); x.fillRect(0, 0, (W * tiles.width) / (sx * PXM), (H * tiles.height) / (sz * PXM));
    x.restore();
    const stripe = (z, col, deep) => {
      const y = z * PXM, h = 0.15 * PXM, x0 = 0.45 * PXM, l = W - 0.9 * PXM;
      x.fillStyle = 'rgba(90,96,110,.28)'; x.beginPath(); x.roundRect(x0 - 2, y - 2, l + 4, h + 4, h / 2 + 2); x.fill();
      x.fillStyle = col; x.beginPath(); x.roundRect(x0, y, l, h, h / 2); x.fill();
      x.fillStyle = deep; x.fillRect(x0 + h / 2, y, l - h, 2);
    };
    stripe(0.62, C.teal, C.tealDeep); stripe(2.24, C.coral, C.coralDeep);
    // Chevrons head towards the lifts, and every door gets its name on the floor beside it.
    x.fillStyle = 'rgba(255,255,255,.92)';
    for (let m = 3; m < r.w - 1; m += 6) for (const z of [0.62, 2.24]) {
      const cx = m * PXM, cy = (z + 0.075) * PXM, s = 0.052 * PXM;
      x.beginPath(); x.moveTo(cx - s, cy - s); x.lineTo(cx + s * 0.2, cy - s); x.lineTo(cx + s * 1.2, cy); x.lineTo(cx + s * 0.2, cy + s); x.lineTo(cx - s, cy + s); x.lineTo(cx, cy); x.closePath(); x.fill();
    }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const d of DOORS) {
      if (d.floor !== floor || !d.rooms.includes(room.id) || d.axis !== 'x') continue;
      const other = roomById(d.rooms.find((id) => id && id !== room.id));
      if (!other) continue;
      const south = d.z > r.z + r.d / 2, y = (south ? 2.0 : 1.0) * PXM, name = other.name;
      x.font = `600 ${0.22 * PXM}px ${SANS}`;
      const tw = x.measureText(name).width + 0.46 * PXM, cx = d.x * PXM;
      x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.roundRect(cx - tw / 2, y - 0.2 * PXM, tw, 0.4 * PXM, 0.2 * PXM); x.fill();
      x.fillStyle = C.ink; x.fillText(name, cx, y + 3);
    }
  };
  const t = canvasTex(W, H, draw);
  t.anisotropy = 12; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1 / r.w, 1 / r.d); t.offset.set(-r.x / r.w, 1 + r.z / r.d);
  t.repeat.y = -1 / r.d;
  whenFonts(() => { draw(t.image.getContext('2d')); t.needsUpdate = true; });
  return t;
}

export function buildFloorMeshes(floor, void_) {
  const group = new THREE.Group(), byTheme = new Map();
  group.userData.dynamic = true;
  for (const room of roomsOnFloor(floor)) {
    if (room.theme === 'corridor') { group.add(quadsMesh([[room.rect.x, room.rect.z, room.rect.x + room.rect.w, room.rect.z + room.rect.d]], floorMat(`corridor${floor}`, wayfinding(floor, room)))); continue; }
    if (!byTheme.has(room.theme)) byTheme.set(room.theme, []);
    byTheme.get(room.theme).push(...rectsAround(room.rect, room.circulation ? void_ : null));
  }
  for (const [name, rects] of byTheme) group.add(quadsMesh(rects, floorMat(name, tileTexture(name))));
  return group;
}

/** Soft plum shade pooled along every wall. Painted once at low res on purpose: the blur is the point, and it is one draw call per floor. */
export function buildFloorAO(runs) {
  const S = 22, M = 1, W = (BUILDING.w + 2 * M) * S, H = (BUILDING.d + 2 * M) * S;
  const tex = canvasTex(W, H, (x) => {
    x.clearRect(0, 0, W, H);
    x.setTransform(S, 0, 0, S, M * S, M * S);
    x.lineCap = 'butt';
    for (const run of runs) for (const seg of run.solids) {
      const [ax, az, bx, bz] = run.axis === 'x' ? [seg.a, run.c, seg.b, run.c] : [run.c, seg.a, run.c, seg.b];
      for (const [w, a] of [[3.2, 0.018], [2.3, 0.026], [1.6, 0.034], [1.05, 0.05], [0.66, 0.07], [0.4, 0.09]]) {
        x.strokeStyle = `rgba(74,48,72,${a})`; x.lineWidth = w;
        x.beginPath(); x.moveTo(ax, az); x.lineTo(bx, bz); x.stroke();
      }
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(BUILDING.w + 2 * M, BUILDING.d + 2 * M).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.position.set(BUILDING.w / 2, 0.003, BUILDING.d / 2);
  m.userData.dynamic = true;
  return m;
}

/** The tray each floor stands in: a bright lip and a recessed body, so level 1 reads as a solid slab. Holes let the stair through. */
export function buildPlate(floor, void_) {
  const group = new THREE.Group(), reach = 0.2;
  const slab = (grow, depth, y, color) => {
    const shape = roundedShape(-reach - grow, -reach - grow, BUILDING.w + reach + grow, BUILDING.d + reach + grow, 0.34);
    if (void_) {
      const h = new THREE.Path();
      h.moveTo(void_.x0, -void_.z0); h.lineTo(void_.x1, -void_.z0); h.lineTo(void_.x1, -void_.z1); h.lineTo(void_.x0, -void_.z1); h.closePath();
      shape.holes.push(h);
    }
    const bev = 0.022;
    const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 2, curveSegments: 8 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y - depth + bev, 0);
    const m = new THREE.Mesh(g, mat(color));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  group.add(slab(0.03, 0.13, -0.004, C.white));
  group.add(slab(-0.05, floor ? 0.4 : 0.14, -0.13, floor ? '#e9e4de' : '#d9d2cb'));
  return group;
}
