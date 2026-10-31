import * as THREE from 'three';

export function createPicker({ camera, floors, floorVisible, size }) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const entries = new Map();
  const live = [], hits = [];

  const plateOf = (o) => {
    for (; o; o = o.parent) if (o === floors[0]) return 0; else if (o === floors[1]) return 1;
    return -1;
  };
  const infoOf = (o) => {
    for (; o; o = o.parent) if (entries.has(o)) return entries.get(o).info;
    return null;
  };

  return {
    add(object, info) { entries.set(object, { info, plate: undefined }); },
    remove(object) { entries.delete(object); },
    pick(px, py) {
      // Raycasting ignores .visible, which is what lets invisible proxies work. It also means
      // everything on a hidden or covered plate would still be hit, so those are skipped by hand.
      live.length = 0;
      for (const [object, e] of entries) {
        e.plate ??= object.parent ? plateOf(object) : undefined;
        if (e.plate === undefined || e.plate < 0 || floorVisible(e.plate)) live.push(object);
      }
      if (!live.length) return null;
      ndc.set((px / size.W) * 2 - 1, 1 - (py / size.H) * 2);
      ray.setFromCamera(ndc, camera);
      hits.length = 0;
      ray.intersectObjects(live, true, hits);
      for (const h of hits) {
        const info = infoOf(h.object);
        if (info) return { type: info.type, id: info.id, point: h.point };
      }
      return null;
    },
  };
}
