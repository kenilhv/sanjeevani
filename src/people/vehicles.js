// Ambulances, cars and the helicopter: one prop per twin.vehicles entry, eased so sim steps never show.
import * as THREE from 'three';
import { makeProp, CATALOG } from '../props/registry.js';
import { SITE } from '../world/plan.js';
import { newTrack, stepTrack, snapTrack } from './ease.js';

const { atan2, sin, cos, exp, hypot, min, max } = Math;
const wrap = (a) => atan2(sin(a), cos(a));
const smooth = (a, b, x) => { const t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const CAR_COLORS = ['#f2f0e8', '#7aa7d9', '#e98f98', '#8fcfb4', '#f0c04a', '#a9b4c6', '#c7a2d9'];
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; };

export function createVehicles(engine) {
  const live = new Map(), pickMat = new THREE.MeshBasicMaterial({ visible: false });
  let stamp = 0;

  function spawn(v) {
    const group = makeProp(v.type, v.type === 'car' ? { color: v.color ?? CAR_COLORS[hash(v.id) % CAR_COLORS.length] } : {});
    const meta = CATALOG[v.type] ?? { fp: [2, 4], h: 1.5 };
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(meta.fp[0], meta.h, meta.fp[1]), pickMat);
    proxy.position.y = meta.h / 2;
    group.add(proxy);
    engine.ground.add(group);
    engine.addPickable(proxy, { type: 'vehicle', id: v.id });
    const V = { v, id: v.id, group, proxy, x: v.x, y: v.y ?? 0, z: v.z, vx: 0, vy: 0, vz: 0, h: v.heading ?? 0, turn: 0, appear: 0, stamp, track: newTrack(v.x, v.z) };
    group.position.set(V.x, V.y, V.z);
    group.rotation.order = 'YXZ';
    group.rotation.y = V.h;
    group.scale.setScalar(0.001);
    live.set(v.id, V);
    return V;
  }

  return {
    update(dt, t, twin) {
      stamp++;
      const list = twin.vehicles;
      if (list) for (let i = 0; i < list.length; i++) {
        const v = list[i], V = live.get(v.id) ?? spawn(v);
        V.stamp = stamp; V.v = v;
      }
      for (const V of live.values()) {
        const v = V.v, here = V.stamp === stamp, flying = v.type === 'helicopter';
        const tx = v.x, ty = v.y ?? 0, tz = v.z;
        if (hypot(tx - V.x, tz - V.z) > 24) { V.x = tx; V.y = ty; V.z = tz; V.vx = V.vy = V.vz = 0; V.h = v.heading ?? 0; V.appear = 0; snapTrack(V.track, tx, tz); }
        stepTrack(V.track, tx, tz, dt);
        const q = V.track, w = 9, den = 1 + 2 * w * dt + w * w * dt * dt;
        V.vx = (V.vx + dt * w * w * (q.x - V.x)) / den; V.x += dt * V.vx;
        V.vz = (V.vz + dt * w * w * (q.z - V.z)) / den; V.z += dt * V.vz;
        V.vy = (V.vy + dt * 36 * (ty - V.y)) / (1 + 12 * dt + 36 * dt * dt); V.y += dt * V.vy;
        const dh = wrap((v.heading ?? V.h) - V.h), step = dh * (1 - exp(-dt * (flying ? 2.5 : 5.5)));
        V.h += step;
        V.turn += (step / max(dt, 0.001) - V.turn) * (1 - exp(-dt * 8));
        const speed = hypot(V.vx, V.vz), forward = V.vx * sin(V.h) + V.vz * cos(V.h);
        V.appear = min(1, max(0, V.appear + (here ? dt : -dt) * 2.4));
        // The sim fades vehicles at the cut road ends; the fallback does the same for anything that does not say.
        const edge = flying ? 1 : v.scale ?? smooth(0, 5, min(V.x - SITE.x0, SITE.x1 - V.x));
        const a = V.appear, s = a * a * (3 - 2 * a) * edge;
        const g = V.group;
        g.visible = s > 0.005;
        g.position.set(V.x, V.y, V.z);
        g.rotation.y = V.h;
        g.scale.setScalar(max(0.001, s));
        // A little body roll into turns and a nose dip when the helicopter cruises keep the machines from feeling on rails.
        g.rotation.z = max(-0.14, min(0.14, V.turn * (flying ? -0.2 : -0.02) * min(1, speed / 2)));
        g.rotation.x = flying ? max(0, min(0.2, forward * 0.016)) * (V.y > 1 ? 1 : 0) : 0;
        g.userData.setState?.(v);
        g.userData.tick?.(dt, t, engine.ctx);
        if (!here && V.appear <= 0) {
          engine.removePickable(V.proxy);
          V.proxy.geometry.dispose();
          g.parent?.remove(g);
          live.delete(V.id);
        }
      }
    },
  };
}
