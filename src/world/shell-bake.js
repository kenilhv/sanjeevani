// kit.bakeStatic merges by material, so a floor still costs one draw call per colour, and props use hundreds of colours.
// Here flat opaque materials collapse into a few vertex-coloured meshes keyed by surface finish. Anything textured,
// transparent or emissive stays out: props animate emissive materials, and bakeStatic keeps those references alive.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bakeStatic } from '../style/kit.js';

const finishes = new Map();
const step = (v, s) => Math.round(v / s) * s;

function finish(rough, metal, side) {
  const k = `${rough}|${metal}|${side}`;
  if (!finishes.has(k)) finishes.set(k, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, side }));
  return finishes.get(k);
}

const flat = (m) => m?.isMeshStandardMaterial && !m.map && !m.transparent && m.opacity === 1 && !m.vertexColors
  && !m.emissiveMap && !m.normalMap && !m.alphaMap && !m.clippingPlanes?.length && !m.onBeforeCompile?.length
  && (!m.emissive || m.emissive.getHex() === 0);

export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), mtx = new THREE.Matrix4();
  const buckets = new Map(), doomed = [];
  const walk = (o) => {
    if (o !== root && o.userData.dynamic) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && flat(o.material)) {
      const m = o.material, rough = step(m.roughness, 0.1), metal = step(m.metalness, 0.25);
      const k = `${rough}|${metal}|${m.side}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}`;
      if (!buckets.has(k)) buckets.set(k, { mat: finish(rough, metal, m.side), cast: o.castShadow, recv: o.receiveShadow, order: o.renderOrder, geos: [] });
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      g.applyMatrix4(mtx.multiplyMatrices(inv, o.matrixWorld));
      const n = g.attributes.position.count, col = new Float32Array(n * 3), { r, g: gr, b } = m.color;
      for (let i = 0; i < n; i++) { col[i * 3] = r; col[i * 3 + 1] = gr; col[i * 3 + 2] = b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      buckets.get(k).geos.push(g);
      doomed.push(o);
    }
    o.children.slice().forEach(walk);
  };
  walk(root);
  doomed.forEach((m) => m.parent?.remove(m));
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.renderOrder = b.order;
    mesh.userData.baked = true; mesh.userData.dynamic = true;
    root.add(mesh);
  }
  bakeStatic(root);
  return root;
}
