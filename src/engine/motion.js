// Critically damped springs and the eases the engine shares.
// Springs are solved in closed form, so a long frame can never overshoot or blow up.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };

export const spring = (x = 0) => ({ x, v: 0, g: x });
export const snap = (s, x = s.g) => { s.x = s.g = x; s.v = 0; return s; };
export const atRest = (s, eps = 1e-3) => Math.abs(s.x - s.g) < eps && Math.abs(s.v) < eps * 10;

export function step(s, omega, dt) {
  const d = s.x - s.g, k = (s.v + omega * d) * dt, e = Math.exp(-omega * dt);
  s.x = s.g + (d + k) * e;
  s.v = (s.v - omega * k) * e;
}

/** Release a spring mid-motion: it coasts to a stop from its current speed without reversing. */
export const coastOut = (s, omega) => { s.g = s.x + s.v / omega; };

/** Leaves promptly, peaks a third of the way in, then takes its time arriving. */
export function glide(t) {
  const s = 1 - Math.pow(1 - clamp(t), 1.7);
  return s * s * s * (s * (6 * s - 15) + 10);
}
