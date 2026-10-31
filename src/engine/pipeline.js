// How a frame reaches the screen, and the governor that keeps it above 50 fps.
// High quality renders through an HDR composer. Every other tier renders straight to the canvas.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

// Worst case last. The governor gives up pixels first, then post, then shadow detail.
const LADDER = [
  { dpr: 2, post: true, shadow: 4096, every: 1 },
  { dpr: 1.7, post: true, shadow: 4096, every: 1 },
  { dpr: 1.4, post: true, shadow: 4096, every: 1 },
  { dpr: 1.4, post: false, shadow: 4096, every: 1 },
  { dpr: 1.15, post: false, shadow: 4096, every: 1 },
  { dpr: 1.15, post: false, shadow: 2048, every: 1 },
  { dpr: 1, post: false, shadow: 2048, every: 2 },
  { dpr: 1, post: false, shadow: 1024, every: 3 },
  { dpr: 0.8, post: false, shadow: 1024, every: 3 },
];
const TIERS = {
  high: LADDER[0],
  medium: { dpr: 1.5, post: false, shadow: 2048, every: 1 },
  low: { dpr: 1, post: false, shadow: 2048, every: 3 },
};
const SLOW_MS = 19.2, CALM_MS = 17.4, WINDOW = 0.5;

class FinishPass extends Pass {
  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uAspect: { value: 1.6 } },
      depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float uAspect;
        varying vec2 vUv;
        float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
        void main() {
          vec2 q = (vUv - .5) * vec2(uAspect, 1.);
          float r = length(q) / (.5 * sqrt(uAspect * uAspect + 1.));
          gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb * (1. - .13 * smoothstep(.62, 1.1, r)), 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor.rgb += (ign(gl_FragCoord.xy) - .5) / 255.;
        }`,
    });
    this.quad = new FullScreenQuad(this.material);
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() { this.material.dispose(); this.quad.dispose(); }
}

function guessStart(renderer) {
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return LADDER.length - 2;
  return /intel|uhd|iris|mali|adreno|powervr/i.test(name) ? 2 : 0;
}

export function createPipeline({ renderer, scene, camera, sky, stats }) {
  let W = 1, H = 1, composer = null, bloom = null, finish = null, tier = null, frame = 0;
  let auto = false, rung = 0, acc = 0, n = 0, cool = 1.2, calm = 0, patience = 14, lastUp = -1e9, clock = 0, ema = 1 / 60;

  function buildComposer() {
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0, 0.62, 0.92);
    composer.addPass(bloom);
    finish = new FinishPass();
    composer.addPass(finish);
  }

  function fitTargets() {
    const dpr = Math.min(window.devicePixelRatio || 1, tier.dpr);
    if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);
    if (!tier.post || !composer) return;
    composer.setPixelRatio(dpr);
    composer.setSize(W, H);
    // Bloom is a soft glow, so it can work well below screen resolution, and that is most of its cost.
    bloom.setSize(Math.round(W * dpr * 0.5), Math.round(H * dpr * 0.5));
    finish.material.uniforms.uAspect.value = W / H;
  }

  function use(next) {
    if (tier === next) return;
    tier = next;
    if (tier.post && !composer) buildComposer();
    fitTargets();
    sky.setMapSize(tier.shadow);
    stats.dpr = renderer.getPixelRatio();
  }

  function setRung(i) {
    rung = Math.max(0, Math.min(LADDER.length - 1, i));
    use(LADDER[rung]);
    stats.level = rung;
  }

  return {
    setQuality(q) {
      auto = q === 'auto' || !TIERS[q];
      stats.quality = auto ? 'auto' : q;
      if (auto) { setRung(guessStart(renderer)); cool = 1.2; } else use(TIERS[q]);
    },
    resize(w, h) {
      W = w; H = h;
      renderer.setSize(w, h);
      if (tier) fitTargets();
    },
    sample(raw) {
      if (raw <= 0 || raw > 1) return;                // a tab switch says nothing about sustained speed
      ema += (raw - ema) * 0.06;
      stats.fps = Math.round(1 / ema);
      if (!auto || document.hidden) return;
      clock += raw; acc += raw; n++;
      if (acc < WINDOW) return;
      const ms = (acc / n) * 1000;
      acc = n = 0;
      if (cool > 0) { cool -= WINDOW; return; }       // the frames right after a change are noise
      if (ms > SLOW_MS) {
        if (clock - lastUp < 4) patience = Math.min(patience * 2, 240);
        calm = 0; cool = 0.6;
        if (rung < LADDER.length - 1) setRung(rung + (ms > 30 ? 2 : 1));
      } else if (ms < CALM_MS && rung > 0) {
        calm += WINDOW;
        if (calm >= patience) { calm = 0; cool = 0.6; lastUp = clock; setRung(rung - 1); }
      } else calm = Math.max(0, calm - WINDOW);
    },
    render(dt) {
      // A slow tier refreshes shadows on some frames only. Static shadows lose nothing; walkers lag by a frame or two.
      renderer.shadowMap.needsUpdate = frame++ % tier.every === 0;
      if (tier.post) {
        bloom.strength = sky.bloom * 0.34;
        bloom.enabled = bloom.strength > 0.01;
        composer.render(dt);
      } else renderer.render(scene, camera);
    },
  };
}
