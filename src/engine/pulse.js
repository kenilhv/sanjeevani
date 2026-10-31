// A soft ring that spreads across the floor and fades. Pooled, so events never allocate.
import * as THREE from 'three';

const SIZE = 9, LIFE = 1.7, POOL = 10;
const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const fragmentShader = /* glsl */`
  uniform vec3 uColor; uniform float uT;
  varying vec2 vUv;
  float band(float r, float at, float w) { return smoothstep(w, 0., abs(r - at)); }
  void main() {
    float r = length(vUv);
    float t = 1. - pow(1. - uT, 2.2), t2 = 1. - pow(1. - max(uT - .16, 0.) / .84, 2.2);
    float a = band(r, t, mix(.07, .26, uT)) * .85 + band(r, t2, mix(.05, .2, uT)) * .4 + smoothstep(t, 0., r) * .16;
    a *= pow(1. - uT, 1.4) * smoothstep(0., .07, uT) * smoothstep(1., .9, r);
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createPulses(floors, { floorVisible, floorY }) {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2);
  const pool = Array.from({ length: POOL }, () => {
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uT: { value: 0 } },
      vertexShader, fragmentShader, transparent: true, depthWrite: false,
    }));
    mesh.visible = false; mesh.renderOrder = 6; mesh.userData.dynamic = true; mesh.raycast = () => {};
    return { mesh, t: 0 };
  });

  return {
    fire(x, y, z, color = '#ffffff') {
      const p = pool.find((q) => !q.mesh.visible) ?? pool.reduce((a, b) => (a.t > b.t ? a : b));
      // Ride the plate the event happened on, so a ring survives the plate moving under it.
      const onUpper = floorVisible(1) && y > floorY(1) - 0.6;
      (onUpper ? floors[1] : floors[0]).add(p.mesh);
      p.mesh.position.set(x, y - (onUpper ? floorY(1) : 0) + 0.05, z);
      p.mesh.material.uniforms.uColor.value.set(color);
      p.mesh.material.uniforms.uT.value = 0;
      p.mesh.visible = true;
      p.t = 0;
    },
    update(dt) {
      for (const p of pool) {
        if (!p.mesh.visible) continue;
        p.t += dt / LIFE;
        p.mesh.material.uniforms.uT.value = Math.min(p.t, 1);
        if (p.t >= 1) p.mesh.visible = false;
      }
    },
  };
}
