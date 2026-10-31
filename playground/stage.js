// A neutral photo stage for checking props and people in isolation. Uses the same light feel as the real scene.
import * as THREE from 'three';
import { C } from '../src/style/palette.js';

export function stage({ zoom = 1, center = [0, 0.6, 0], background = C.backdrop, floor = C.tilePink, elevation = 32, azimuth = 45 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.body.style.margin = 0;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  const half = 7 / zoom, aspect = innerWidth / innerHeight;
  const camera = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, -100, 200);
  const el = THREE.MathUtils.degToRad(elevation), az = THREE.MathUtils.degToRad(azimuth);
  camera.position.set(center[0] + Math.sin(az) * Math.cos(el) * 60, center[1] + Math.sin(el) * 60, center[2] + Math.cos(az) * Math.cos(el) * 60);
  camera.lookAt(...center);
  scene.add(new THREE.HemisphereLight('#ffffff', '#d8c8cf', 1.7));
  const sun = new THREE.DirectionalLight('#fff3df', 2.3);
  sun.position.set(-18, 34, 14); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 5; sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 120 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: floor, roughness: 0.85 }));
  ground.receiveShadow = true; scene.add(ground);
  const ticks = [];
  let last = performance.now();
  const api = {
    scene, camera, renderer, ticks,
    /** Lay out groups on a grid and collect their tick hooks. */
    grid(items, { cols = 6, gap = 1.2 } = {}) {
      let x = 0, z = 0, rowDepth = 0, maxX = 0, n = 0;
      const placed = [];
      for (const it of items) {
        const [w, d] = it.userData.meta?.fp ?? [1, 1];
        if (n && n % cols === 0) { z += rowDepth + gap; x = 0; rowDepth = 0; }
        it.position.set(x + w / 2, 0, z + d / 2);
        scene.add(it); placed.push(it);
        x += w + gap; rowDepth = Math.max(rowDepth, d); maxX = Math.max(maxX, x); n++;
      }
      const cx = maxX / 2, cz = (z + rowDepth) / 2;
      scene.traverse((o) => { if (o.userData.tick) ticks.push(o.userData.tick); });
      camera.position.add(new THREE.Vector3(cx, 0, cz));
      camera.lookAt(center[0] + cx, center[1], center[2] + cz);
      return placed;
    },
    run(onFrame) {
      let frames = 0;
      const loop = (now) => {
        const dt = Math.min((now - last) / 1000, 0.05); last = now;
        ticks.forEach((f) => f(dt, now / 1000, { night: 0 }));
        onFrame?.(dt, now / 1000);
        renderer.render(scene, camera);
        if (++frames === 3) window.__ready = true;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
  };
  return api;
}
