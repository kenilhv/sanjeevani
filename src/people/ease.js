// The sim moves things in fixed steps, several times a second at normal speed. Damping alone turns those steps
// into a speed ripple, so a track first rebuilds steady motion by gliding from step to step over the measured
// step interval. The caller then rounds the corners with a critically damped follow.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const newTrack = (x, z) => ({ tx: x, tz: z, sx: x, sz: z, x, z, age: 1, gap: 0.2 });

export function stepTrack(q, x, z, dt) {
  if (x !== q.tx || z !== q.tz) {
    // A long pause was a stop, not a step, so it says nothing about the step rate.
    if (q.age < 0.6) q.gap += (clamp(q.age, 0.012, 0.45) - q.gap) * 0.3;
    q.sx = q.x; q.sz = q.z; q.tx = x; q.tz = z; q.age = 0;
  }
  q.age += dt;
  const k = Math.min(1, q.age / (q.gap * 1.08));
  q.x = q.sx + (q.tx - q.sx) * k;
  q.z = q.sz + (q.tz - q.sz) * k;
}

export function snapTrack(q, x, z) {
  q.tx = q.sx = q.x = x; q.tz = q.sz = q.z = z; q.age = 1;
}
